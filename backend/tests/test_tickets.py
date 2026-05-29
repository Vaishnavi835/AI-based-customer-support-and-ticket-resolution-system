from fastapi.testclient import TestClient
from app.main import app
from app.utils.dependencies import get_current_user

client = TestClient(app)


def test_root():
    response = client.get("/")
    assert response.status_code == 200
    assert response.json()["status"] == "running"


def test_health():
    response = client.get("/health")
    assert response.status_code == 200


def test_create_ticket_missing_fields():
    app.dependency_overrides[get_current_user] = lambda: {
        "id": "user_123",
        "role": "customer",
    }
    try:
        response = client.post("/tickets/", json={})
        assert response.status_code == 422
    finally:
        app.dependency_overrides.pop(get_current_user, None)
