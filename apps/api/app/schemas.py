from __future__ import annotations

from datetime import datetime
from typing import Any, Literal

from pydantic import BaseModel, ConfigDict, Field, field_validator

from app.models import (
    ApprovalStatus,
    IncidentStatus,
    InvestigationStatus,
    RiskLevel,
    Role,
    Severity,
    SourceType,
)


class APIModel(BaseModel):
    model_config = ConfigDict(from_attributes=True)


class LoginRequest(BaseModel):
    organization_slug: str = "acme-cloud"
    email: str
    password: str = Field(min_length=8, max_length=200)


class UserResponse(APIModel):
    id: str
    organization_id: str
    email: str
    display_name: str
    role: Role


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    expires_in: int
    user: UserResponse


class Signal(BaseModel):
    name: str
    value: str
    unit: str | None = None
    status: Literal["normal", "warning", "critical"] = "normal"


class IncidentCreate(BaseModel):
    title: str = Field(min_length=4, max_length=240)
    description: str = Field(min_length=10)
    service: str = Field(min_length=2, max_length=120)
    severity: Severity = Severity.SEV3
    status: IncidentStatus = IncidentStatus.OPEN
    started_at: datetime | None = None
    tags: list[str] = Field(default_factory=list)
    signals: list[Signal] = Field(default_factory=list)


class IncidentUpdate(BaseModel):
    title: str | None = Field(default=None, min_length=4, max_length=240)
    description: str | None = Field(default=None, min_length=10)
    severity: Severity | None = None
    status: IncidentStatus | None = None
    owner_id: str | None = None
    tags: list[str] | None = None
    signals: list[Signal] | None = None

    @field_validator("title", "description", "severity", "status")
    @classmethod
    def reject_null_required_fields(cls, value: Any) -> Any:
        if value is None:
            raise ValueError("field cannot be null")
        return value


class IncidentResponse(APIModel):
    id: str
    public_id: str
    title: str
    description: str
    service: str
    severity: Severity
    status: IncidentStatus
    owner_id: str | None
    owner_name: str | None
    started_at: datetime
    detected_at: datetime
    resolved_at: datetime | None
    tags: list[str]
    signals: list[Signal]
    created_at: datetime
    updated_at: datetime


class KnowledgeDocumentCreate(BaseModel):
    title: str = Field(min_length=4, max_length=240)
    source_type: SourceType
    content: str = Field(min_length=40)
    tags: list[str] = Field(default_factory=list)
    trust_level: Literal["verified", "draft", "deprecated"] = "verified"


class KnowledgeDocumentResponse(APIModel):
    id: str
    title: str
    source_type: SourceType
    content: str
    tags: list[str]
    version: int
    trust_level: str
    created_at: datetime
    updated_at: datetime


class EvidenceItem(BaseModel):
    chunk_id: str
    document_id: str
    document_title: str
    source_type: SourceType
    snippet: str
    relevance_score: float = Field(ge=0, le=1)


class Hypothesis(BaseModel):
    id: str
    title: str
    confidence: float = Field(ge=0, le=1)
    rationale: str
    evidence_ids: list[str] = Field(default_factory=list)


class RecommendedAction(BaseModel):
    id: str
    title: str
    description: str
    risk_level: RiskLevel
    approval_required: bool = True
    evidence_ids: list[str] = Field(default_factory=list)
    status: Literal["proposed", "approved", "rejected"] = "proposed"
    simulation_only: bool = True


class InvestigationResponse(APIModel):
    id: str
    incident_id: str
    status: InvestigationStatus
    summary: str
    hypotheses: list[Hypothesis]
    evidence: list[EvidenceItem]
    actions: list[RecommendedAction]
    trace: list[dict[str, Any]]
    model_name: str
    prompt_version: str
    latency_ms: int
    input_tokens: int
    output_tokens: int
    created_by_id: str
    created_at: datetime


class ApprovalDecision(BaseModel):
    decision: Literal["approved", "rejected"]
    note: str | None = Field(default=None, max_length=1000)


class ApprovalResponse(APIModel):
    id: str
    investigation_id: str
    action_index: int
    action_title: str
    risk_level: RiskLevel
    status: ApprovalStatus
    decision_note: str | None
    decided_at: datetime | None
    created_at: datetime


class AuditEventResponse(APIModel):
    id: str
    actor_id: str | None
    action: str
    resource_type: str
    resource_id: str
    details: dict[str, Any]
    ip_address: str | None
    created_at: datetime


class SearchRequest(BaseModel):
    query: str = Field(min_length=2, max_length=1000)
    limit: int = Field(default=6, ge=1, le=20)


class SearchResponse(BaseModel):
    query: str
    results: list[EvidenceItem]


class IncidentSummary(APIModel):
    id: str
    public_id: str
    title: str
    service: str
    severity: Severity
    status: IncidentStatus
    started_at: datetime


class SystemOverview(BaseModel):
    organization_name: str
    active_incidents: int
    open_approvals: int
    knowledge_documents: int
    investigations: int
    evidence_coverage: float
    severity_counts: dict[str, int]
    recent_incidents: list[IncidentSummary]
    recent_audit: list[AuditEventResponse]
    services: list[dict[str, Any]]
