from fastapi.testclient import TestClient

from tests.conftest import login


def test_hybrid_search_returns_cited_evidence(client: TestClient) -> None:
    headers = login(client)
    response = client.post(
        "/api/v1/knowledge/search",
        headers=headers,
        json={"query": "checkout latency database connection pool rollback", "limit": 5},
    )
    assert response.status_code == 200
    results = response.json()["results"]
    assert results
    assert results[0]["relevance_score"] > 0
    assert results[0]["chunk_id"]
    assert "checkout" in results[0]["document_title"].lower()


def test_only_admin_can_ingest_documents(client: TestClient) -> None:
    responder_headers = login(client, "responder@opsmind.local")
    payload = {
        "title": "Orders cache runbook",
        "source_type": "runbook",
        "content": (
            "When cache hit rate falls below eighty percent, inspect eviction rate and hot keys "
            "before increasing cache capacity."
        ),
        "tags": ["orders", "cache"],
        "trust_level": "verified",
    }
    denied = client.post(
        "/api/v1/knowledge/documents",
        headers=responder_headers,
        json=payload,
    )
    assert denied.status_code == 403

    admin_headers = login(client)
    created = client.post(
        "/api/v1/knowledge/documents",
        headers=admin_headers,
        json=payload,
    )
    assert created.status_code == 201
    assert created.json()["title"] == "Orders cache runbook"
