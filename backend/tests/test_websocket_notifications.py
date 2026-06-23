import pytest
from unittest.mock import MagicMock, AsyncMock, patch
from fastapi.testclient import TestClient
from fastapi.websockets import WebSocketDisconnect
from app.main import app
from app.utils.dependencies import get_current_user
from app.utils.jwt import create_access_token

client = TestClient(app)

# ── Helpers ───────────────────────────────────────────────────────────────────

def mock_user(role="customer", user_id="user_123"):
    return {"id": user_id, "role": role, "name": "Test User", "email": "test@test.com"}

def override_user(role="customer", user_id="user_123"):
    app.dependency_overrides[get_current_user] = lambda: mock_user(role, user_id)

def clear_overrides():
    app.dependency_overrides.pop(get_current_user, None)

def make_mock_db(notifications_list=None):
    mock_cursor = MagicMock()
    mock_cursor.sort = MagicMock(return_value=mock_cursor)
    mock_cursor.limit = MagicMock(return_value=mock_cursor)
    mock_cursor.to_list = AsyncMock(return_value=notifications_list or [])

    mock_col = MagicMock()
    mock_col.find = MagicMock(return_value=mock_cursor)
    mock_col.insert_one = AsyncMock()
    mock_col.update_many = AsyncMock()
    mock_col.update_one = AsyncMock(return_value=MagicMock(matched_count=1))
    
    mock_users_col = MagicMock()
    mock_users_col.find_one = AsyncMock(return_value={"_id": "user_123", "role": "customer", "name": "Test"})

    mock_db = MagicMock()
    mock_db.notifications_col = mock_col
    mock_db.users_col = mock_users_col
    return mock_db


# ── REST API Tests ────────────────────────────────────────────────────────────

def test_list_notifications():
    override_user()
    mock_notifs = [
        {"_id": "notif_1", "user_id": "user_123", "text": "Ticket updated", "unread": True, "created_at": "2026-06-19T07:00:00Z"},
        {"_id": "notif_2", "user_id": "user_123", "text": "Assigned to you", "unread": False, "created_at": "2026-06-19T06:00:00Z"},
    ]
    mock_db = make_mock_db(mock_notifs)
    try:
        with patch("app.services.notification_service.get_db", return_value=mock_db):
            response = client.get("/notifications/")
            assert response.status_code == 200
            data = response.json()
            assert len(data) == 2
            assert data[0]["id"] == "notif_1"
            assert data[0]["text"] == "Ticket updated"
            assert data[0]["unread"] is True
    finally:
        clear_overrides()


def test_mark_all_read():
    override_user()
    mock_db = make_mock_db()
    try:
        with patch("app.services.notification_service.get_db", return_value=mock_db):
            response = client.post("/notifications/mark-all-read")
            assert response.status_code == 200
            assert response.json()["message"] == "All notifications marked as read"
            mock_db.notifications_col.update_many.assert_called_once_with(
                {"user_id": "user_123", "unread": True},
                {"$set": {"unread": False}}
            )
    finally:
        clear_overrides()


def test_mark_single_read():
    override_user()
    mock_db = make_mock_db()
    try:
        with patch("app.services.notification_service.get_db", return_value=mock_db):
            response = client.patch("/notifications/notif_123/read")
            assert response.status_code == 200
            assert response.json()["message"] == "Notification marked as read"
            mock_db.notifications_col.update_one.assert_called_once_with(
                {"_id": "notif_123", "user_id": "user_123"},
                {"$set": {"unread": False}}
            )
    finally:
        clear_overrides()


# ── WebSocket Tests ───────────────────────────────────────────────────────────

def test_websocket_requires_token():
    # WebSocket connection fails if token is missing/invalid
    with pytest.raises(WebSocketDisconnect):
        with client.websocket_connect("/ws") as ws:
            pass

    with pytest.raises(WebSocketDisconnect):
        with client.websocket_connect("/ws?token=invalid_token") as ws:
            pass


def test_websocket_successful_connection():
    # Generate a valid JWT token
    token = create_access_token({"sub": "user_123", "email": "test@test.com"})
    
    mock_db = make_mock_db()
    
    with patch("app.routes.websocket.get_db", return_value=mock_db):
        with client.websocket_connect(f"/ws?token={token}") as websocket:
            websocket.send_text("ping")
            response = websocket.receive_text()
            assert response == "pong"
