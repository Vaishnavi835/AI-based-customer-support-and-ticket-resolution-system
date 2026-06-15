import pytest
from unittest.mock import MagicMock, AsyncMock, patch
from fastapi.testclient import TestClient
from app.main import app
from app.utils.dependencies import get_current_user
from app.services.escalation_service import (
    check_keyword_trigger,
    check_turn_count_trigger,
    check_sentiment_trigger,
    check_risk_score_trigger,
    detect_escalation_reason,
)
from app.schemas.escalation import EscalationReason

client = TestClient(app)


# ── Helpers ───────────────────────────────────────────────────────────────────

def mock_user(role="customer", user_id="user_123"):
    return {"id": user_id, "role": role, "name": "Test", "email": "test@test.com"}

def override_user(role="customer", user_id="user_123"):
    app.dependency_overrides[get_current_user] = lambda: mock_user(role, user_id)

def clear_overrides():
    app.dependency_overrides.pop(get_current_user, None)


# ── Keyword trigger tests ─────────────────────────────────────────────────────

def test_keyword_trigger_detected():
    """Direct escalation keyword should return True."""
    assert check_keyword_trigger("I want to speak to a human") is True

def test_keyword_trigger_case_insensitive():
    """Keyword check must be case-insensitive."""
    assert check_keyword_trigger("I need a SUPERVISOR right now") is True

def test_keyword_trigger_no_match():
    """Normal message should not trigger escalation."""
    assert check_keyword_trigger("Can you help me reset my password?") is False

def test_keyword_trigger_partial_phrase():
    """Multi-word keyword phrase must fully match."""
    assert check_keyword_trigger("This is a terrible service I received") is True

def test_keyword_trigger_lawsuit():
    """Legal threat keywords must be detected."""
    assert check_keyword_trigger("I am considering legal action") is True


# ── Turn count trigger tests ──────────────────────────────────────────────────

def test_turn_count_trigger_below_limit():
    """Fewer than MAX_AI_TURNS user messages should not trigger."""
    messages = [{"role": "user", "content": f"msg {i}"} for i in range(5)]
    assert check_turn_count_trigger(messages) is False

def test_turn_count_trigger_at_limit():
    """Exactly MAX_AI_TURNS user messages should trigger."""
    messages = [{"role": "user", "content": f"msg {i}"} for i in range(10)]
    assert check_turn_count_trigger(messages) is True

def test_turn_count_trigger_ignores_assistant_turns():
    """Assistant messages must not count toward the turn limit."""
    messages = (
        [{"role": "user",      "content": "hi"}] * 5 +
        [{"role": "assistant", "content": "hello"}] * 20
    )
    assert check_turn_count_trigger(messages) is False


# ── Sentiment trigger tests ───────────────────────────────────────────────────

def test_sentiment_trigger_negative():
    """Negative sentiment on ticket should trigger escalation."""
    ticket = {"sentiment": "negative", "customer_mood": "calm"}
    assert check_sentiment_trigger(ticket) is True

def test_sentiment_trigger_angry_mood():
    """Angry mood should trigger escalation even if sentiment is neutral."""
    ticket = {"sentiment": "neutral", "customer_mood": "angry"}
    assert check_sentiment_trigger(ticket) is True

def test_sentiment_trigger_neutral_calm():
    """Neutral sentiment and calm mood should not trigger."""
    ticket = {"sentiment": "neutral", "customer_mood": "calm"}
    assert check_sentiment_trigger(ticket) is False

def test_sentiment_trigger_positive():
    """Positive sentiment and calm mood definitely should not trigger."""
    ticket = {"sentiment": "positive", "customer_mood": "calm"}
    assert check_sentiment_trigger(ticket) is False


# ── Risk score trigger tests ──────────────────────────────────────────────────

def test_risk_score_high_triggers():
    """High escalation_risk on ticket should trigger."""
    assert check_risk_score_trigger({"escalation_risk": "high"}) is True

def test_risk_score_medium_no_trigger():
    """Medium risk should not trigger."""
    assert check_risk_score_trigger({"escalation_risk": "medium"}) is False

def test_risk_score_low_no_trigger():
    """Low risk should not trigger."""
    assert check_risk_score_trigger({"escalation_risk": "low"}) is False

def test_risk_score_missing_defaults_low():
    """Missing field defaults to low — no trigger."""
    assert check_risk_score_trigger({}) is False


# ── detect_escalation_reason priority tests ───────────────────────────────────

def test_detect_keyword_wins_over_risk():
    """Keyword match should take priority over risk score."""
    ticket   = {"escalation_risk": "high", "sentiment": "negative", "customer_mood": "angry"}
    messages = []
    reason   = detect_escalation_reason("I want to speak to a human", messages, ticket)
    assert reason == EscalationReason.keyword_match

def test_detect_risk_score_second_priority():
    """High risk score should escalate when no keyword match."""
    ticket   = {"escalation_risk": "high", "sentiment": "neutral", "customer_mood": "calm"}
    messages = []
    reason   = detect_escalation_reason("Can you help me?", messages, ticket)
    assert reason == EscalationReason.high_risk_score

def test_detect_sentiment_third_priority():
    """Negative sentiment triggers when no keyword or high risk."""
    ticket   = {"escalation_risk": "low", "sentiment": "negative", "customer_mood": "calm"}
    messages = []
    reason   = detect_escalation_reason("I'm not happy with this", messages, ticket)
    assert reason == EscalationReason.negative_sentiment

def test_detect_no_escalation_needed():
    """Normal message with calm ticket should not escalate."""
    ticket   = {"escalation_risk": "low", "sentiment": "neutral", "customer_mood": "calm"}
    messages = [{"role": "user", "content": "hi"}]
    reason   = detect_escalation_reason("How do I reset my password?", messages, ticket)
    assert reason is None


# ── Escalation API route tests ────────────────────────────────────────────────

def test_manual_escalate_chat_not_found():
    """Escalating a non-existent chat returns 404."""
    override_user()
    mock_db = MagicMock()
    mock_db.chat_col.find_one = AsyncMock(return_value=None)
    try:
        with patch("app.routes.escalation.get_db", return_value=mock_db):
            response = client.post("/escalation/", json={
                "chat_id": "nonexistent",
                "reason":  "manual",
            })
            assert response.status_code == 404
    finally:
        clear_overrides()

def test_pending_escalations_forbidden_for_customer():
    """Customers cannot view the pending escalation queue."""
    override_user(role="customer")
    try:
        response = client.get("/escalation/pending")
        assert response.status_code == 403
    finally:
        clear_overrides()

def test_takeover_forbidden_for_customer():
    """Customers cannot perform agent takeover."""
    override_user(role="customer")
    try:
        response = client.patch("/escalation/chat/some_chat/takeover")
        assert response.status_code == 403
    finally:
        clear_overrides()

def test_resolve_forbidden_for_customer():
    """Customers cannot resolve escalations."""
    override_user(role="customer")
    try:
        response = client.patch("/escalation/chat/some_chat/resolve")
        assert response.status_code == 403
    finally:
        clear_overrides()

def test_takeover_no_pending_escalation():
    """Takeover on a chat with no pending escalation returns 404."""
    override_user(role="admin")
    mock_db = MagicMock()
    mock_db.escalations_col.find_one = AsyncMock(return_value=None)
    try:
        with patch("app.services.escalation_service.get_db", return_value=mock_db):
            response = client.patch("/escalation/chat/some_chat/takeover")
            assert response.status_code == 404
    finally:
        clear_overrides()

def test_get_chat_escalation_not_found():
    """Getting escalation for a chat with none returns 404."""
    override_user(role="admin")
    mock_db = MagicMock()
    mock_db.escalations_col.find_one = AsyncMock(return_value=None)
    try:
        with patch("app.services.escalation_service.get_db", return_value=mock_db):
            response = client.get("/escalation/chat/some_chat")
            assert response.status_code == 404
    finally:
        clear_overrides()


# ── Chat message escalation integration tests ─────────────────────────────────

def test_add_message_to_escalated_chat_no_agent_queues():
    """Message to escalated chat (no agent yet) is queued, no AI reply."""
    override_user(role="customer", user_id="user_123")
    mock_chat = {
        "_id":       "chat_123",
        "ticket_id": "ticket_abc",
        "user_id":   "user_123",
        "status":    "active",
        "escalated": True,
        "agent_id":  None,
        "messages":  [],
    }
    mock_db = MagicMock()
    mock_db.chat_col.find_one  = AsyncMock(return_value=mock_chat)
    mock_db.chat_col.update_one = AsyncMock()
    mock_db.tickets_col.find_one = AsyncMock(return_value={"_id": "ticket_abc"})
    try:
        with patch("app.routes.chat.get_db", return_value=mock_db):
            response = client.post("/chat/chat_123/message", json={
                "role": "user", "content": "Still waiting for help"
            })
            assert response.status_code == 200
            data = response.json()
            assert data["escalated"] is True
            assert data["ai_response"] is None
    finally:
        clear_overrides()

def test_add_message_triggers_auto_escalation():
    """Message containing escalation keyword auto-escalates the chat."""
    override_user(role="customer", user_id="user_123")
    mock_chat = {
        "_id":       "chat_123",
        "ticket_id": "ticket_abc",
        "user_id":   "user_123",
        "status":    "active",
        "escalated": False,
        "agent_id":  None,
        "messages":  [],
    }
    mock_ticket = {
        "_id": "ticket_abc",
        "escalation_risk": "low",
        "sentiment": "neutral",
        "customer_mood": "calm",
    }
    mock_escalation = {
        "id":      "esc_001",
        "chat_id": "chat_123",
        "status":  "pending",
    }
    mock_db = MagicMock()
    mock_db.chat_col.find_one     = AsyncMock(return_value=mock_chat)
    mock_db.chat_col.update_one   = AsyncMock()
    mock_db.tickets_col.find_one  = AsyncMock(return_value=mock_ticket)
    mock_db.escalations_col.find_one   = AsyncMock(return_value=None)
    mock_db.escalations_col.insert_one = AsyncMock()
    try:
        with patch("app.routes.chat.get_db", return_value=mock_db), \
             patch("app.services.escalation_service.get_db", return_value=mock_db):
            response = client.post("/chat/chat_123/message", json={
                "role": "user", "content": "I need to speak to a human right now"
            })
            assert response.status_code == 200
            data = response.json()
            assert data["escalated"] is True
            assert data["reason"] == "keyword_match"
    finally:
        clear_overrides()