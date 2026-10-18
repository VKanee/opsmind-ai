from fastapi.testclient import TestClient

from app.models import RiskLevel, SourceType
from app.schemas import EvidenceItem, Hypothesis, RecommendedAction
from app.services.investigations import enforce_analysis_policy
from app.services.llm import AnalysisResult
from tests.conftest import login


def test_investigation_is_evidence_backed_and_requires_approval(client: TestClient) -> None:
    headers = login(client)
    incidents = client.get("/api/v1/incidents", headers=headers).json()
    incident = next(item for item in incidents if item["public_id"] == "INC-2026-1042")

    response = client.post(
        f"/api/v1/incidents/{incident['id']}/investigations",
        headers=headers,
    )
    assert response.status_code == 201
    investigation = response.json()
    assert investigation["status"] == "completed"
    assert investigation["summary"]
    assert investigation["evidence"]
    assert investigation["hypotheses"]
    assert any(action["approval_required"] for action in investigation["actions"])
    assert investigation["trace"][-1]["step"] == "policy_check"

    approvals = client.get("/api/v1/approvals?status=pending", headers=headers)
    assert approvals.status_code == 200
    matching = [
        item for item in approvals.json() if item["investigation_id"] == investigation["id"]
    ]
    assert matching

    approved = client.post(
        f"/api/v1/approvals/{matching[0]['id']}/decision",
        headers=headers,
        json={"decision": "approved", "note": "Validated against the release boundary."},
    )
    assert approved.status_code == 200
    assert approved.json()["status"] == "approved"

    repeated = client.post(
        f"/api/v1/approvals/{matching[0]['id']}/decision",
        headers=headers,
        json={"decision": "rejected"},
    )
    assert repeated.status_code == 409


def test_audit_trail_records_investigation_and_decision(client: TestClient) -> None:
    headers = login(client)
    response = client.get("/api/v1/audit/events?limit=100", headers=headers)
    assert response.status_code == 200
    actions = {item["action"] for item in response.json()}
    assert "investigation.completed" in actions
    assert "auth.login" in actions


def test_model_output_cannot_bypass_citation_or_approval_policy() -> None:
    evidence = [
        EvidenceItem(
            chunk_id="known-chunk",
            document_id="doc-1",
            document_title="Checkout runbook",
            source_type=SourceType.RUNBOOK,
            snippet="Use the documented rollback procedure.",
            relevance_score=0.9,
        )
    ]
    analysis = AnalysisResult(
        summary="Synthetic model response",
        hypotheses=[
            Hypothesis(
                id="hyp-1",
                title="Unsafe citation",
                confidence=0.9,
                rationale="References evidence that was not retrieved.",
                evidence_ids=["fabricated-evidence"],
            )
        ],
        actions=[
            RecommendedAction(
                id="action-1",
                title="Restart the database",
                description="A high-risk response that incorrectly bypasses approval.",
                risk_level=RiskLevel.HIGH,
                approval_required=False,
                evidence_ids=["fabricated-evidence"],
            )
        ],
        model_name="test-model",
        input_tokens=10,
        output_tokens=10,
        latency_ms=1,
        provider_mode="test",
    )

    normalized = enforce_analysis_policy(analysis, evidence)
    assert normalized.hypotheses[0].evidence_ids == ["known-chunk"]
    assert normalized.actions[0].evidence_ids == ["known-chunk"]
    assert normalized.actions[0].approval_required is True
