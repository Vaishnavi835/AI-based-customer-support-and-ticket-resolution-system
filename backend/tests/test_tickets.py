import pytest
from unittest.mock import MagicMock, AsyncMock, patch
from fastapi.testclient import TestClient
from app.main import app
from app.utils.dependencies import get_current_user
from app.schemas.ticket import is_valid_transition, Status

client = TestClient(app)


# ── Helpers ───────────────────────────────────────────────────────────────────

def mock_user(role="customer", user_id="user_123"):
    return {"id": user_id, "role": role, "name": "Test", "email": "test@test.com"}

def override_user(role="customer", user_id="user_123"):
    app.dependency_overrides[get_current_user] = lambda: mock_user(role, user_id)

def clear_overrides():
    app.dependency_overrides.pop(get_current_user, None)

def make_mock_db(find_one_return=None, count=0, find_list=None):
    """Build a mock db instance with async collection methods."""
    # cursor chain: col.find(q).skip(n).limit(n).to_list(n)
    mock_cursor = MagicMock()
    mock_cursor.sort  = MagicMock(return_value=mock_cursor)
    mock_cursor.skip  = MagicMock(return_value=mock_cursor)
    mock_cursor.limit = MagicMock(return_value=mock_cursor)
    mock_cursor.to_list = AsyncMock(return_value=find_list or [])

    mock_col = MagicMock()
    mock_col.find_one        = AsyncMock(return_value=find_one_return)
    mock_col.count_documents = AsyncMock(return_value=count)
    mock_col.find            = MagicMock(return_value=mock_cursor)

    mock_db = MagicMock()
    mock_db.tickets_col = mock_col
    return mock_db


# ── Root & Health ─────────────────────────────────────────────────────────────

def test_root():
    response = client.get("/")
    assert response.status_code == 200
    assert response.json()["status"] == "running"

def test_health():
    response = client.get("/health")
    assert response.status_code == 200


# ── Ticket lifecycle transitions ──────────────────────────────────────────────

def test_open_to_pending_is_valid():
    assert is_valid_transition("open", "pending") is True


def test_open_to_escalated_is_valid():
    assert is_valid_transition("open", "escalated") is True


def test_pending_to_resolved_is_valid():
    assert is_valid_transition("pending", "resolved") is True


def test_escalated_to_resolved_is_valid():
    assert is_valid_transition("escalated", "resolved") is True

def test_pending_to_open_is_invalid():
    assert is_valid_transition("pending", "open") is False

def test_resolved_to_closed_is_valid():
    assert is_valid_transition("resolved", "closed") is True

def test_resolved_to_open_is_invalid():
    assert is_valid_transition("resolved", "open") is False

def test_closed_has_no_transitions():
    for status in ["open", "pending", "resolved"]:
        assert is_valid_transition("closed", status) is False

def test_invalid_status_string_returns_false():
    assert is_valid_transition("open", "unknown_status") is False


# ── Ticket API validation (no DB needed — fail before reaching DB) ────────────

def test_create_ticket_missing_fields():
    override_user()
    try:
        response = client.post("/tickets/", json={})
        assert response.status_code == 422
    finally:
        clear_overrides()

def test_create_ticket_title_too_short():
    override_user()
    try:
        response = client.post("/tickets/", json={
            "title": "Hi",
            "description": "This is a valid description",
        })
        assert response.status_code == 422
    finally:
        clear_overrides()

def test_create_ticket_description_too_short():
    override_user()
    try:
        response = client.post("/tickets/", json={
            "title": "Valid title",
            "description": "Short",
        })
        assert response.status_code == 422
    finally:
        clear_overrides()

def test_create_ticket_invalid_priority():
    override_user()
    try:
        response = client.post("/tickets/", json={
            "title": "Valid title here",
            "description": "This is a valid description",
            "priority": "urgent",
        })
        assert response.status_code == 422
    finally:
        clear_overrides()

def test_list_tickets_invalid_status_filter():
    override_user(role="admin")
    try:
        response = client.get("/tickets/?status=unknown")
        assert response.status_code == 400
    finally:
        clear_overrides()

def test_list_tickets_invalid_priority_filter():
    override_user(role="admin")
    try:
        response = client.get("/tickets/?priority=critical")
        assert response.status_code == 400
    finally:
        clear_overrides()

def test_stats_forbidden_for_customer():
    override_user(role="customer")
    try:
        response = client.get("/tickets/stats")
        assert response.status_code == 403
    finally:
        clear_overrides()

def test_delete_ticket_forbidden_for_agent():
    override_user(role="support_agent")
    try:
        response = client.delete("/tickets/some_id")
        assert response.status_code == 403
    finally:
        clear_overrides()

def test_delete_ticket_forbidden_for_customer():
    override_user(role="customer")
    try:
        response = client.delete("/tickets/some_id")
        assert response.status_code == 403
    finally:
        clear_overrides()

def test_update_ticket_forbidden_for_customer():
    override_user(role="customer")
    try:
        response = client.patch("/tickets/some_id", json={"status": "pending"})
        assert response.status_code == 403
    finally:
        clear_overrides()

def test_pagination_invalid_page():
    override_user(role="admin")
    try:
        response = client.get("/tickets/?page=0")
        assert response.status_code == 422
    finally:
        clear_overrides()


# ── Tests that need DB — mocked with unittest.mock ────────────────────────────

def test_get_nonexistent_ticket():
    """Ticket not found — mocks DB returning None."""
    override_user()
    mock_db = make_mock_db(find_one_return=None)
    try:
        with patch("app.services.ticket_service.get_db", return_value=mock_db):
            response = client.get("/tickets/nonexistent_id_xyz")
            assert response.status_code == 404
    finally:
        clear_overrides()


def test_pagination_defaults():
    """List tickets — mocks empty DB response."""
    override_user(role="admin")
    mock_db = make_mock_db(count=0, find_list=[])
    try:
        with patch("app.services.ticket_service.get_db", return_value=mock_db):
            response = client.get("/tickets/")
            assert response.status_code == 200
            data = response.json()
            assert "tickets"     in data
            assert "total"       in data
            assert "page"        in data
            assert "total_pages" in data
            assert data["total"] == 0
            assert data["page"]  == 1
    finally:
        clear_overrides()

# ── Assignment tests ──────────────────────────────────────────────────────────

def test_workload_forbidden_for_customer():
    override_user(role="customer")
    try:
        response = client.get("/tickets/workload")
        assert response.status_code == 403
    finally:
        clear_overrides()


def test_agent_tickets_forbidden_for_customer():
    override_user(role="customer")
    try:
        response = client.get("/tickets/agent/some_agent_id")
        assert response.status_code == 403
    finally:
        clear_overrides()


def test_assign_forbidden_for_customer():
    override_user(role="customer")
    try:
        response = client.patch("/tickets/some_id/assign", json={"assigned_to": "agent_1"})
        assert response.status_code == 403
    finally:
        clear_overrides()


def test_reassign_forbidden_for_customer():
    override_user(role="customer")
    try:
        response = client.patch("/tickets/some_id/reassign", json={
            "assigned_to": "agent_2",
            "reason": "agent 1 is on leave"
        })
        assert response.status_code == 403
    finally:
        clear_overrides()


def test_unassign_forbidden_for_customer():
    override_user(role="customer")
    try:
        response = client.patch("/tickets/some_id/unassign")
        assert response.status_code == 403
    finally:
        clear_overrides()


def test_reassign_missing_reason():
    """reassign needs both assigned_to and reason — reason missing gives 422."""
    override_user(role="admin")
    try:
        response = client.patch("/tickets/some_id/reassign", json={
            "assigned_to": "agent_2"
            # reason missing
        })
        assert response.status_code == 422
    finally:
        clear_overrides()


def test_reassign_missing_assigned_to():
    """reassign needs both assigned_to and reason — assigned_to missing gives 422."""
    override_user(role="admin")
    try:
        response = client.patch("/tickets/some_id/reassign", json={
            "reason": "agent is unavailable"
            # assigned_to missing
        })
        assert response.status_code == 422
    finally:
        clear_overrides()


def test_workload_returns_list():
    """Workload endpoint returns a list — mocked with no agents."""
    override_user(role="admin")
    mock_col = MagicMock()
    mock_cursor = MagicMock()
    mock_cursor.to_list = AsyncMock(return_value=[])
    mock_col.find = MagicMock(return_value=mock_cursor)
    mock_col.count_documents = AsyncMock(return_value=0)
    mock_db = MagicMock()
    mock_db.users_col = mock_col
    mock_db.tickets_col = mock_col
    try:
        with patch("app.services.ticket_service.get_db", return_value=mock_db):
            response = client.get("/tickets/workload")
            assert response.status_code == 200
            assert isinstance(response.json(), list)
    finally:
        clear_overrides()


def test_assign_ticket_not_found():
    """Assign on non-existent ticket returns 404."""
    override_user(role="admin")
    mock_db = make_mock_db(find_one_return=None)
    try:
        with patch("app.services.ticket_service.get_db", return_value=mock_db):
            response = client.patch("/tickets/nonexistent/assign", json={
                "assigned_to": "agent_123"
            })
            assert response.status_code == 404
    finally:
        clear_overrides()


def test_unassign_ticket_not_found():
    """Unassign on non-existent ticket returns 404."""
    override_user(role="admin")
    mock_db = make_mock_db(find_one_return=None)
    try:
        with patch("app.services.ticket_service.get_db", return_value=mock_db):
            response = client.patch("/tickets/nonexistent/unassign")
            assert response.status_code == 404
    finally:
        clear_overrides()
    # ── Search endpoint tests ─────────────────────────────────────────────────────

def test_search_forbidden_for_customer():
    """Customers cannot access the search endpoint."""
    override_user(role="customer")
    try:
        response = client.get("/tickets/search")
        assert response.status_code == 403
    finally:
        clear_overrides()


def test_search_invalid_status():
    """Search with invalid status returns 400."""
    override_user(role="admin")
    try:
        response = client.get("/tickets/search?status=invalid_status")
        assert response.status_code == 400
    finally:
        clear_overrides()


def test_search_invalid_priority():
    """Search with invalid priority returns 400."""
    override_user(role="admin")
    try:
        response = client.get("/tickets/search?priority=urgent")
        assert response.status_code == 400
    finally:
        clear_overrides()


def test_search_invalid_page():
    """Search with page=0 returns 422."""
    override_user(role="admin")
    try:
        response = client.get("/tickets/search?page=0")
        assert response.status_code == 422
    finally:
        clear_overrides()


def test_search_returns_paginated_results():
    """Search with mocked DB returns proper pagination structure."""
    override_user(role="admin")
    mock_cursor = MagicMock()
    mock_cursor.sort = MagicMock(return_value=mock_cursor)
    mock_cursor.skip = MagicMock(return_value=mock_cursor)
    mock_cursor.limit = MagicMock(return_value=mock_cursor)
    mock_cursor.to_list = AsyncMock(return_value=[])

    mock_col = MagicMock()
    mock_col.count_documents = AsyncMock(return_value=0)
    mock_col.find = MagicMock(return_value=mock_cursor)

    mock_db = MagicMock()
    mock_db.tickets_col = mock_col
    try:
        with patch("app.services.ticket_service.get_db", return_value=mock_db):
            response = client.get("/tickets/search?status=open")
            assert response.status_code == 200
            data = response.json()
            assert "tickets" in data
            assert "total" in data
            assert "filters_applied" in data
            assert data["filters_applied"]["status"] == "open"
    finally:
        clear_overrides()
