from collections.abc import Generator
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

from app.config import Settings
from app.main import create_app


@pytest.fixture
def client(tmp_path: Path) -> Generator[TestClient, None, None]:
    database_path = (tmp_path / "opsmind-test.db").as_posix()
    settings = Settings(
        database_url=f"sqlite:///{database_path}",
        jwt_secret="test-secret-only-for-automated-tests",
        seed_demo_data=True,
        environment="test",
    )
    with TestClient(create_app(settings)) as test_client:
        yield test_client


def login(
    client: TestClient,
    email: str = "admin@opsmind.local",
    organization_slug: str = "acme-cloud",
) -> dict[str, str]:
    response = client.post(
        "/api/v1/auth/login",
        json={
            "organization_slug": organization_slug,
            "email": email,
            "password": "OpsMind!2026",
        },
    )
    assert response.status_code == 200, response.text
    token = response.json()["access_token"]
    return {"Authorization": f"Bearer {token}"}
