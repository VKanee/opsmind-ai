from datetime import UTC, datetime, timedelta

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.config import Settings
from app.models import (
    Incident,
    IncidentStatus,
    KnowledgeDocument,
    Organization,
    Role,
    Severity,
    SourceType,
    User,
)
from app.security import hash_password
from app.services.investigations import create_investigation
from app.services.retrieval import index_document


def ensure_seed_data(db: Session, settings: Settings) -> None:
    existing = db.scalar(select(Organization).limit(1))
    if existing is not None:
        return

    organization = Organization(name="云启科技", slug="acme-cloud")
    db.add(organization)
    db.flush()

    password_hash = hash_password(settings.demo_user_password)
    admin = User(
        organization_id=organization.id,
        email="admin@opsmind.local",
        display_name="陈雨桐",
        password_hash=password_hash,
        role=Role.ADMIN,
    )
    responder = User(
        organization_id=organization.id,
        email="responder@opsmind.local",
        display_name="王浩然",
        password_hash=password_hash,
        role=Role.RESPONDER,
    )
    viewer = User(
        organization_id=organization.id,
        email="viewer@opsmind.local",
        display_name="李思颖",
        password_hash=password_hash,
        role=Role.VIEWER,
    )
    db.add_all([admin, responder, viewer])
    db.flush()

    documents = [
        KnowledgeDocument(
            organization_id=organization.id,
            title="结算服务高延迟处置手册",
            source_type=SourceType.RUNBOOK,
            tags=["结算", "延迟", "数据库", "回滚"],
            created_by_id=admin.id,
            content=(
                "触发条件：checkout-api 的 p95 延迟连续五分钟超过 1.5 秒，或错误率超过 2%。\n\n"
                "首先检查：将发布时间标记与延迟开始时间进行对比，检查数据库连接池等待时间，"
                "并比较当前版本与上一个稳定版本。连接池等待时间超过 250 毫秒通常表示连接"
                "资源已经饱和。\n\n"
                "止损措施：将健康检查流量单独路由，通过边缘限流降低非核心结算流量，同时"
                "保留支付回调。结算流量仍在高峰时，不得直接重启数据库。\n\n"
                "恢复条件：当延迟与发布边界明确相关，且上一版本错误预算健康时，执行 "
                "checkout-api 回滚。p95 延迟连续十分钟低于 600 毫秒后，才能宣告故障已缓解。"
            ),
        ),
        KnowledgeDocument(
            organization_id=organization.id,
            title="结算服务依赖关系图",
            source_type=SourceType.SERVICE_DOC,
            tags=["结算", "架构", "支付", "数据库"],
            created_by_id=admin.id,
            content=(
                "checkout-api 负责购物车校验、价格计算、订单创建和支付编排，会调用 "
                "pricing-cache、inventory-api、payment-gateway 以及订单 PostgreSQL 集群。\n\n"
                "关键链路中，支付网关超时预算为 300 毫秒，结算请求总时限为 1.2 秒。每个 Pod "
                "的连接池上限为 40 个连接。上游连续失败十次后，熔断器自动打开。\n\n"
                "执行流量削减时必须保留支付回调，因为回调会根据订单令牌进行幂等去重。搜索和"
                "推荐调用属于非核心链路，可以优先关闭。"
            ),
        ),
        KnowledgeDocument(
            organization_id=organization.id,
            title="支付网关超时复盘报告",
            source_type=SourceType.POSTMORTEM,
            tags=["支付", "超时", "上游", "复盘"],
            created_by_id=admin.id,
            content=(
                "某区域支付渠道在一次例行维护后出现响应时间升高。请求超过结算时限，连接池被"
                "阻塞的支付调用占满，最终引发结算错误率上升。\n\n"
                "通过打开支付熔断器、降低结算并发，并将符合条件的流量切换到备用渠道后，故障"
                "得到缓解。长期修复将支付超时预算与结算请求预算拆分，并补充渠道级饱和告警。\n\n"
                "经验教训：依赖服务延迟必须独立于业务延迟进行观测；重试必须加入随机抖动，并"
                "受严格的重试预算约束。"
            ),
        ),
        KnowledgeDocument(
            organization_id=organization.id,
            title="生产变更与回滚管理制度",
            source_type=SourceType.POLICY,
            tags=["变更", "回滚", "审批", "治理"],
            created_by_id=admin.id,
            content=(
                "AI 助手生成的所有生产变更建议都必须经过人工审批。高风险操作只能由响应者或"
                "管理员批准，并且必须填写可审计的决策说明。\n\n"
                "当发布时间边界与故障出现时间吻合，且前向修复尚未在预发布环境验证时，应优先"
                "回滚。流量削减可以作为可逆的止损步骤。直接执行数据库主备切换仅限值班数据库"
                "管理员。\n\n"
                "无论批准还是驳回，都必须记录操作者、时间、原因以及调查所引用的证据。"
            ),
        ),
        KnowledgeDocument(
            organization_id=organization.id,
            title="搜索索引复制恢复指南",
            source_type=SourceType.RUNBOOK,
            tags=["搜索", "复制", "延迟"],
            created_by_id=admin.id,
            content=(
                "当搜索索引复制延迟超过 60 秒时，先检查写入队列深度和索引器 CPU，再决定是否"
                "调整流量。暂停非必要的数据回填，逐步提高索引器并发，并将过期查询路由到最后"
                "一个已知健康的搜索分片。\n\n"
                "恢复标准为：复制延迟连续十五分钟低于五秒，且写入队列深度保持稳定。"
            ),
        ),
    ]
    db.add_all(documents)
    db.flush()
    for document in documents:
        index_document(db, document, settings=settings)

    now = datetime.now(UTC)
    incidents = [
        Incident(
            organization_id=organization.id,
            public_id="INC-2026-1042",
            title="checkout-api 发布后出现延迟突增",
            description=(
                "checkout-api 2026.10.17.3 版本覆盖 60% 生产流量后，结算 p95 延迟从 240 毫秒"
                "升至 4.8 秒，数据库连接池等待时间持续上升，用户反馈购物车结算失败。支付回调"
                "当前仍然正常。"
            ),
            service="checkout-api",
            severity=Severity.SEV1,
            status=IncidentStatus.INVESTIGATING,
            owner_id=responder.id,
            created_by_id=responder.id,
            started_at=now - timedelta(minutes=42),
            detected_at=now - timedelta(minutes=38),
            tags=["发布", "延迟", "客户影响"],
            signals=[
                {"name": "p95 延迟", "value": "4.8", "unit": "秒", "status": "critical"},
                {"name": "错误率", "value": "7.2", "unit": "%", "status": "warning"},
                {"name": "连接池等待", "value": "680", "unit": "毫秒", "status": "critical"},
            ],
        ),
        Incident(
            organization_id=organization.id,
            public_id="INC-2026-1041",
            title="支付渠道超时引发级联故障",
            description=(
                "某区域支付渠道响应时间明显高于平时，结算熔断器已开始打开，重试流量持续增加，"
                "可能进一步挤压结算服务资源。"
            ),
            service="payment-gateway",
            severity=Severity.SEV2,
            status=IncidentStatus.OPEN,
            owner_id=responder.id,
            created_by_id=admin.id,
            started_at=now - timedelta(minutes=17),
            detected_at=now - timedelta(minutes=14),
            tags=["支付", "上游", "超时"],
            signals=[
                {"name": "渠道 p99", "value": "3.1", "unit": "秒", "status": "critical"},
                {"name": "重试比例", "value": "34", "unit": "%", "status": "warning"},
            ],
        ),
        Incident(
            organization_id=organization.id,
            public_id="INC-2026-1038",
            title="搜索索引复制延迟",
            description="搜索索引复制延迟短时超过数据新鲜度目标，部分查询返回了较旧结果。",
            service="search-index",
            severity=Severity.SEV3,
            status=IncidentStatus.RESOLVED,
            owner_id=responder.id,
            created_by_id=admin.id,
            started_at=now - timedelta(days=2),
            detected_at=now - timedelta(days=2, minutes=4),
            resolved_at=now - timedelta(days=2, minutes=51),
            tags=["搜索", "复制"],
            signals=[
                {"name": "复制延迟", "value": "94", "unit": "秒", "status": "warning"},
            ],
        ),
        Incident(
            organization_id=organization.id,
            public_id="INC-2026-1034",
            title="证书轮换后认证错误率上升",
            description=(
                "证书轮换后认证失败量上升，部分移动端客户端仍在使用旧版证书包，导致登录和"
                "令牌刷新请求失败。"
            ),
            service="identity-api",
            severity=Severity.SEV2,
            status=IncidentStatus.RESOLVED,
            owner_id=responder.id,
            created_by_id=admin.id,
            started_at=now - timedelta(days=8),
            detected_at=now - timedelta(days=8, minutes=2),
            resolved_at=now - timedelta(days=8, hours=-1),
            tags=["认证", "证书"],
            signals=[
                {"name": "认证 5xx", "value": "12.4", "unit": "%", "status": "critical"},
            ],
        ),
    ]
    db.add_all(incidents)
    db.commit()

    db.refresh(incidents[0])
    create_investigation(db, incident=incidents[0], user=admin, settings=settings)
