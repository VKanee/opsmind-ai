from fastapi import APIRouter, HTTPException, Query, Request, status
from sqlalchemy import select

from app.dependencies import CurrentUser, DbSession, require_roles
from app.models import Approval, ApprovalStatus, Investigation, Role
from app.schemas import ApprovalDecision, ApprovalResponse, InvestigationResponse
from app.services.investigations import decide_approval

router = APIRouter(tags=["调查与审批"])


@router.get(
    "/investigations/{investigation_id}",
    response_model=InvestigationResponse,
    summary="获取 AI 调查结果",
    description="返回调查摘要、故障假设、证据、处置建议和执行轨迹。",
)
def get_investigation(
    investigation_id: str,
    db: DbSession,
    user: CurrentUser,
) -> InvestigationResponse:
    investigation = db.scalar(
        select(Investigation).where(
            Investigation.id == investigation_id,
            Investigation.organization_id == user.organization_id,
        )
    )
    if investigation is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="调查记录不存在")
    return InvestigationResponse.model_validate(investigation)


@router.get(
    "/approvals",
    response_model=list[ApprovalResponse],
    summary="查询审批队列",
    description="按审批状态查询生产变更建议。",
)
def list_approvals(
    db: DbSession,
    user: CurrentUser,
    approval_status: ApprovalStatus | None = Query(default=None, alias="status"),
) -> list[ApprovalResponse]:
    query = select(Approval).where(Approval.organization_id == user.organization_id)
    if approval_status is not None:
        query = query.where(Approval.status == approval_status)
    rows = db.scalars(query.order_by(Approval.created_at.desc())).all()
    return [ApprovalResponse.model_validate(row) for row in rows]


@router.post(
    "/approvals/{approval_id}/decision",
    response_model=ApprovalResponse,
    summary="提交审批决策",
    description="批准或驳回处置建议，并记录审批说明和审计事件。",
)
def decide(
    approval_id: str,
    payload: ApprovalDecision,
    request: Request,
    db: DbSession,
    user: CurrentUser,
) -> ApprovalResponse:
    require_roles(Role.ADMIN, Role.RESPONDER)(user)
    approval = db.scalar(
        select(Approval).where(
            Approval.id == approval_id,
            Approval.organization_id == user.organization_id,
        )
    )
    if approval is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="审批记录不存在")
    updated = decide_approval(
        db,
        approval=approval,
        user=user,
        decision=payload,
        ip_address=request.client.host if request.client else None,
    )
    return ApprovalResponse.model_validate(updated)
