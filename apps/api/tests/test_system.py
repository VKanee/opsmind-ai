from fastapi.testclient import TestClient

from tests.conftest import login


def test_health_endpoints(client: TestClient) -> None:
    assert client.get("/health/live").json() == {"status": "ok"}
    assert client.get("/health/ready").json() == {"status": "ready"}


def test_chinese_api_guide_and_swagger_are_available(client: TestClient) -> None:
    guide = client.get("/docs")
    assert guide.status_code == 200
    assert "OpsMind AI API 使用说明" in guide.text
    assert "普通值班人员应使用中文业务工作台" in guide.text

    swagger = client.get("/swagger")
    assert swagger.status_code == 200
    assert "swagger-ui" in swagger.text


def test_overview_has_operational_aggregates(client: TestClient) -> None:
    headers = login(client)
    response = client.get("/api/v1/system/overview", headers=headers)
    assert response.status_code == 200
    body = response.json()
    assert body["active_incidents"] >= 1
    assert body["knowledge_documents"] >= 5
    assert body["investigations"] >= 1
    assert body["evidence_coverage"] == 1.0
    assert body["recent_incidents"]
    assert "*" not in response.headers.get("x-request-id", "*")
