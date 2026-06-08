import pytest
from unittest.mock import MagicMock, AsyncMock, patch
from fastapi.testclient import TestClient
from app.main import app
from app.utils.dependencies import get_current_user

client = TestClient(app)


# ── Helpers ───────────────────────────────────────────────────────────────────

def mock_user(role="customer", user_id="user_123"):
    return {"id": user_id, "role": role, "name": "Test", "email": "test@test.com"}

def override_user(role="customer", user_id="user_123"):
    app.dependency_overrides[get_current_user] = lambda: mock_user(role, user_id)

def clear_overrides():
    app.dependency_overrides.pop(get_current_user, None)


# ── Start chat validation ─────────────────────────────────────────────────────

def test_start_chat_missing_fields():
    """Missing ticket_id or message returns 422."""
    override_user()
    try:
        response = client.post("/chat/", json={})
        assert response.status_code == 422
    finally:
        clear_overrides()


def test_start_chat_ticket_not_found():
    """Starting chat on non-existent ticket returns 404."""
    override_user()
    mock_db = MagicMock()
    mock_db.tickets_col.find_one = AsyncMock(return_value=None)
    try:
        with patch("app.routes.chat.get_db", return_value=mock_db):
            response = client.post("/chat/", json={
                "ticket_id": "nonexistent",
                "message":   "Hello"
            })
            assert response.status_code == 404
    finally:
        clear_overrides()


def test_start_chat_customer_cannot_chat_on_others_ticket():
    """Customer cannot start chat on someone else's ticket."""
    override_user(role="customer", user_id="user_123")
    mock_ticket = {
        "_id":      "ticket_abc",
        "user_id":  "other_user",   # belongs to someone else
        "title":    "Other ticket",
        "status":   "open",
    }
    mock_db = MagicMock()
    mock_db.tickets_col.find_one = AsyncMock(return_value=mock_ticket)
    try:
        with patch("app.routes.chat.get_db", return_value=mock_db):
            response = client.post("/chat/", json={
                "ticket_id": "ticket_abc",
                "message":   "Hello"
            })
            assert response.status_code == 403
    finally:
        clear_overrides()


# ── Add message validation ────────────────────────────────────────────────────

def test_add_message_chat_not_found():
    """Adding message to non-existent chat returns 404."""
    override_user()
    mock_db = MagicMock()
    mock_db.chat_col.find_one = AsyncMock(return_value=None)
    try:
        with patch("app.routes.chat.get_db", return_value=mock_db):
            response = client.post("/chat/nonexistent/message", json={
                "role":    "user",
                "content": "My issue is still there"
            })
            assert response.status_code == 404
    finally:
        clear_overrides()


def test_add_message_to_closed_chat():
    """Adding message to a closed chat returns 400."""
    override_user(role="customer", user_id="user_123")
    mock_chat = {
        "_id":       "chat_123",
        "ticket_id": "ticket_abc",
        "user_id":   "user_123",
        "status":    "closed",
        "messages":  [],
    }
    mock_db = MagicMock()
    mock_db.chat_col.find_one = AsyncMock(return_value=mock_chat)
    try:
        with patch("app.routes.chat.get_db", return_value=mock_db):
            response = client.post("/chat/chat_123/message", json={
                "role":    "user",
                "content": "Still need help"
            })
            assert response.status_code == 400
            assert "closed" in response.json()["detail"]
    finally:
        clear_overrides()


# ── Close chat ────────────────────────────────────────────────────────────────

def test_close_chat_not_found():
    """Closing non-existent chat returns 404."""
    override_user()
    mock_db = MagicMock()
    mock_db.chat_col.find_one = AsyncMock(return_value=None)
    try:
        with patch("app.routes.chat.get_db", return_value=mock_db):
            response = client.patch("/chat/nonexistent/close")
            assert response.status_code == 404
    finally:
        clear_overrides()


def test_close_already_closed_chat():
    """Closing an already closed chat returns 400."""
    override_user(role="customer", user_id="user_123")
    mock_chat = {
        "_id":       "chat_123",
        "ticket_id": "ticket_abc",
        "user_id":   "user_123",
        "status":    "closed",
        "messages":  [],
    }
    mock_db = MagicMock()
    mock_db.chat_col.find_one = AsyncMock(return_value=mock_chat)
    try:
        with patch("app.routes.chat.get_db", return_value=mock_db):
            response = client.patch("/chat/chat_123/close")
            assert response.status_code == 400
            assert "already closed" in response.json()["detail"]
    finally:
        clear_overrides()


# ── Summary ───────────────────────────────────────────────────────────────────

def test_summary_forbidden_for_customer():
    """Customers cannot access chat summary."""
    override_user(role="customer")
    try:
        response = client.get("/chat/some_chat_id/summary")
        assert response.status_code == 403
    finally:
        clear_overrides()


def test_summary_chat_not_found():
    """Summary on non-existent chat returns 404."""
    override_user(role="admin")
    mock_db = MagicMock()
    mock_db.chat_col.find_one = AsyncMock(return_value=None)
    try:
        with patch("app.routes.chat.get_db", return_value=mock_db):
            response = client.get("/chat/nonexistent/summary")
            assert response.status_code == 404
    finally:
        clear_overrides()


# ── List chats ────────────────────────────────────────────────────────────────

def test_list_chats_forbidden_for_customer():
    """Customers cannot list all chats."""
    override_user(role="customer")
    try:
        response = client.get("/chat/")
        assert response.status_code == 403
    finally:
        clear_overrides()