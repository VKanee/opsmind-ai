from fastapi.testclient import TestClient

from app.models import Incident, IncidentStatus, Organization, Role, Severity, User
from app.security import hash_password
from tests.conftest import login


def test_login_and_current_user(client: TestClient) -> None:
    headers = login(client)
    response = client.get("/api/v1/auth/me", headers=headers)
    assert response.status_code == 200
    body = response.json()
    assert body["role"] == "admin"
    assert body["organization_id"]


def test_invalid_credentials_are_rejected(client: TestClient) -> None:
    response = client.post(
        "/api/v1/auth/login",
        json={
            "organization_slug": "acme-cloud",
            "email": "admin@opsmind.local",
            "password": "not-the-password",
        },
    )
    assert response.status_code == 401


def test_viewer_cannot_mutate_incidents(client: TestClient) -> None:
    headers = login(client, "viewer@opsmind.local")
    response = client.post(
        "/api/v1/incidents",
        headers=headers,
        json={
            "title": "Synthetic incident",
            "description": "A synthetic event used to verify RBAC enforcement.",
            "service": "test-service",
            "severity": "sev3",
        },
    )
    assert response.status_code == 403


def test_responder_can_create_incident(client: TestClient) -> None:
    headers = login(client, "responder@opsmind.local")
    response = client.post(
        "/api/v1/incidents",
        headers=headers,
        json={
            "title": "Database failover event",
            "description": "Primary database failover completed while traffic moved to replicas.",
            "service": "orders-db",
            "severity": "sev2",
            "tags": ["database"],
            "signals": [
                {
                    "name": "replica lag",
                    "value": "18",
                    "unit": "s",
                    "status": "warning",
                }
            ],
        },
    )
    assert response.status_code == 201
    assert response.json()["public_id"].startswith("INC-")


def test_incidents_are_isolated_between_organizations(client: TestClient) -> None:
    with client.app.state.db.session_factory() as db:
        other_org = Organization(name="Other Company", slug="other-company")
        db.add(other_org)
        db.flush()
        other_user = User(
            organization_id=other_org.id,
            email="responder@other.local",
            display_name="Other Responder",
            password_hash=hash_password("OpsMind!2026"),
            role=Role.RESPONDER,
        )
        db.add(other_user)
        db.flush()
        other_incident = Incident(
            organization_id=other_org.id,
            public_id="INC-OTHER-1001",
            title="Other tenant private incident",
            description="This incident must never be visible to the Acme Cloud tenant.",
            service="private-service",
            severity=Severity.SEV2,
            status=IncidentStatus.OPEN,
            created_by_id=other_user.id,
            tags=[],
            signals=[],
        )
        db.add(other_incident)
        db.commit()
        other_incident_id = other_incident.id

    acme_headers = login(client)
    response = client.get(f"/api/v1/incidents/{other_incident_id}", headers=acme_headers)
    assert response.status_code == 404

    other_headers = login(
        client,
        email="responder@other.local",
        organization_slug="other-company",
    )
    own_response = client.get(
        f"/api/v1/incidents/{other_incident_id}",
        headers=other_headers,
    )
    assert own_response.status_code == 200
