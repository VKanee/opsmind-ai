from typing import Any

from sqlalchemy.orm import Session

from app.models import AuditEvent


def record_audit(
    db: Session,
    *,
    organization_id: str,
    actor_id: str | None,
    action: str,
    resource_type: str,
    resource_id: str,
    details: dict[str, Any] | None = None,
    ip_address: str | None = None,
) -> AuditEvent:
    event = AuditEvent(
        organization_id=organization_id,
        actor_id=actor_id,
        action=action,
        resource_type=resource_type,
        resource_id=resource_id,
        details=details or {},
        ip_address=ip_address,
    )
    db.add(event)
    return event
