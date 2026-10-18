from __future__ import annotations

import json
from dataclasses import dataclass
from datetime import UTC, datetime
from pathlib import Path
from typing import Any

from sqlalchemy import select

from app.config import Settings
from app.db import Database
from app.models import Incident, IncidentStatus, Organization, Severity
from app.seed import ensure_seed_data
from app.services.llm import analyze_incident
from app.services.retrieval import search_knowledge


@dataclass(frozen=True)
class GoldenCase:
    id: str
    title: str
    description: str
    service: str
    severity: Severity
    signals: list[dict[str, Any]]
    expected_document: str
    expected_keyword: str


def load_cases() -> list[GoldenCase]:
    path = Path(__file__).parent / "eval" / "golden_cases.json"
    raw = json.loads(path.read_text(encoding="utf-8"))
    return [
        GoldenCase(
            id=item["id"],
            title=item["title"],
            description=item["description"],
            service=item["service"],
            severity=Severity(item["severity"]),
            signals=item["signals"],
            expected_document=item["expected_document"],
            expected_keyword=item["expected_keyword"],
        )
        for item in raw
    ]


def run_evaluation() -> dict[str, Any]:
    settings = Settings(
        database_url="sqlite:///:memory:",
        seed_demo_data=True,
        environment="evaluation",
    )
    database = Database(settings.database_url)
    database.create_schema()
    results: list[dict[str, Any]] = []

    try:
        with database.session_factory() as db:
            ensure_seed_data(db, settings)
            organization = db.scalar(select(Organization).limit(1))
            if organization is None:
                raise RuntimeError("Evaluation seed did not create an organization")

            for case in load_cases():
                incident = Incident(
                    organization_id=organization.id,
                    public_id=f"EVAL-{case.id.upper()}",
                    title=case.title,
                    description=case.description,
                    service=case.service,
                    severity=case.severity,
                    status=IncidentStatus.INVESTIGATING,
                    created_by_id="evaluation",
                    started_at=datetime.now(UTC),
                    detected_at=datetime.now(UTC),
                    tags=["evaluation"],
                    signals=case.signals,
                )
                query = " ".join(
                    [
                        incident.title,
                        incident.description,
                        incident.service,
                        " ".join(signal["name"] for signal in incident.signals),
                    ]
                )
                evidence = search_knowledge(
                    db,
                    organization_id=organization.id,
                    query=query,
                    settings=settings,
                    limit=6,
                )
                analysis = analyze_incident(incident, evidence, settings)
                evidence_titles = " ".join(item.document_title for item in evidence)
                known_evidence_ids = {item.chunk_id for item in evidence}
                cited_ids = {
                    evidence_id
                    for hypothesis in analysis.hypotheses
                    for evidence_id in hypothesis.evidence_ids
                }
                analysis_text = " ".join(
                    [
                        analysis.summary,
                        *(hypothesis.title for hypothesis in analysis.hypotheses),
                        *(action.title for action in analysis.actions),
                    ]
                ).lower()
                retrieval_hit = case.expected_document.lower() in evidence_titles.lower()
                keyword_hit = case.expected_keyword.lower() in analysis_text
                citation_coverage = bool(cited_ids) and cited_ids.issubset(known_evidence_ids)
                action_policy = all(
                    not (
                        action.risk_level.value in {"medium", "high"}
                        and not action.approval_required
                    )
                    for action in analysis.actions
                )
                passed = retrieval_hit and keyword_hit and citation_coverage and action_policy
                results.append(
                    {
                        "id": case.id,
                        "passed": passed,
                        "retrieval_hit": retrieval_hit,
                        "keyword_hit": keyword_hit,
                        "citation_coverage": citation_coverage,
                        "action_policy": action_policy,
                        "top_hypothesis": (
                            analysis.hypotheses[0].title if analysis.hypotheses else None
                        ),
                        "evidence_count": len(evidence),
                    }
                )
    finally:
        database.close()

    passed_count = sum(1 for result in results if result["passed"])
    total = len(results)
    return {
        "suite": "opsmind-rca-v1",
        "cases": results,
        "summary": {
            "total": total,
            "passed": passed_count,
            "pass_rate": round(passed_count / total, 3) if total else 0.0,
            "retrieval_hit_rate": round(
                sum(1 for result in results if result["retrieval_hit"]) / total, 3
            )
            if total
            else 0.0,
            "citation_coverage": round(
                sum(1 for result in results if result["citation_coverage"]) / total, 3
            )
            if total
            else 0.0,
            "action_policy_pass_rate": round(
                sum(1 for result in results if result["action_policy"]) / total, 3
            )
            if total
            else 0.0,
        },
    }


def main() -> None:
    report = run_evaluation()
    print(json.dumps(report, indent=2))
    if report["summary"]["pass_rate"] < 0.8:
        raise SystemExit(1)


if __name__ == "__main__":
    main()
