from datetime import UTC, datetime, timedelta

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.config import Settings
from app.models import (
    Incident,
    IncidentStatus,
    KnowledgeDocument,
    Organization,
    Role,
    Severity,
    SourceType,
    User,
)
from app.security import hash_password
from app.services.investigations import create_investigation
from app.services.retrieval import index_document


def ensure_seed_data(db: Session, settings: Settings) -> None:
    existing = db.scalar(select(Organization).limit(1))
    if existing is not None:
        return

    organization = Organization(name="Acme Cloud", slug="acme-cloud")
    db.add(organization)
    db.flush()

    password_hash = hash_password(settings.demo_user_password)
    admin = User(
        organization_id=organization.id,
        email="admin@opsmind.local",
        display_name="Maya Chen",
        password_hash=password_hash,
        role=Role.ADMIN,
    )
    responder = User(
        organization_id=organization.id,
        email="responder@opsmind.local",
        display_name="Noah Williams",
        password_hash=password_hash,
        role=Role.RESPONDER,
    )
    viewer = User(
        organization_id=organization.id,
        email="viewer@opsmind.local",
        display_name="Priya Shah",
        password_hash=password_hash,
        role=Role.VIEWER,
    )
    db.add_all([admin, responder, viewer])
    db.flush()

    documents = [
        KnowledgeDocument(
            organization_id=organization.id,
            title="Checkout latency runbook",
            source_type=SourceType.RUNBOOK,
            tags=["checkout", "latency", "database", "rollback"],
            created_by_id=admin.id,
            content=(
                "Trigger: checkout-api p95 latency exceeds 1.5 seconds for five minutes or the "
                "error rate exceeds 2 percent.\n\n"
                "First checks: compare the release marker with the latency onset, inspect database "
                "connection-pool wait time, and compare the current version with the previous "
                "stable release. A pool wait time above 250 milliseconds indicates connection "
                "saturation.\n\n"
                "Containment: route health checks separately, reduce non-critical checkout traffic "
                "with the edge rate limit, and preserve payment callbacks. Do not restart the "
                "database during an active checkout surge.\n\n"
                "Recovery: roll back checkout-api when latency correlates with a deployment and "
                "the previous release has a healthy error budget. Confirm p95 latency below 600 "
                "milliseconds for ten minutes before declaring mitigation."
            ),
        ),
        KnowledgeDocument(
            organization_id=organization.id,
            title="Checkout service dependency map",
            source_type=SourceType.SERVICE_DOC,
            tags=["checkout", "architecture", "payment", "database"],
            created_by_id=admin.id,
            content=(
                "checkout-api owns cart validation, pricing, order creation, and payment "
                "orchestration. It calls pricing-cache, inventory-api, payment-gateway, and the "
                "orders PostgreSQL cluster.\n\n"
                "The critical path uses a 300 millisecond payment-gateway timeout and a 1.2 second "
                "checkout deadline. Connection pools are limited to 40 connections per pod. "
                "Circuit breakers open after ten consecutive upstream failures.\n\n"
                "Payment callbacks must remain enabled during traffic shedding because duplicate "
                "callbacks are deduplicated by order token. Search and recommendation calls are "
                "non-critical and may be disabled first."
            ),
        ),
        KnowledgeDocument(
            organization_id=organization.id,
            title="Payment gateway timeout postmortem",
            source_type=SourceType.POSTMORTEM,
            tags=["payment", "timeout", "upstream", "postmortem"],
            created_by_id=admin.id,
            content=(
                "A regional payment provider introduced elevated response times after a routine "
                "maintenance window. Requests exceeded the checkout deadline and connection pools "
                "filled with blocked payment calls.\n\n"
                "The incident was mitigated by enabling the payment circuit breaker, reducing "
                "checkout concurrency, and routing eligible traffic to the secondary provider. "
                "The durable fix separated payment timeout budgets from the checkout request "
                "budget and added provider-specific saturation alerts.\n\n"
                "Lessons learned: dependency latency must be visible independently from checkout "
                "latency, and retries must use jitter with a strict retry budget."
            ),
        ),
        KnowledgeDocument(
            organization_id=organization.id,
            title="Production change and rollback policy",
            source_type=SourceType.POLICY,
            tags=["change", "rollback", "approval", "governance"],
            created_by_id=admin.id,
            content=(
                "All production-changing recommendations generated by an AI assistant require "
                "human approval. High-risk actions require a responder or administrator and an "
                "auditable decision note.\n\n"
                "Rollback is preferred when a deployment time boundary aligns with symptom onset "
                "and no forward fix has been validated in staging. Traffic shedding may be used "
                "as a reversible containment step. Direct database failover is restricted to the "
                "on-call database administrator.\n\n"
                "Every approved or rejected action must record the actor, timestamp, rationale, "
                "and the evidence used by the investigation."
            ),
        ),
        KnowledgeDocument(
            organization_id=organization.id,
            title="Search replication recovery guide",
            source_type=SourceType.RUNBOOK,
            tags=["search", "replication", "lag"],
            created_by_id=admin.id,
            content=(
                "When search index replication lag exceeds 60 seconds, verify ingestion queue "
                "depth and indexer CPU before modifying traffic. Pause non-essential backfills, "
                "increase indexer concurrency one step at a time, and route stale queries to the "
                "last known healthy shard.\n\n"
                "The recovery threshold is replication lag below five seconds for fifteen minutes "
                "with stable queue depth."
            ),
        ),
    ]
    db.add_all(documents)
    db.flush()
    for document in documents:
        index_document(db, document, settings=settings)

    now = datetime.now(UTC)
    incidents = [
        Incident(
            organization_id=organization.id,
            public_id="INC-2026-1042",
            title="Checkout API latency spike after release",
            description=(
                "Checkout p95 latency increased from 240 ms to 4.8 s after checkout-api "
                "2026.10.17.3 reached 60 percent of production. Database pool wait time is rising "
                "and users are reporting abandoned carts. Payment callbacks are still healthy."
            ),
            service="checkout-api",
            severity=Severity.SEV1,
            status=IncidentStatus.INVESTIGATING,
            owner_id=responder.id,
            created_by_id=responder.id,
            started_at=now - timedelta(minutes=42),
            detected_at=now - timedelta(minutes=38),
            tags=["release", "latency", "customer-impact"],
            signals=[
                {"name": "p95 latency", "value": "4.8", "unit": "s", "status": "critical"},
                {"name": "error rate", "value": "7.2", "unit": "%", "status": "warning"},
                {"name": "db pool wait", "value": "680", "unit": "ms", "status": "critical"},
            ],
        ),
        Incident(
            organization_id=organization.id,
            public_id="INC-2026-1041",
            title="Payment provider timeout cascade",
            description=(
                "A regional payment provider is responding more slowly than usual. Checkout "
                "circuit breakers have started opening and retry volume is increasing."
            ),
            service="payment-gateway",
            severity=Severity.SEV2,
            status=IncidentStatus.OPEN,
            owner_id=responder.id,
            created_by_id=admin.id,
            started_at=now - timedelta(minutes=17),
            detected_at=now - timedelta(minutes=14),
            tags=["payment", "upstream", "timeout"],
            signals=[
                {"name": "provider p99", "value": "3.1", "unit": "s", "status": "critical"},
                {"name": "retry rate", "value": "34", "unit": "%", "status": "warning"},
            ],
        ),
        Incident(
            organization_id=organization.id,
            public_id="INC-2026-1038",
            title="Search index replication lag",
            description="Index replication lag briefly exceeded the freshness objective.",
            service="search-index",
            severity=Severity.SEV3,
            status=IncidentStatus.RESOLVED,
            owner_id=responder.id,
            created_by_id=admin.id,
            started_at=now - timedelta(days=2),
            detected_at=now - timedelta(days=2, minutes=4),
            resolved_at=now - timedelta(days=2, minutes=51),
            tags=["search", "replication"],
            signals=[
                {"name": "replication lag", "value": "94", "unit": "s", "status": "warning"},
            ],
        ),
        Incident(
            organization_id=organization.id,
            public_id="INC-2026-1034",
            title="Authentication error rate increase",
            description=(
                "Authentication failures increased after a certificate rotation. A subset of "
                "mobile clients continued to use the previous certificate bundle."
            ),
            service="identity-api",
            severity=Severity.SEV2,
            status=IncidentStatus.RESOLVED,
            owner_id=responder.id,
            created_by_id=admin.id,
            started_at=now - timedelta(days=8),
            detected_at=now - timedelta(days=8, minutes=2),
            resolved_at=now - timedelta(days=8, hours=-1),
            tags=["authentication", "certificate"],
            signals=[
                {"name": "auth 5xx", "value": "12.4", "unit": "%", "status": "critical"},
            ],
        ),
    ]
    db.add_all(incidents)
    db.commit()

    db.refresh(incidents[0])
    create_investigation(db, incident=incidents[0], user=admin, settings=settings)
