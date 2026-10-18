from fastapi.testclient import TestClient

from tests.conftest import login


def test_list_and_patch_incident(client: TestClient) -> None:
    headers = login(client, "responder@opsmind.local")
    incidents = client.get("/api/v1/incidents", headers=headers)
    assert incidents.status_code == 200
    assert len(incidents.json()) >= 4

    incident_id = incidents.json()[0]["id"]
    response = client.patch(
        f"/api/v1/incidents/{incident_id}",
        headers=headers,
        json={"status": "mitigated"},
    )
    assert response.status_code == 200
    assert response.json()["status"] == "mitigated"
    assert response.json()["resolved_at"] is not None


def test_incident_filtering(client: TestClient) -> None:
    headers = login(client)
    response = client.get("/api/v1/incidents?status=resolved", headers=headers)
    assert response.status_code == 200
    assert response.json()
    assert all(item["status"] == "resolved" for item in response.json())
