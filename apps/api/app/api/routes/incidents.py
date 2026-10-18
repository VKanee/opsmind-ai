from datetime import UTC, datetime
from secrets import token_hex

from fastapi import APIRouter, HTTPException, Query, Request, status
from sqlalchemy import select

from app.dependencies import CurrentUser, DbSession, require_roles
from app.models import Incident, IncidentStatus, Investigation, Role, Severity, User
from app.schemas import IncidentCreate, IncidentResponse, IncidentUpdate, InvestigationResponse
from app.services.audit import record_audit
from app.services.investigations import create_investigation

router = APIRouter(prefix="/incidents", tags=["incidents"])


def _get_incident(db: DbSession, user: CurrentUser, incident_id: str) -> Incident:
    incident = db.scalar(
        select(Incident).where(
            Incident.id == incident_id,
            Incident.organization_id == user.organization_id,
        )
    )
    if incident is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Incident not found")
    return incident


def _new_public_id() -> str:
    year = datetime.now(UTC).year
    return f"INC-{year}-{token_hex(3).upper()}"


@router.get("", response_model=list[IncidentResponse])
def list_incidents(
    db: DbSession,
    user: CurrentUser,
    incident_status: IncidentStatus | None = Query(default=None, alias="status"),
    severity: Severity | None = None,
    limit: int = Query(default=50, ge=1, le=200),
) -> list[IncidentResponse]:
    query = select(Incident).where(Incident.organization_id == user.organization_id)
    if incident_status is not None:
        query = query.where(Incident.status == incident_status)
    if severity is not None:
        query = query.where(Incident.severity == severity)
    rows = db.scalars(query.order_by(Incident.started_at.desc()).limit(limit)).all()
    return [IncidentResponse.model_validate(row) for row in rows]


@router.post("", response_model=IncidentResponse, status_code=status.HTTP_201_CREATED)
def create_incident(
    payload: IncidentCreate,
    request: Request,
    db: DbSession,
    user: CurrentUser,
) -> IncidentResponse:
    require_roles(Role.ADMIN, Role.RESPONDER)(user)
    now = datetime.now(UTC)
    incident = Incident(
        organization_id=user.organization_id,
        public_id=_new_public_id(),
        title=payload.title,
        description=payload.description,
        service=payload.service,
        severity=payload.severity,
        status=payload.status,
        created_by_id=user.id,
        started_at=payload.started_at or now,
        detected_at=now,
        tags=payload.tags,
        signals=[signal.model_dump(mode="json") for signal in payload.signals],
    )
    db.add(incident)
    db.flush()
    record_audit(
        db,
        organization_id=user.organization_id,
        actor_id=user.id,
        action="incident.created",
        resource_type="incident",
        resource_id=incident.id,
        details={"public_id": incident.public_id, "severity": incident.severity.value},
        ip_address=request.client.host if request.client else None,
    )
    db.commit()
    db.refresh(incident)
    return IncidentResponse.model_validate(incident)


@router.get("/{incident_id}", response_model=IncidentResponse)
def get_incident(incident_id: str, db: DbSession, user: CurrentUser) -> IncidentResponse:
    return IncidentResponse.model_validate(_get_incident(db, user, incident_id))


@router.patch("/{incident_id}", response_model=IncidentResponse)
def update_incident(
    incident_id: str,
    payload: IncidentUpdate,
    request: Request,
    db: DbSession,
    user: CurrentUser,
) -> IncidentResponse:
    require_roles(Role.ADMIN, Role.RESPONDER)(user)
    incident = _get_incident(db, user, incident_id)
    changes = payload.model_dump(exclude_unset=True)
    if "signals" in changes:
        changes["signals"] = [signal.model_dump(mode="json") for signal in payload.signals or []]
    if payload.owner_id is not None:
        owner = db.scalar(
            select(User).where(
                User.id == payload.owner_id,
                User.organization_id == user.organization_id,
                User.is_active.is_(True),
            )
        )
        if owner is None:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail="Owner must be an active user in this organization",
            )
    for field, value in changes.items():
        setattr(incident, field, value)
    if payload.status in {IncidentStatus.MITIGATED, IncidentStatus.RESOLVED}:
        incident.resolved_at = datetime.now(UTC)
    elif payload.status in {IncidentStatus.OPEN, IncidentStatus.INVESTIGATING}:
        incident.resolved_at = None
    record_audit(
        db,
        organization_id=user.organization_id,
        actor_id=user.id,
        action="incident.updated",
        resource_type="incident",
        resource_id=incident.id,
        details={"fields": sorted(changes)},
        ip_address=request.client.host if request.client else None,
    )
    db.commit()
    db.refresh(incident)
    return IncidentResponse.model_validate(incident)


@router.get("/{incident_id}/investigations", response_model=list[InvestigationResponse])
def list_investigations(
    incident_id: str,
    db: DbSession,
    user: CurrentUser,
) -> list[InvestigationResponse]:
    incident = _get_incident(db, user, incident_id)
    rows = db.scalars(
        select(Investigation)
        .where(
            Investigation.incident_id == incident.id,
            Investigation.organization_id == user.organization_id,
        )
        .order_by(Investigation.created_at.desc())
    ).all()
    return [InvestigationResponse.model_validate(row) for row in rows]


@router.post(
    "/{incident_id}/investigations",
    response_model=InvestigationResponse,
    status_code=status.HTTP_201_CREATED,
)
def run_investigation(
    incident_id: str,
    request: Request,
    db: DbSession,
    user: CurrentUser,
) -> InvestigationResponse:
    require_roles(Role.ADMIN, Role.RESPONDER)(user)
    incident = _get_incident(db, user, incident_id)
    investigation = create_investigation(
        db,
        incident=incident,
        user=user,
        settings=request.app.state.settings,
        ip_address=request.client.host if request.client else None,
    )
    return InvestigationResponse.model_validate(investigation)
