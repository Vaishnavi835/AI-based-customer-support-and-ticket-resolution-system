"""
Tests for Day 19 + 20:
  - RAG threshold filtering (Day 19)
  - Conversation history in prompts (Day 19)
  - KB CRUD routes (Day 20)
  - Seeding logic (Day 20)
  - Reindex endpoint (Day 20)
"""

import pytest
from unittest.mock import MagicMock, AsyncMock, patch
from fastapi.testclient import TestClient
from datetime import datetime, timezone

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

def make_sample_doc(doc_id="kb_001"):
    return {
        "_id":        doc_id,
        "title":      "Refund Policy",
        "category":   "billing",
        "content":    "30 day refund window.",
        "created_at": datetime.now(timezone.utc),
        "updated_at": datetime.now(timezone.utc),
    }


# ═════════════════════════════════════════════════════════════════════════════
# Day 19: RAG pipeline unit tests
# ═════════════════════════════════════════════════════════════════════════════
def restore_rag_state():
    import app.services.rag_service as rag
    from app.knowledge.sample_docs import KNOWLEDGE_BASE
    rag.faiss_index = None
    rag.embedding_model = None
    rag.doc_store = [
        {
            "id":       d["id"],
            "title":    d["title"],
            "category": d["category"],
            "content":  d["content"],
        }
        for d in KNOWLEDGE_BASE
    ]


class TestThresholdFiltering:
    """search_knowledge_base should filter results above the distance threshold."""

    def test_results_within_threshold_are_returned(self):
        """Docs with distance below threshold must be included."""
        import asyncio
        import app.services.rag_service as rag

        # Set up a mock FAISS index and model
        mock_index = MagicMock()
        mock_index.ntotal = 2
        # Return two docs with distances 0.5 and 1.8 (both below default 2.0)
        import numpy as np
        mock_index.search = MagicMock(
            return_value=(
                np.array([[0.5, 1.8]]),
                np.array([[0, 1]])
            )
        )
        mock_model = MagicMock()
        mock_model.encode = MagicMock(
            return_value=np.array([[0.1] * 384])
        )

        rag.faiss_index     = mock_index
        rag.embedding_model = mock_model
        rag.doc_store       = [
            {"id": "kb_001", "title": "Refund",   "category": "billing",  "content": "30 days"},
            {"id": "kb_002", "title": "Password", "category": "auth",     "content": "reset link"},
        ]

        results = asyncio.get_event_loop().run_until_complete(
            rag.search_knowledge_base("refund", top_k=2, threshold=2.0)
        )
        assert len(results) == 2

        # Cleanup
        restore_rag_state()

    def test_results_above_threshold_are_filtered(self):
        """Docs with distance above threshold must be excluded."""
        import asyncio
        import numpy as np
        import app.services.rag_service as rag

        mock_index = MagicMock()
        mock_index.ntotal = 2
        mock_index.search = MagicMock(
            return_value=(
                np.array([[0.5, 3.5]]),   # second doc is far away
                np.array([[0, 1]])
            )
        )
        mock_model = MagicMock()
        mock_model.encode = MagicMock(return_value=np.array([[0.1] * 384]))

        rag.faiss_index     = mock_index
        rag.embedding_model = mock_model
        rag.doc_store       = [
            {"id": "kb_001", "title": "Refund",   "category": "billing", "content": "30 days"},
            {"id": "kb_002", "title": "Password", "category": "auth",    "content": "reset link"},
        ]

        results = asyncio.get_event_loop().run_until_complete(
            rag.search_knowledge_base("refund", top_k=2, threshold=2.0)
        )
        # Only the first doc (distance 0.5) should be returned
        assert len(results) == 1
        assert results[0]["id"] == "kb_001"

        restore_rag_state()

    def test_strict_threshold_returns_nothing(self):
        """Very strict threshold (0.1) should filter out everything."""
        import asyncio
        import numpy as np
        import app.services.rag_service as rag

        mock_index = MagicMock()
        mock_index.ntotal = 1
        mock_index.search = MagicMock(
            return_value=(np.array([[1.5]]), np.array([[0]]))
        )
        mock_model = MagicMock()
        mock_model.encode = MagicMock(return_value=np.array([[0.1] * 384]))

        rag.faiss_index     = mock_index
        rag.embedding_model = mock_model
        rag.doc_store       = [
            {"id": "kb_001", "title": "Refund", "category": "billing", "content": "30 days"},
        ]

        results = asyncio.get_event_loop().run_until_complete(
            rag.search_knowledge_base("refund", top_k=1, threshold=0.1)
        )
        assert results == []

        restore_rag_state()


class TestConversationHistory:
    """_build_rag_prompt should include recent history in the prompt."""

    def test_prompt_includes_conversation_history(self):
        from app.services.rag_service import _build_rag_prompt

        history = [
            {"role": "user",      "content": "I cleared my cache already"},
            {"role": "assistant", "content": "Let's try a different browser"},
        ]
        prompt = _build_rag_prompt(
            question="Still not working",
            relevant_docs=[],
            conversation_history=history,
        )
        assert "cleared my cache" in prompt
        assert "different browser" in prompt

    def test_prompt_only_uses_last_4_messages(self):
        """Only last 4 messages should appear even if history is longer."""
        from app.services.rag_service import _build_rag_prompt

        history = [
            {"role": "user",      "content": f"old message {i}"}
            for i in range(10)
        ]
        # The last message (index 9) should be included
        prompt = _build_rag_prompt(
            question="current question",
            relevant_docs=[],
            conversation_history=history,
        )
        assert "old message 9" in prompt
        assert "old message 6" in prompt
        # Very old messages should NOT be in the prompt
        assert "old message 0" not in prompt
        assert "old message 3" not in prompt

    def test_prompt_without_history_still_works(self):
        """Omitting conversation_history should not raise an error."""
        from app.services.rag_service import _build_rag_prompt

        prompt = _build_rag_prompt(
            question="How do I reset my password?",
            relevant_docs=[],
            conversation_history=None,
        )
        assert "password" in prompt
        # Should not contain "Recent conversation" section
        assert "Recent conversation" not in prompt

    def test_role_labels_are_readable(self):
        """User messages should be labeled 'Customer', assistant as 'Support Agent'."""
        from app.services.rag_service import _build_rag_prompt

        history = [
            {"role": "user",      "content": "I have a problem"},
            {"role": "assistant", "content": "Let me help you"},
        ]
        prompt = _build_rag_prompt(
            question="Still stuck",
            relevant_docs=[],
            conversation_history=history,
        )
        assert "Customer:" in prompt
        assert "Support Agent:" in prompt


# ═════════════════════════════════════════════════════════════════════════════
# Day 20: KB seeding tests
# ═════════════════════════════════════════════════════════════════════════════

class TestKBSeeding:
    """seed_knowledge_base should populate MongoDB from sample_docs only when empty."""

    def test_seed_inserts_docs_when_collection_is_empty(self):
        """When collection is empty, all sample docs should be inserted."""
        import asyncio
        from app.services.kb_service import seed_knowledge_base

        mock_col = MagicMock()
        mock_col.count_documents = AsyncMock(return_value=0)
        mock_col.insert_many     = AsyncMock()
        mock_db  = MagicMock()
        mock_db.knowledge_col = mock_col

        with patch("app.services.kb_service.get_db", return_value=mock_db):
            asyncio.get_event_loop().run_until_complete(seed_knowledge_base())

        mock_col.insert_many.assert_called_once()
        inserted = mock_col.insert_many.call_args[0][0]
        assert len(inserted) > 0
        # Each inserted doc must have the right structure
        for doc in inserted:
            assert "_id"     in doc
            assert "title"   in doc
            assert "content" in doc

    def test_seed_skips_when_collection_has_docs(self):
        """When collection already has docs, insert_many must NOT be called."""
        import asyncio
        from app.services.kb_service import seed_knowledge_base

        mock_col = MagicMock()
        mock_col.count_documents = AsyncMock(return_value=8)  # already seeded
        mock_col.insert_many     = AsyncMock()
        mock_db  = MagicMock()
        mock_db.knowledge_col = mock_col

        with patch("app.services.kb_service.get_db", return_value=mock_db):
            asyncio.get_event_loop().run_until_complete(seed_knowledge_base())

        mock_col.insert_many.assert_not_called()


# ═════════════════════════════════════════════════════════════════════════════
# Day 20: KB Admin API route tests
# ═════════════════════════════════════════════════════════════════════════════

class TestKBAddRoute:
    """POST /rag/knowledge-base"""

    def test_add_forbidden_for_customer(self):
        override_user(role="customer")
        try:
            response = client.post("/rag/knowledge-base", json={
                "title": "Test doc", "category": "billing", "content": "Some content here"
            })
            assert response.status_code == 403
        finally:
            clear_overrides()

    def test_add_forbidden_for_agent(self):
        override_user(role="support_agent")
        try:
            response = client.post("/rag/knowledge-base", json={
                "title": "Test doc", "category": "billing", "content": "Some content here"
            })
            assert response.status_code == 403
        finally:
            clear_overrides()

    def test_add_invalid_category_returns_422(self):
        override_user(role="admin")
        try:
            response = client.post("/rag/knowledge-base", json={
                "title":    "Test doc",
                "category": "invalid_category",
                "content":  "Some content here"
            })
            assert response.status_code == 422
        finally:
            clear_overrides()

    def test_add_title_too_short_returns_422(self):
        override_user(role="admin")
        try:
            response = client.post("/rag/knowledge-base", json={
                "title": "Hi", "category": "billing", "content": "Some content here"
            })
            assert response.status_code == 422
        finally:
            clear_overrides()

    def test_add_content_too_short_returns_422(self):
        override_user(role="admin")
        try:
            response = client.post("/rag/knowledge-base", json={
                "title": "Valid title", "category": "billing", "content": "Short"
            })
            assert response.status_code == 422
        finally:
            clear_overrides()

    def test_add_success_triggers_reindex(self):
        """Successful add should call reindex_rag."""
        override_user(role="admin")

        mock_col = MagicMock()
        mock_col.insert_one = AsyncMock()
        mock_db = MagicMock()
        mock_db.knowledge_col = mock_col

        try:
            with patch("app.services.kb_service.get_db",    return_value=mock_db), \
                 patch("app.services.kb_service._trigger_reindex", new=AsyncMock()) as mock_reindex:
                response = client.post("/rag/knowledge-base", json={
                    "title":    "How to export data",
                    "category": "technical",
                    "content":  "Go to account settings and click export data."
                })
                assert response.status_code == 200
                mock_reindex.assert_called_once()   # reindex was triggered
        finally:
            clear_overrides()


class TestKBUpdateRoute:
    """PUT /rag/knowledge-base/{doc_id}"""

    def test_update_forbidden_for_customer(self):
        override_user(role="customer")
        try:
            response = client.put("/rag/knowledge-base/kb_001", json={"title": "New title"})
            assert response.status_code == 403
        finally:
            clear_overrides()

    def test_update_not_found_returns_404(self):
        override_user(role="admin")
        mock_col = MagicMock()
        mock_col.find_one = AsyncMock(return_value=None)
        mock_db = MagicMock()
        mock_db.knowledge_col = mock_col
        try:
            with patch("app.services.kb_service.get_db", return_value=mock_db):
                response = client.put("/rag/knowledge-base/kb_999", json={"title": "New title"})
                assert response.status_code == 404
        finally:
            clear_overrides()

    def test_update_invalid_category_returns_422(self):
        override_user(role="admin")
        try:
            response = client.put("/rag/knowledge-base/kb_001", json={"category": "bogus"})
            assert response.status_code == 422
        finally:
            clear_overrides()

    def test_update_success_triggers_reindex(self):
        override_user(role="admin")
        mock_col = MagicMock()
        mock_col.find_one   = AsyncMock(return_value=make_sample_doc())
        mock_col.update_one = AsyncMock()
        mock_db = MagicMock()
        mock_db.knowledge_col = mock_col
        try:
            with patch("app.services.kb_service.get_db",    return_value=mock_db), \
                 patch("app.services.kb_service._trigger_reindex", new=AsyncMock()) as mock_reindex:
                response = client.put("/rag/knowledge-base/kb_001", json={
                    "content": "Updated: Customers are eligible for a full refund within 60 days."
                })
                assert response.status_code == 200
                mock_reindex.assert_called_once()
        finally:
            clear_overrides()


class TestKBDeleteRoute:
    """DELETE /rag/knowledge-base/{doc_id}"""

    def test_delete_forbidden_for_customer(self):
        override_user(role="customer")
        try:
            response = client.delete("/rag/knowledge-base/kb_001")
            assert response.status_code == 403
        finally:
            clear_overrides()

    def test_delete_forbidden_for_agent(self):
        override_user(role="support_agent")
        try:
            response = client.delete("/rag/knowledge-base/kb_001")
            assert response.status_code == 403
        finally:
            clear_overrides()

    def test_delete_not_found_returns_404(self):
        override_user(role="admin")
        mock_delete_result = MagicMock()
        mock_delete_result.deleted_count = 0
        mock_col = MagicMock()
        mock_col.delete_one = AsyncMock(return_value=mock_delete_result)
        mock_db = MagicMock()
        mock_db.knowledge_col = mock_col
        try:
            with patch("app.services.kb_service.get_db", return_value=mock_db):
                response = client.delete("/rag/knowledge-base/kb_999")
                assert response.status_code == 404
        finally:
            clear_overrides()

    def test_delete_success_triggers_reindex(self):
        override_user(role="admin")
        mock_result = MagicMock()
        mock_result.deleted_count = 1
        mock_col = MagicMock()
        mock_col.delete_one = AsyncMock(return_value=mock_result)
        mock_db = MagicMock()
        mock_db.knowledge_col = mock_col
        try:
            with patch("app.services.kb_service.get_db",    return_value=mock_db), \
                 patch("app.services.kb_service._trigger_reindex", new=AsyncMock()) as mock_reindex:
                response = client.delete("/rag/knowledge-base/kb_001")
                assert response.status_code == 200
                mock_reindex.assert_called_once()
        finally:
            clear_overrides()


class TestReindexRoute:
    """POST /rag/reindex"""

    def test_reindex_forbidden_for_customer(self):
        override_user(role="customer")
        try:
            response = client.post("/rag/reindex")
            assert response.status_code == 403
        finally:
            clear_overrides()

    def test_reindex_forbidden_for_agent(self):
        override_user(role="support_agent")
        try:
            response = client.post("/rag/reindex")
            assert response.status_code == 403
        finally:
            clear_overrides()

    def test_reindex_admin_gets_stats(self):
        """Admin can trigger reindex and gets stats back."""
        override_user(role="admin")
        try:
            with patch("app.routes.rag.reindex_rag", new=AsyncMock()):
                response = client.post("/rag/reindex")
                assert response.status_code == 200
                data = response.json()
                assert "message" in data
                assert "stats"   in data
                assert data["message"] == "Reindex complete"
        finally:
            clear_overrides()


class TestKBSchemaValidation:
    """Pydantic schema validation for KB documents."""

    def test_valid_categories_accepted(self):
        from app.schemas.knowledge import KBDocCreate
        for cat in ["billing", "authentication", "technical", "account", "general"]:
            doc = KBDocCreate(title="Test title", category=cat, content="Some content here")
            assert doc.category == cat

    def test_invalid_category_raises(self):
        from app.schemas.knowledge import KBDocCreate
        from pydantic import ValidationError
        with pytest.raises(ValidationError):
            KBDocCreate(title="Test", category="unknown", content="Some content here")

    def test_update_partial_fields_allowed(self):
        from app.schemas.knowledge import KBDocUpdate
        doc = KBDocUpdate(content="New content for the article goes here.")
        assert doc.content is not None
        assert doc.title    is None
        assert doc.category is None

    def test_update_empty_raises_on_all_none(self):
        """All-None update dict should result in no fields (handled in service)."""
        from app.schemas.knowledge import KBDocUpdate
        doc = KBDocUpdate()
        # model_dump(exclude_none=True) should return an empty dict
        assert doc.model_dump(exclude_none=True) == {}