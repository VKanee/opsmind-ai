from __future__ import annotations

import json
import time
from dataclasses import dataclass
from typing import Any

import httpx

from app.config import Settings
from app.models import Incident, RiskLevel
from app.schemas import EvidenceItem, Hypothesis, RecommendedAction


@dataclass(frozen=True)
class AnalysisResult:
    summary: str
    hypotheses: list[Hypothesis]
    actions: list[RecommendedAction]
    model_name: str
    input_tokens: int
    output_tokens: int
    latency_ms: int
    provider_mode: str


def _evidence_ids(evidence: list[EvidenceItem], limit: int = 3) -> list[str]:
    return [item.chunk_id for item in evidence[:limit]]


def _demo_analysis(incident: Incident, evidence: list[EvidenceItem]) -> AnalysisResult:
    started = time.perf_counter()
    text = " ".join(
        [
            incident.title,
            incident.description,
            " ".join(signal.get("name", "") for signal in incident.signals),
            " ".join(incident.tags),
        ]
    ).lower()
    evidence_ids = _evidence_ids(evidence)
    hypotheses: list[Hypothesis] = []

    if any(term in text for term in ("deploy", "release", "rollout", "canary")):
        hypotheses.append(
            Hypothesis(
                id="hyp-deployment",
                title="Recent deployment regression",
                confidence=0.86,
                rationale=(
                    "The incident overlaps with a recent rollout and symptoms affect a "
                    "single request path, which is consistent with a regression introduced "
                    "by the new release."
                ),
                evidence_ids=evidence_ids,
            )
        )
    if any(term in text for term in ("latency", "timeout", "database", "connection", "pool")):
        hypotheses.append(
            Hypothesis(
                id="hyp-database",
                title="Database connection pool saturation",
                confidence=0.74,
                rationale=(
                    "Rising request latency and timeout signals align with exhausted database "
                    "connections; the runbook identifies pool wait time as the primary indicator."
                ),
                evidence_ids=evidence_ids,
            )
        )
    if any(term in text for term in ("payment", "upstream", "dependency", "provider", "5xx")):
        hypotheses.append(
            Hypothesis(
                id="hyp-upstream",
                title="Upstream dependency degradation",
                confidence=0.68,
                rationale=(
                    "The failure profile indicates that a downstream provider may be returning "
                    "errors or exhausting its timeout budget."
                ),
                evidence_ids=evidence_ids,
            )
        )
    if any(term in text for term in ("memory", "cpu", "saturation", "oom")):
        hypotheses.append(
            Hypothesis(
                id="hyp-capacity",
                title="Compute or memory capacity saturation",
                confidence=0.63,
                rationale=(
                    "Resource pressure is present in the incident signals and could amplify "
                    "failures."
                ),
                evidence_ids=evidence_ids,
            )
        )
    if not hypotheses:
        hypotheses.append(
            Hypothesis(
                id="hyp-generic",
                title="Service-level failure requiring telemetry correlation",
                confidence=0.52,
                rationale="The available signals do not isolate a single failure domain yet.",
                evidence_ids=evidence_ids,
            )
        )

    hypotheses = sorted(hypotheses, key=lambda item: item.confidence, reverse=True)[:3]
    top = hypotheses[0]
    summary = (
        f"{incident.public_id} affects {incident.service}. The strongest current hypothesis is "
        f"'{top.title}' at {round(top.confidence * 100)}% confidence. "
        f"The assistant correlated {len(evidence)} verified knowledge sources before proposing "
        "the next diagnostic steps."
    )

    actions = [
        RecommendedAction(
            id="action-verify",
            title="Validate the leading hypothesis with live telemetry",
            description=(
                "Compare request latency, error rate, connection-pool wait time, and deployment "
                "markers over the incident window. This is a read-only diagnostic action."
            ),
            risk_level=RiskLevel.LOW,
            approval_required=False,
            evidence_ids=evidence_ids,
        ),
        RecommendedAction(
            id="action-shed-load",
            title="Shed non-critical traffic for the affected endpoint",
            description=(
                "Apply the documented temporary rate limit to the checkout path while preserving "
                "health checks and payment callbacks."
            ),
            risk_level=RiskLevel.MEDIUM,
            approval_required=True,
            evidence_ids=evidence_ids,
        ),
    ]
    if any(term in text for term in ("deploy", "release", "rollout", "canary")):
        actions.append(
            RecommendedAction(
                id="action-rollback",
                title="Roll back the most recent application release",
                description=(
                    "Use the standard rollback procedure only after confirming the regression "
                    "correlates with the release boundary. Production execution requires approval."
                ),
                risk_level=RiskLevel.HIGH,
                approval_required=True,
                evidence_ids=evidence_ids,
            )
        )

    latency_ms = max(1, int((time.perf_counter() - started) * 1000))
    return AnalysisResult(
        summary=summary,
        hypotheses=hypotheses,
        actions=actions,
        model_name="opsmind-demo-rca",
        input_tokens=len(text.split()) + len(evidence) * 60,
        output_tokens=180,
        latency_ms=latency_ms,
        provider_mode="deterministic-demo",
    )


def _remote_analysis(
    incident: Incident,
    evidence: list[EvidenceItem],
    settings: Settings,
) -> AnalysisResult:
    started = time.perf_counter()
    evidence_payload = [
        {
            "id": item.chunk_id,
            "title": item.document_title,
            "source_type": item.source_type.value,
            "content": item.snippet,
        }
        for item in evidence
    ]
    system_prompt = (
        "You are an incident commander assistant. Analyze only the supplied incident and evidence. "
        "Return strict JSON with keys summary, hypotheses, actions. Each hypothesis must contain "
        "id, title, confidence, rationale, evidence_ids. Each action must contain id, title, "
        "description, risk_level (low|medium|high), approval_required, evidence_ids. Never "
        "recommend destructive production actions without approval_required=true. Cite evidence "
        "IDs only."
    )
    user_payload = {
        "incident": {
            "id": incident.public_id,
            "title": incident.title,
            "description": incident.description,
            "service": incident.service,
            "severity": incident.severity.value,
            "signals": incident.signals,
            "tags": incident.tags,
        },
        "evidence": evidence_payload,
    }
    response = httpx.post(
        f"{settings.llm_base_url.rstrip('/')}/chat/completions",
        headers={
            "Authorization": f"Bearer {settings.llm_api_key}",
            "Content-Type": "application/json",
        },
        json={
            "model": settings.llm_model,
            "temperature": 0.1,
            "response_format": {"type": "json_object"},
            "messages": [
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": json.dumps(user_payload)},
            ],
        },
        timeout=settings.llm_timeout_seconds,
    )
    response.raise_for_status()
    payload = response.json()
    content = payload["choices"][0]["message"]["content"]
    parsed: dict[str, Any] = json.loads(content)
    hypotheses = [Hypothesis.model_validate(item) for item in parsed["hypotheses"]]
    actions = [RecommendedAction.model_validate(item) for item in parsed["actions"]]
    usage = payload.get("usage", {})
    return AnalysisResult(
        summary=str(parsed["summary"]),
        hypotheses=hypotheses,
        actions=actions,
        model_name=settings.llm_model,
        input_tokens=int(usage.get("prompt_tokens", 0)),
        output_tokens=int(usage.get("completion_tokens", 0)),
        latency_ms=max(1, int((time.perf_counter() - started) * 1000)),
        provider_mode="openai-compatible",
    )


def analyze_incident(
    incident: Incident,
    evidence: list[EvidenceItem],
    settings: Settings,
) -> AnalysisResult:
    if settings.llm_mode == "openai_compatible" and settings.llm_api_key:
        try:
            return _remote_analysis(incident, evidence, settings)
        except (httpx.HTTPError, KeyError, json.JSONDecodeError, ValueError):
            # A malformed or unavailable model must not block an active incident.
            result = _demo_analysis(incident, evidence)
            return AnalysisResult(
                summary=result.summary,
                hypotheses=result.hypotheses,
                actions=result.actions,
                model_name=f"{settings.llm_model}-fallback",
                input_tokens=result.input_tokens,
                output_tokens=result.output_tokens,
                latency_ms=result.latency_ms,
                provider_mode="fallback-demo",
            )
    return _demo_analysis(incident, evidence)
