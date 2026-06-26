"""
Tests for Day 18 — RAG routes and semantic search.
"""

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


# ── /rag/stats ────────────────────────────────────────────────────────────────

def test_rag_stats_forbidden_for_customer():
    """Customer cannot access RAG stats."""
    override_user(role="customer")
    try:
        response = client.get("/rag/stats")
        assert response.status_code == 403
    finally:
        clear_overrides()


def test_rag_stats_accessible_for_admin():
    """Admin can access RAG stats."""
    override_user(role="admin")
    try:
        response = client.get("/rag/stats")
        assert response.status_code == 200
        data = response.json()
        assert "ready"      in data
        assert "total_docs" in data
        assert "model"      in data
    finally:
        clear_overrides()


def test_rag_stats_accessible_for_agent():
    """Support agent can access RAG stats."""
    override_user(role="support_agent")
    try:
        response = client.get("/rag/stats")
        assert response.status_code == 200
    finally:
        clear_overrides()


# ── /rag/knowledge-base ───────────────────────────────────────────────────────

def test_knowledge_base_forbidden_for_customer():
    """Customer cannot list knowledge base."""
    override_user(role="customer")
    try:
        response = client.get("/rag/knowledge-base")
        assert response.status_code == 403
    finally:
        clear_overrides()


def test_knowledge_base_returns_documents():
    """Admin can list all knowledge base documents."""
    override_user(role="admin")
    try:
        response = client.get("/rag/knowledge-base")
        assert response.status_code == 200
        data = response.json()
        assert "documents"  in data
        assert "total"      in data
        assert "categories" in data
        assert data["total"] > 0
    finally:
        clear_overrides()


def test_knowledge_base_filter_by_category():
    """Filtering by category returns only matching docs."""
    override_user(role="admin")
    try:
        response = client.get("/rag/knowledge-base?category=billing")
        assert response.status_code == 200
        data = response.json()
        assert data["category"] == "billing"
        for doc in data["documents"]:
            assert doc["category"] == "billing"
    finally:
        clear_overrides()


def test_knowledge_base_invalid_category_returns_404():
    """Unknown category returns 404."""
    override_user(role="admin")
    try:
        response = client.get("/rag/knowledge-base?category=nonexistent")
        assert response.status_code == 404
    finally:
        clear_overrides()


def test_get_single_doc_by_id():
    """Can retrieve a single knowledge base doc by ID."""
    override_user(role="admin")
    try:
        response = client.get("/rag/knowledge-base/kb_001")
        assert response.status_code == 200
        data = response.json()
        assert data["id"]       == "kb_001"
        assert data["category"] == "billing"
        assert "content" in data
    finally:
        clear_overrides()


def test_get_single_doc_not_found():
    """Non-existent doc ID returns 404."""
    override_user(role="admin")
    try:
        response = client.get("/rag/knowledge-base/kb_999")
        assert response.status_code == 404
    finally:
        clear_overrides()


# ── /rag/search ───────────────────────────────────────────────────────────────

def test_search_empty_query_returns_400():
    """Empty search query returns 400."""
    override_user()
    try:
        response = client.post("/rag/search", json={"query": "   "})
        assert response.status_code == 400
    finally:
        clear_overrides()


def test_search_when_rag_not_ready_returns_503():
    """Search returns 503 when RAG not initialized."""
    override_user()
    try:
        with patch("app.routes.rag.is_rag_ready", return_value=False):
            response = client.post("/rag/search", json={"query": "refund policy"})
            assert response.status_code == 503
    finally:
        clear_overrides()


def test_search_returns_results_structure():
    """Search returns query, total_results, and results list."""
    override_user()
    mock_results = [
        {
            "id": "kb_001", "category": "billing",
            "title": "Refund Policy",
            "content": "30 day refund...",
            "relevance_score": 0.15,
        }
    ]
    try:
        with patch("app.routes.rag.is_rag_ready", return_value=True), \
             patch("app.routes.rag.search_knowledge_base", new=AsyncMock(return_value=mock_results)):
            response = client.post("/rag/search", json={"query": "how do I get a refund"})
            assert response.status_code == 200
            data = response.json()
            assert data["query"]         == "how do I get a refund"
            assert data["total_results"] == 1
            assert len(data["results"])  == 1
            assert data["results"][0]["id"] == "kb_001"
    finally:
        clear_overrides()


def test_search_missing_query_field_returns_422():
    """Missing query field returns 422 validation error."""
    override_user()
    try:
        response = client.post("/rag/search", json={})
        assert response.status_code == 422
    finally:
        clear_overrides()


# ── /rag/ask ──────────────────────────────────────────────────────────────────

def test_ask_empty_question_returns_400():
    """Empty question returns 400."""
    override_user()
    try:
        response = client.post("/rag/ask", json={"question": ""})
        assert response.status_code == 400
    finally:
        clear_overrides()


def test_ask_when_rag_not_ready_returns_503():
    """Ask returns 503 when RAG not initialized."""
    override_user()
    try:
        with patch("app.routes.rag.is_rag_ready", return_value=False):
            response = client.post("/rag/ask", json={"question": "how do I reset password"})
            assert response.status_code == 503
    finally:
        clear_overrides()


def test_ask_returns_answer_and_sources():
    """Ask returns answer and sources_used list."""
    override_user()
    mock_docs = [
        {"id": "kb_003", "title": "Password Reset", "category": "authentication",
         "content": "Click forgot password...", "relevance_score": 0.1}
    ]
    try:
        with patch("app.routes.rag.is_rag_ready", return_value=True), \
             patch("app.routes.rag.search_knowledge_base", new=AsyncMock(return_value=mock_docs)), \
             patch("app.routes.rag.generate_rag_response", new=AsyncMock(return_value=("Click forgot password on the login page.", mock_docs))):
            response = client.post("/rag/ask", json={"question": "how do I reset my password"})
            assert response.status_code == 200
            data = response.json()
            assert "question"     in data
            assert "answer"       in data
            assert "sources_used" in data
            assert len(data["sources_used"]) == 1
            assert data["sources_used"][0]["id"] == "kb_003"
    finally:
        clear_overrides()


# ── Chat RAG integration ──────────────────────────────────────────────────────

def test_chat_response_includes_rag_used_flag():
    """Chat start response includes rag_used field."""
    override_user(role="customer", user_id="user_123")
    mock_ticket = {
        "_id": "ticket_abc", "user_id": "user_123",
        "title": "Billing issue", "status": "open",
        "escalation_risk": "low", "sentiment": "neutral",
        "customer_mood": "calm",
    }
    mock_db = MagicMock()
    mock_db.tickets_col.find_one  = AsyncMock(return_value=mock_ticket)
    mock_db.chat_col.insert_one   = AsyncMock()

    try:
        with patch("app.routes.chat.get_db", return_value=mock_db), \
             patch("app.routes.chat.is_rag_ready", return_value=True), \
             patch("app.routes.chat.generate_rag_response",
                   new=AsyncMock(return_value=("Based on our policy, refunds take 5-7 days.", []))):
            response = client.post("/chat/", json={
                "ticket_id": "ticket_abc",
                "message":   "How long does a refund take?"
            })
            assert response.status_code == 200
            data = response.json()
            assert "rag_used" in data
            assert data["rag_used"] is True
    finally:
        clear_overrides()


def test_chat_falls_back_to_plain_gemini_when_rag_not_ready():
    """Chat uses plain Gemini when RAG not initialized."""
    override_user(role="customer", user_id="user_123")
    mock_ticket = {
        "_id": "ticket_abc", "user_id": "user_123",
        "title": "Issue", "status": "open",
        "escalation_risk": "low", "sentiment": "neutral",
        "customer_mood": "calm",
    }
    mock_db = MagicMock()
    mock_db.tickets_col.find_one = AsyncMock(return_value=mock_ticket)
    mock_db.chat_col.insert_one  = AsyncMock()

    try:
        with patch("app.routes.chat.get_db", return_value=mock_db), \
             patch("app.routes.chat.is_rag_ready", return_value=False), \
             patch("app.routes.chat.generate_contextual_response",
                   new=AsyncMock(return_value="Generic AI response")):
            response = client.post("/chat/", json={
                "ticket_id": "ticket_abc",
                "message":   "Help me"
            })
            assert response.status_code == 200
            data = response.json()
            assert data["rag_used"] is False
    finally:
        clear_overrides()