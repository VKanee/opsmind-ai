from __future__ import annotations

import json
import time
from dataclasses import dataclass
from typing import Any

import httpx

from app.config import Settings
from app.models import Incident, RiskLevel
from app.schemas import EvidenceItem, Hypothesis, RecommendedAction


@dataclass(frozen=True)
class AnalysisResult:
    summary: str
    hypotheses: list[Hypothesis]
    actions: list[RecommendedAction]
    model_name: str
    input_tokens: int
    output_tokens: int
    latency_ms: int
    provider_mode: str


def _evidence_ids(evidence: list[EvidenceItem], limit: int = 3) -> list[str]:
    return [item.chunk_id for item in evidence[:limit]]


def _demo_analysis(incident: Incident, evidence: list[EvidenceItem]) -> AnalysisResult:
    started = time.perf_counter()
    text = " ".join(
        [
            incident.title,
            incident.description,
            " ".join(signal.get("name", "") for signal in incident.signals),
            " ".join(incident.tags),
        ]
    ).lower()
    evidence_ids = _evidence_ids(evidence)
    hypotheses: list[Hypothesis] = []

    if any(
        term in text
        for term in (
            "deploy",
            "release",
            "rollout",
            "canary",
            "发布",
            "上线",
            "灰度",
            "部署",
            "新版本",
            "回滚",
        )
    ):
        hypotheses.append(
            Hypothesis(
                id="hyp-deployment",
                title="最近一次发布引入回归",
                confidence=0.86,
                rationale=(
                    "故障时间与近期发布窗口高度重合，且症状集中在单一请求链路，符合新版本"
                    "引入回归的特征。"
                ),
                evidence_ids=evidence_ids,
            )
        )
    if any(
        term in text
        for term in (
            "latency",
            "timeout",
            "database",
            "connection",
            "pool",
            "数据库",
            "连接池",
            "连接数",
        )
    ):
        hypotheses.append(
            Hypothesis(
                id="hyp-database",
                title="数据库连接池耗尽",
                confidence=0.74,
                rationale=(
                    "请求延迟和超时信号持续上升，与数据库连接被占满的表现一致；处置手册将"
                    "连接池等待时间列为首要判断指标。"
                ),
                evidence_ids=evidence_ids,
            )
        )
    if any(
        term in text
        for term in (
            "replication",
            "index",
            "lag",
            "复制",
            "索引",
            "分片",
            "数据新鲜度",
        )
    ):
        hypotheses.append(
            Hypothesis(
                id="hyp-search-replication",
                title="搜索索引复制链路异常",
                confidence=0.72,
                rationale=(
                    "复制延迟和数据新鲜度信号指向索引器、写入队列或分片复制链路，"
                    "需要结合队列深度与索引器资源进一步确认。"
                ),
                evidence_ids=evidence_ids,
            )
        )
    if any(
        term in text
        for term in (
            "payment",
            "upstream",
            "dependency",
            "provider",
            "5xx",
            "支付",
            "上游",
            "依赖",
            "第三方",
            "渠道",
            "错误率",
        )
    ):
        hypotheses.append(
            Hypothesis(
                id="hyp-upstream",
                title="上游依赖服务质量下降",
                confidence=0.68,
                rationale=(
                    "故障特征表明第三方服务可能持续返回错误，或已耗尽调用超时预算，进而"
                    "向业务链路级联传导。"
                ),
                evidence_ids=evidence_ids,
            )
        )
    if any(
        term in text
        for term in (
            "memory",
            "cpu",
            "saturation",
            "oom",
            "内存",
            "资源",
            "饱和",
            "容量",
        )
    ):
        hypotheses.append(
            Hypothesis(
                id="hyp-capacity",
                title="计算或内存资源饱和",
                confidence=0.63,
                rationale=("事故信号中存在明显的资源压力，可能进一步放大请求失败和恢复时间。"),
                evidence_ids=evidence_ids,
            )
        )
    if not hypotheses:
        hypotheses.append(
            Hypothesis(
                id="hyp-generic",
                title="需要进一步关联遥测数据的服务级故障",
                confidence=0.52,
                rationale="当前信号尚不足以锁定单一故障域，需要继续关联日志、指标与变更记录。",
                evidence_ids=evidence_ids,
            )
        )

    hypotheses = sorted(hypotheses, key=lambda item: item.confidence, reverse=True)[:3]
    top = hypotheses[0]
    summary = (
        f"{incident.public_id} 影响服务 {incident.service}。当前置信度最高的判断是"
        f"“{top.title}”，置信度为 {round(top.confidence * 100)}%。"
        f"AI 已关联 {len(evidence)} 条经过验证的知识证据，并据此生成下一步诊断建议。"
    )

    actions = [
        RecommendedAction(
            id="action-verify",
            title="结合实时遥测验证首要假设",
            description=(
                "对比事故时间窗内的请求延迟、错误率、连接池等待时间和发布标记。该操作只读取"
                "遥测数据，不会修改生产环境。"
            ),
            risk_level=RiskLevel.LOW,
            approval_required=False,
            evidence_ids=evidence_ids,
        ),
        RecommendedAction(
            id="action-shed-load",
            title="对受影响接口实施非核心流量限流",
            description=("按照处置手册临时限制结算链路的非核心流量，同时保留健康检查和支付回调。"),
            risk_level=RiskLevel.MEDIUM,
            approval_required=True,
            evidence_ids=evidence_ids,
        ),
    ]
    if any(
        term in text
        for term in (
            "deploy",
            "release",
            "rollout",
            "canary",
            "发布",
            "上线",
            "灰度",
            "部署",
            "新版本",
            "回滚",
        )
    ):
        actions.append(
            RecommendedAction(
                id="action-rollback",
                title="回滚最近一次应用发布",
                description=(
                    "仅在确认故障与发布边界相关后执行标准回滚流程。任何生产变更都必须经过人工审批。"
                ),
                risk_level=RiskLevel.HIGH,
                approval_required=True,
                evidence_ids=evidence_ids,
            )
        )

    latency_ms = max(1, int((time.perf_counter() - started) * 1000))
    return AnalysisResult(
        summary=summary,
        hypotheses=hypotheses,
        actions=actions,
        model_name="opsmind-demo-rca",
        input_tokens=len(text.split()) + len(evidence) * 60,
        output_tokens=180,
        latency_ms=latency_ms,
        provider_mode="deterministic-demo",
    )


def _remote_analysis(
    incident: Incident,
    evidence: list[EvidenceItem],
    settings: Settings,
) -> AnalysisResult:
    started = time.perf_counter()
    evidence_payload = [
        {
            "id": item.chunk_id,
            "title": item.document_title,
            "source_type": item.source_type.value,
            "content": item.snippet,
        }
        for item in evidence
    ]
    system_prompt = (
        "你是一名企业事故指挥助手。只能依据给定的事故信息和证据进行分析，所有输出必须使用"
        "简体中文。返回严格 JSON，顶层字段为 summary、hypotheses、actions。每个假设必须包含 "
        "id、title、confidence、rationale、evidence_ids；每项建议必须包含 id、title、"
        "description、risk_level（low|medium|high）、approval_required、evidence_ids。"
        "中高风险的生产变更必须将 approval_required 设为 true。不得编造证据 ID。"
    )
    user_payload = {
        "incident": {
            "id": incident.public_id,
            "title": incident.title,
            "description": incident.description,
            "service": incident.service,
            "severity": incident.severity.value,
            "signals": incident.signals,
            "tags": incident.tags,
        },
        "evidence": evidence_payload,
    }
    response = httpx.post(
        f"{settings.llm_base_url.rstrip('/')}/chat/completions",
        headers={
            "Authorization": f"Bearer {settings.llm_api_key}",
            "Content-Type": "application/json",
        },
        json={
            "model": settings.llm_model,
            "temperature": 0.1,
            "response_format": {"type": "json_object"},
            "messages": [
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": json.dumps(user_payload)},
            ],
        },
        timeout=settings.llm_timeout_seconds,
    )
    response.raise_for_status()
    payload = response.json()
    content = payload["choices"][0]["message"]["content"]
    parsed: dict[str, Any] = json.loads(content)
    hypotheses = [Hypothesis.model_validate(item) for item in parsed["hypotheses"]]
    actions = [RecommendedAction.model_validate(item) for item in parsed["actions"]]
    usage = payload.get("usage", {})
    return AnalysisResult(
        summary=str(parsed["summary"]),
        hypotheses=hypotheses,
        actions=actions,
        model_name=settings.llm_model,
        input_tokens=int(usage.get("prompt_tokens", 0)),
        output_tokens=int(usage.get("completion_tokens", 0)),
        latency_ms=max(1, int((time.perf_counter() - started) * 1000)),
        provider_mode="openai-compatible",
    )


def analyze_incident(
    incident: Incident,
    evidence: list[EvidenceItem],
    settings: Settings,
) -> AnalysisResult:
    if settings.llm_mode == "openai_compatible" and settings.llm_api_key:
        try:
            return _remote_analysis(incident, evidence, settings)
        except (httpx.HTTPError, KeyError, json.JSONDecodeError, ValueError):
            # A malformed or unavailable model must not block an active incident.
            result = _demo_analysis(incident, evidence)
            return AnalysisResult(
                summary=result.summary,
                hypotheses=result.hypotheses,
                actions=result.actions,
                model_name=f"{settings.llm_model}-fallback",
                input_tokens=result.input_tokens,
                output_tokens=result.output_tokens,
                latency_ms=result.latency_ms,
                provider_mode="fallback-demo",
            )
    return _demo_analysis(incident, evidence)
