from typing import Any

from fastapi import APIRouter
from sqlalchemy import func, select

from app.dependencies import CurrentUser, DbSession
from app.models import (
    Approval,
    ApprovalStatus,
    AuditEvent,
    Incident,
    IncidentStatus,
    Investigation,
    KnowledgeDocument,
    Organization,
)
from app.schemas import (
    AuditEventResponse,
    IncidentSummary,
    SystemOverview,
)

router = APIRouter(prefix="/system", tags=["system"])


@router.get("/overview", response_model=SystemOverview)
def overview(db: DbSession, user: CurrentUser) -> SystemOverview:
    organization = db.get(Organization, user.organization_id)
    active_incidents = db.scalar(
        select(func.count(Incident.id)).where(
            Incident.organization_id == user.organization_id,
            Incident.status.not_in([IncidentStatus.MITIGATED, IncidentStatus.RESOLVED]),
        )
    )
    open_approvals = db.scalar(
        select(func.count(Approval.id)).where(
            Approval.organization_id == user.organization_id,
            Approval.status == ApprovalStatus.PENDING,
        )
    )
    documents = db.scalar(
        select(func.count(KnowledgeDocument.id)).where(
            KnowledgeDocument.organization_id == user.organization_id
        )
    )
    investigations = db.scalar(
        select(func.count(Investigation.id)).where(
            Investigation.organization_id == user.organization_id
        )
    )
    with_evidence = db.scalar(
        select(func.count(Investigation.id)).where(
            Investigation.organization_id == user.organization_id,
            func.json_array_length(Investigation.evidence) > 0,
        )
    )
    evidence_coverage = (
        round(float(with_evidence or 0) / float(investigations), 3) if investigations else 0.0
    )

    severity_counts: dict[str, int] = {}
    severity_rows = db.execute(
        select(Incident.severity, func.count(Incident.id))
        .where(Incident.organization_id == user.organization_id)
        .group_by(Incident.severity)
    ).all()
    for severity, count in severity_rows:
        severity_counts[severity.value] = count

    recent_incidents = db.scalars(
        select(Incident)
        .where(Incident.organization_id == user.organization_id)
        .order_by(Incident.started_at.desc())
        .limit(6)
    ).all()
    recent_audit = db.scalars(
        select(AuditEvent)
        .where(AuditEvent.organization_id == user.organization_id)
        .order_by(AuditEvent.created_at.desc())
        .limit(8)
    ).all()

    service_rows = db.execute(
        select(Incident.service, Incident.status, Incident.severity, func.count(Incident.id))
        .where(Incident.organization_id == user.organization_id)
        .group_by(Incident.service, Incident.status, Incident.severity)
    ).all()
    services: dict[str, dict[str, Any]] = {}
    for service, incident_status, severity, count in service_rows:
        item = services.setdefault(
            service,
            {
                "name": service,
                "active": 0,
                "resolved": 0,
                "worst_severity": severity.value,
            },
        )
        if incident_status in {IncidentStatus.OPEN, IncidentStatus.INVESTIGATING}:
            item["active"] = int(item["active"]) + count
        else:
            item["resolved"] = int(item["resolved"]) + count
        if severity.value < str(item["worst_severity"]):
            item["worst_severity"] = severity.value

    return SystemOverview(
        organization_name=organization.name if organization else "Workspace",
        active_incidents=int(active_incidents or 0),
        open_approvals=int(open_approvals or 0),
        knowledge_documents=int(documents or 0),
        investigations=int(investigations or 0),
        evidence_coverage=evidence_coverage,
        severity_counts=severity_counts,
        recent_incidents=[IncidentSummary.model_validate(row) for row in recent_incidents],
        recent_audit=[AuditEventResponse.model_validate(row) for row in recent_audit],
        services=list(services.values()),
    )
