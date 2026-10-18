from __future__ import annotations

from datetime import UTC, datetime
from typing import Any

from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.config import Settings
from app.models import (
    Approval,
    ApprovalStatus,
    Incident,
    IncidentStatus,
    Investigation,
    InvestigationStatus,
    RiskLevel,
    User,
)
from app.schemas import ApprovalDecision, EvidenceItem
from app.services.audit import record_audit
from app.services.llm import AnalysisResult, analyze_incident
from app.services.retrieval import search_knowledge


def _similar_incident_context(db: Session, incident: Incident) -> list[dict[str, Any]]:
    rows = db.scalars(
        select(Incident)
        .where(
            Incident.organization_id == incident.organization_id,
            Incident.id != incident.id,
            Incident.service == incident.service,
        )
        .order_by(Incident.started_at.desc())
        .limit(3)
    ).all()
    return [
        {
            "public_id": row.public_id,
            "title": row.title,
            "status": row.status.value,
            "severity": row.severity.value,
        }
        for row in rows
    ]


def create_investigation(
    db: Session,
    *,
    incident: Incident,
    user: User,
    settings: Settings,
    ip_address: str | None = None,
) -> Investigation:
    query = " ".join(
        [
            incident.title,
            incident.description,
            incident.service,
            " ".join(signal.get("name", "") for signal in incident.signals),
        ]
    )
    evidence = search_knowledge(
        db,
        organization_id=incident.organization_id,
        query=query,
        settings=settings,
        limit=6,
    )
    similar = _similar_incident_context(db, incident)
    analysis = enforce_analysis_policy(analyze_incident(incident, evidence, settings), evidence)

    trace = [
        {
            "step": "normalize_incident",
            "status": "completed",
            "details": f"Parsed {len(incident.signals)} operational signals.",
        },
        {
            "step": "retrieve_evidence",
            "status": "completed",
            "details": f"Retrieved {len(evidence)} evidence chunks from verified knowledge.",
        },
        {
            "step": "correlate_history",
            "status": "completed",
            "details": f"Compared {len(similar)} prior incidents for {incident.service}.",
        },
        {
            "step": "generate_hypotheses",
            "status": "completed",
            "details": f"Ranked {len(analysis.hypotheses)} hypotheses.",
        },
        {
            "step": "policy_check",
            "status": "completed",
            "details": "All production-changing actions were routed to human approval.",
        },
    ]
    investigation = Investigation(
        organization_id=incident.organization_id,
        incident_id=incident.id,
        status=InvestigationStatus.COMPLETED,
        summary=analysis.summary,
        hypotheses=[item.model_dump(mode="json") for item in analysis.hypotheses],
        evidence=[item.model_dump(mode="json") for item in evidence],
        actions=[item.model_dump(mode="json") for item in analysis.actions],
        trace=trace,
        model_name=analysis.model_name,
        latency_ms=analysis.latency_ms,
        input_tokens=analysis.input_tokens,
        output_tokens=analysis.output_tokens,
        created_by_id=user.id,
    )
    db.add(investigation)
    db.flush()

    for index, action in enumerate(analysis.actions):
        if action.approval_required:
            db.add(
                Approval(
                    organization_id=incident.organization_id,
                    investigation_id=investigation.id,
                    action_index=index,
                    action_title=action.title,
                    risk_level=action.risk_level,
                )
            )

    if incident.status == IncidentStatus.OPEN:
        incident.status = IncidentStatus.INVESTIGATING
    record_audit(
        db,
        organization_id=incident.organization_id,
        actor_id=user.id,
        action="investigation.completed",
        resource_type="investigation",
        resource_id=investigation.id,
        details={
            "incident_id": incident.public_id,
            "evidence_count": len(evidence),
            "provider_mode": analysis.provider_mode,
            "model": analysis.model_name,
        },
        ip_address=ip_address,
    )
    db.commit()
    db.refresh(investigation)
    return investigation


def decide_approval(
    db: Session,
    *,
    approval: Approval,
    user: User,
    decision: ApprovalDecision,
    ip_address: str | None = None,
) -> Approval:
    if approval.status != ApprovalStatus.PENDING:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Approval has already been decided",
        )

    investigation = db.get(Investigation, approval.investigation_id)
    if investigation is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Investigation not found")

    approval.status = ApprovalStatus(decision.decision)
    approval.decided_by_id = user.id
    approval.decision_note = decision.note
    approval.decided_at = datetime.now(UTC)

    actions = list(investigation.actions)
    if 0 <= approval.action_index < len(actions):
        updated = dict(actions[approval.action_index])
        updated["status"] = decision.decision
        actions[approval.action_index] = updated
        investigation.actions = actions

    record_audit(
        db,
        organization_id=approval.organization_id,
        actor_id=user.id,
        action=f"approval.{decision.decision}",
        resource_type="approval",
        resource_id=approval.id,
        details={
            "action_title": approval.action_title,
            "risk_level": approval.risk_level.value,
            "simulation_only": True,
        },
        ip_address=ip_address,
    )
    db.commit()
    db.refresh(approval)
    return approval


def ensure_policy_invariants(actions: list[dict[str, Any]]) -> None:
    for action in actions:
        if action.get("risk_level") in {
            RiskLevel.MEDIUM.value,
            RiskLevel.HIGH.value,
        } and not action.get("approval_required", False):
            raise ValueError("Medium and high risk actions require human approval")


def enforce_analysis_policy(
    analysis: AnalysisResult,
    evidence: list[EvidenceItem],
) -> AnalysisResult:
    known_evidence_ids = {item.chunk_id for item in evidence}
    fallback_ids = [item.chunk_id for item in evidence[:3]]

    hypotheses = []
    for hypothesis in analysis.hypotheses:
        cited = [item for item in hypothesis.evidence_ids if item in known_evidence_ids]
        hypotheses.append(hypothesis.model_copy(update={"evidence_ids": cited or fallback_ids}))

    actions = []
    for action in analysis.actions:
        cited = [item for item in action.evidence_ids if item in known_evidence_ids]
        requires_approval = action.approval_required or action.risk_level in {
            RiskLevel.MEDIUM,
            RiskLevel.HIGH,
        }
        actions.append(
            action.model_copy(
                update={
                    "evidence_ids": cited or fallback_ids,
                    "approval_required": requires_approval,
                }
            )
        )

    ensure_policy_invariants([action.model_dump(mode="json") for action in actions])
    return AnalysisResult(
        summary=analysis.summary,
        hypotheses=hypotheses,
        actions=actions,
        model_name=analysis.model_name,
        input_tokens=analysis.input_tokens,
        output_tokens=analysis.output_tokens,
        latency_ms=analysis.latency_ms,
        provider_mode=analysis.provider_mode,
    )
