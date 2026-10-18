from fastapi import APIRouter, Query
from sqlalchemy import select

from app.dependencies import CurrentUser, DbSession
from app.models import AuditEvent
from app.schemas import AuditEventResponse

router = APIRouter(prefix="/audit", tags=["审计日志"])


@router.get("/events", response_model=list[AuditEventResponse])
def list_audit_events(
    db: DbSession,
    user: CurrentUser,
    limit: int = Query(default=100, ge=1, le=500),
) -> list[AuditEventResponse]:
    rows = db.scalars(
        select(AuditEvent)
        .where(AuditEvent.organization_id == user.organization_id)
        .order_by(AuditEvent.created_at.desc())
        .limit(limit)
    ).all()
    return [AuditEventResponse.model_validate(row) for row in rows]
