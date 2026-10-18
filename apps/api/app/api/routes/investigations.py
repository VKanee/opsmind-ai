from fastapi import APIRouter, HTTPException, Query, Request, status
from sqlalchemy import select

from app.dependencies import CurrentUser, DbSession, require_roles
from app.models import Approval, ApprovalStatus, Investigation, Role
from app.schemas import ApprovalDecision, ApprovalResponse, InvestigationResponse
from app.services.investigations import decide_approval

router = APIRouter(tags=["investigations"])


@router.get("/investigations/{investigation_id}", response_model=InvestigationResponse)
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
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Investigation not found")
    return InvestigationResponse.model_validate(investigation)


@router.get("/approvals", response_model=list[ApprovalResponse])
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


@router.post("/approvals/{approval_id}/decision", response_model=ApprovalResponse)
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
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Approval not found")
    updated = decide_approval(
        db,
        approval=approval,
        user=user,
        decision=payload,
        ip_address=request.client.host if request.client else None,
    )
    return ApprovalResponse.model_validate(updated)
