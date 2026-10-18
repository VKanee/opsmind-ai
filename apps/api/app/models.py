from __future__ import annotations

import enum
import uuid
from datetime import UTC, datetime
from typing import Any

from sqlalchemy import (
    JSON,
    Boolean,
    DateTime,
    Enum,
    ForeignKey,
    Index,
    Integer,
    String,
    Text,
    UniqueConstraint,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db import Base


def utc_now() -> datetime:
    return datetime.now(UTC)


def new_id() -> str:
    return str(uuid.uuid4())


class Role(enum.StrEnum):
    ADMIN = "admin"
    RESPONDER = "responder"
    VIEWER = "viewer"


class Severity(enum.StrEnum):
    SEV1 = "sev1"
    SEV2 = "sev2"
    SEV3 = "sev3"
    SEV4 = "sev4"


class IncidentStatus(enum.StrEnum):
    OPEN = "open"
    INVESTIGATING = "investigating"
    MITIGATED = "mitigated"
    RESOLVED = "resolved"


class SourceType(enum.StrEnum):
    RUNBOOK = "runbook"
    POSTMORTEM = "postmortem"
    SERVICE_DOC = "service_doc"
    POLICY = "policy"


class InvestigationStatus(enum.StrEnum):
    COMPLETED = "completed"
    FAILED = "failed"


class ApprovalStatus(enum.StrEnum):
    PENDING = "pending"
    APPROVED = "approved"
    REJECTED = "rejected"


class RiskLevel(enum.StrEnum):
    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"


class TimestampMixin:
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utc_now)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=utc_now, onupdate=utc_now
    )


class Organization(Base, TimestampMixin):
    __tablename__ = "organizations"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=new_id)
    name: Mapped[str] = mapped_column(String(160))
    slug: Mapped[str] = mapped_column(String(80), unique=True, index=True)


class User(Base, TimestampMixin):
    __tablename__ = "users"
    __table_args__ = (UniqueConstraint("organization_id", "email", name="uq_user_org_email"),)

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=new_id)
    organization_id: Mapped[str] = mapped_column(
        ForeignKey("organizations.id", ondelete="CASCADE"), index=True
    )
    email: Mapped[str] = mapped_column(String(255), index=True)
    display_name: Mapped[str] = mapped_column(String(120))
    password_hash: Mapped[str] = mapped_column(String(255))
    role: Mapped[Role] = mapped_column(Enum(Role, native_enum=False), default=Role.VIEWER)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)

    organization: Mapped[Organization] = relationship()


class Incident(Base, TimestampMixin):
    __tablename__ = "incidents"
    __table_args__ = (
        UniqueConstraint("organization_id", "public_id", name="uq_incident_org_public_id"),
        Index("ix_incident_org_status", "organization_id", "status"),
    )

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=new_id)
    organization_id: Mapped[str] = mapped_column(
        ForeignKey("organizations.id", ondelete="CASCADE"), index=True
    )
    public_id: Mapped[str] = mapped_column(String(32), index=True)
    title: Mapped[str] = mapped_column(String(240))
    description: Mapped[str] = mapped_column(Text)
    service: Mapped[str] = mapped_column(String(120), index=True)
    severity: Mapped[Severity] = mapped_column(Enum(Severity, native_enum=False))
    status: Mapped[IncidentStatus] = mapped_column(
        Enum(IncidentStatus, native_enum=False), default=IncidentStatus.OPEN
    )
    owner_id: Mapped[str | None] = mapped_column(
        ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )
    created_by_id: Mapped[str] = mapped_column(ForeignKey("users.id", ondelete="RESTRICT"))
    started_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utc_now)
    detected_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utc_now)
    resolved_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    tags: Mapped[list[str]] = mapped_column(JSON, default=list)
    signals: Mapped[list[dict[str, Any]]] = mapped_column(JSON, default=list)

    owner: Mapped[User | None] = relationship(foreign_keys=[owner_id], lazy="joined")
    investigations: Mapped[list[Investigation]] = relationship(
        back_populates="incident", cascade="all, delete-orphan"
    )

    @property
    def owner_name(self) -> str | None:
        return self.owner.display_name if self.owner is not None else None


class KnowledgeDocument(Base, TimestampMixin):
    __tablename__ = "knowledge_documents"
    __table_args__ = (Index("ix_document_org_source", "organization_id", "source_type"),)

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=new_id)
    organization_id: Mapped[str] = mapped_column(
        ForeignKey("organizations.id", ondelete="CASCADE"), index=True
    )
    title: Mapped[str] = mapped_column(String(240))
    source_type: Mapped[SourceType] = mapped_column(Enum(SourceType, native_enum=False))
    content: Mapped[str] = mapped_column(Text)
    tags: Mapped[list[str]] = mapped_column(JSON, default=list)
    version: Mapped[int] = mapped_column(Integer, default=1)
    trust_level: Mapped[str] = mapped_column(String(32), default="verified")
    created_by_id: Mapped[str] = mapped_column(ForeignKey("users.id", ondelete="RESTRICT"))

    chunks: Mapped[list[KnowledgeChunk]] = relationship(
        back_populates="document", cascade="all, delete-orphan"
    )


class KnowledgeChunk(Base):
    __tablename__ = "knowledge_chunks"
    __table_args__ = (Index("ix_chunk_org_document", "organization_id", "document_id"),)

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=new_id)
    organization_id: Mapped[str] = mapped_column(
        ForeignKey("organizations.id", ondelete="CASCADE"), index=True
    )
    document_id: Mapped[str] = mapped_column(
        ForeignKey("knowledge_documents.id", ondelete="CASCADE"), index=True
    )
    ordinal: Mapped[int] = mapped_column(Integer)
    content: Mapped[str] = mapped_column(Text)
    embedding: Mapped[list[float]] = mapped_column(JSON)

    document: Mapped[KnowledgeDocument] = relationship(back_populates="chunks")


class Investigation(Base, TimestampMixin):
    __tablename__ = "investigations"
    __table_args__ = (Index("ix_investigation_org_incident", "organization_id", "incident_id"),)

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=new_id)
    organization_id: Mapped[str] = mapped_column(
        ForeignKey("organizations.id", ondelete="CASCADE"), index=True
    )
    incident_id: Mapped[str] = mapped_column(
        ForeignKey("incidents.id", ondelete="CASCADE"), index=True
    )
    status: Mapped[InvestigationStatus] = mapped_column(
        Enum(InvestigationStatus, native_enum=False),
        default=InvestigationStatus.COMPLETED,
    )
    summary: Mapped[str] = mapped_column(Text)
    hypotheses: Mapped[list[dict[str, Any]]] = mapped_column(JSON, default=list)
    evidence: Mapped[list[dict[str, Any]]] = mapped_column(JSON, default=list)
    actions: Mapped[list[dict[str, Any]]] = mapped_column(JSON, default=list)
    trace: Mapped[list[dict[str, Any]]] = mapped_column(JSON, default=list)
    model_name: Mapped[str] = mapped_column(String(120))
    prompt_version: Mapped[str] = mapped_column(String(32), default="rca-v1")
    latency_ms: Mapped[int] = mapped_column(Integer)
    input_tokens: Mapped[int] = mapped_column(Integer, default=0)
    output_tokens: Mapped[int] = mapped_column(Integer, default=0)
    created_by_id: Mapped[str] = mapped_column(ForeignKey("users.id", ondelete="RESTRICT"))

    incident: Mapped[Incident] = relationship(back_populates="investigations")
    approvals: Mapped[list[Approval]] = relationship(
        back_populates="investigation", cascade="all, delete-orphan"
    )


class Approval(Base, TimestampMixin):
    __tablename__ = "approvals"
    __table_args__ = (
        Index("ix_approval_org_status", "organization_id", "status"),
        UniqueConstraint("investigation_id", "action_index", name="uq_approval_action"),
    )

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=new_id)
    organization_id: Mapped[str] = mapped_column(
        ForeignKey("organizations.id", ondelete="CASCADE"), index=True
    )
    investigation_id: Mapped[str] = mapped_column(
        ForeignKey("investigations.id", ondelete="CASCADE"), index=True
    )
    action_index: Mapped[int] = mapped_column(Integer)
    action_title: Mapped[str] = mapped_column(String(240))
    risk_level: Mapped[RiskLevel] = mapped_column(Enum(RiskLevel, native_enum=False))
    status: Mapped[ApprovalStatus] = mapped_column(
        Enum(ApprovalStatus, native_enum=False), default=ApprovalStatus.PENDING
    )
    decided_by_id: Mapped[str | None] = mapped_column(
        ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )
    decision_note: Mapped[str | None] = mapped_column(Text, nullable=True)
    decided_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    investigation: Mapped[Investigation] = relationship(back_populates="approvals")
    decided_by: Mapped[User | None] = relationship()


class AuditEvent(Base):
    __tablename__ = "audit_events"
    __table_args__ = (Index("ix_audit_org_created", "organization_id", "created_at"),)

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=new_id)
    organization_id: Mapped[str] = mapped_column(
        ForeignKey("organizations.id", ondelete="CASCADE"), index=True
    )
    actor_id: Mapped[str | None] = mapped_column(
        ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )
    action: Mapped[str] = mapped_column(String(120), index=True)
    resource_type: Mapped[str] = mapped_column(String(80))
    resource_id: Mapped[str] = mapped_column(String(80))
    details: Mapped[dict[str, Any]] = mapped_column(JSON, default=dict)
    ip_address: Mapped[str | None] = mapped_column(String(64), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utc_now)
