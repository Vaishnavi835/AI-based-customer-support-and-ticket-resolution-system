"""
Tests for RAG service.

Split into two groups:
  - Unit tests  : test logic without real embeddings (fast, always run)
  - Integration : test real FAISS search (needs faiss-cpu + sentence-transformers)
"""

import pytest
import numpy as np
from unittest.mock import MagicMock, AsyncMock, patch


# ── Unit tests — no real model needed ────────────────────────────────────────

def test_knowledge_base_is_not_empty():
    """Knowledge base must have documents."""
    from app.knowledge.sample_docs import KNOWLEDGE_BASE
    assert len(KNOWLEDGE_BASE) > 0


def test_every_doc_has_required_fields():
    """Every knowledge base doc must have id, category, title, content."""
    from app.knowledge.sample_docs import KNOWLEDGE_BASE
    required = {"id", "category", "title", "content"}
    for doc in KNOWLEDGE_BASE:
        assert required.issubset(doc.keys()), f"Doc missing fields: {doc.get('id')}"


def test_every_doc_content_is_non_empty():
    """No doc should have empty content."""
    from app.knowledge.sample_docs import KNOWLEDGE_BASE
    for doc in KNOWLEDGE_BASE:
        assert doc["content"].strip(), f"Empty content in doc: {doc['id']}"


def test_doc_ids_are_unique():
    """All doc IDs must be unique."""
    from app.knowledge.sample_docs import KNOWLEDGE_BASE
    ids = [doc["id"] for doc in KNOWLEDGE_BASE]
    assert len(ids) == len(set(ids)), "Duplicate IDs found in knowledge base"


def test_categories_are_valid():
    """All categories must be from the allowed set."""
    from app.knowledge.sample_docs import KNOWLEDGE_BASE
    allowed = {"billing", "authentication", "technical", "account", "general"}
    for doc in KNOWLEDGE_BASE:
        assert doc["category"] in allowed, \
            f"Invalid category '{doc['category']}' in doc {doc['id']}"


def test_get_kb_by_category_returns_correct_docs():
    """get_kb_by_category must return only docs from that category."""
    from app.services.rag_service import get_kb_by_category
    billing_docs = get_kb_by_category("billing")
    assert len(billing_docs) > 0
    for doc in billing_docs:
        assert doc["category"] == "billing"


def test_get_kb_by_category_unknown_returns_empty():
    """Unknown category must return empty list, not error."""
    from app.services.rag_service import get_kb_by_category
    result = get_kb_by_category("nonexistent_category")
    assert result == []


def test_get_kb_categories_returns_list():
    """get_kb_categories must return a list of strings."""
    from app.services.rag_service import get_kb_categories
    categories = get_kb_categories()
    assert isinstance(categories, list)
    assert len(categories) > 0
    for c in categories:
        assert isinstance(c, str)


def test_is_rag_ready_false_before_init():
    """RAG should not be ready before initialize_rag() is called."""
    import app.services.rag_service as rag
    # Reset to uninitialized state
    rag.faiss_index     = None
    rag.embedding_model = None
    assert rag.is_rag_ready() is False


def test_get_rag_stats_before_init():
    """Stats before init should show ready=False and 0 docs."""
    import app.services.rag_service as rag
    rag.faiss_index     = None
    rag.embedding_model = None
    stats = rag.get_rag_stats()
    assert stats["ready"]      is False
    assert stats["total_docs"] == 0
    assert stats["dimensions"] == 0
    assert stats["model"]      == "all-MiniLM-L6-v2"


def test_build_rag_prompt_contains_question():
    """The built prompt must include the customer's question."""
    from app.services.rag_service import _build_rag_prompt
    prompt = _build_rag_prompt(
        question="How do I get a refund?",
        relevant_docs=[],
    )
    assert "How do I get a refund?" in prompt


def test_build_rag_prompt_includes_doc_content():
    """The built prompt must include retrieved doc content."""
    from app.services.rag_service import _build_rag_prompt
    docs = [{"title": "Refund Policy", "content": "30 day refund window"}]
    prompt = _build_rag_prompt(
        question="refund?",
        relevant_docs=docs,
    )
    assert "Refund Policy"       in prompt
    assert "30 day refund window" in prompt


def test_build_rag_prompt_no_docs_note():
    """When no docs found, prompt must say so."""
    from app.services.rag_service import _build_rag_prompt
    prompt = _build_rag_prompt(
        question="something random",
        relevant_docs=[],
    )
    assert "No relevant knowledge base" in prompt


def test_build_rag_prompt_with_ticket_context():
    """Ticket context fields must appear in the prompt."""
    from app.services.rag_service import _build_rag_prompt
    ticket = {"title": "Billing issue", "category": "billing", "status": "open"}
    prompt = _build_rag_prompt(
        question="refund?",
        relevant_docs=[],
        ticket_context=ticket,
    )
    assert "Billing issue" in prompt
    assert "billing"       in prompt


def test_search_returns_empty_when_not_initialized():
    """Search must return empty list gracefully when RAG not ready."""
    import app.services.rag_service as rag
    rag.faiss_index     = None
    rag.embedding_model = None

    import asyncio
    result = asyncio.get_event_loop().run_until_complete(
        rag.search_knowledge_base("test query")
    )
    assert result == []


def test_search_returns_empty_for_blank_query():
    """Blank query must return empty list without crashing."""
    import app.services.rag_service as rag
    # Set a mock model so it passes the None check
    rag.embedding_model = MagicMock()
    rag.faiss_index     = MagicMock()

    import asyncio
    result = asyncio.get_event_loop().run_until_complete(
        rag.search_knowledge_base("   ")
    )
    assert result == []

    # Clean up
    rag.embedding_model = None
    rag.faiss_index     = None


# ── Integration tests — needs real faiss + sentence_transformers ──────────────

def has_rag_deps():
    """Check if FAISS and sentence_transformers are installed."""
    try:
        import faiss
        from sentence_transformers import SentenceTransformer
        return True
    except ImportError:
        return False


@pytest.mark.skipif(not has_rag_deps(), reason="faiss-cpu or sentence-transformers not installed")
def test_initialize_rag_builds_index():
    """After init, FAISS index must have correct number of docs."""
    import asyncio
    import app.services.rag_service as rag
    from app.knowledge.sample_docs import KNOWLEDGE_BASE

    # Reset
    rag.faiss_index     = None
    rag.embedding_model = None
    rag.doc_store       = []

    asyncio.get_event_loop().run_until_complete(rag.initialize_rag())

    assert rag.faiss_index     is not None
    assert rag.embedding_model is not None
    assert rag.faiss_index.ntotal == len(KNOWLEDGE_BASE)
    assert rag.faiss_index.d      == 384   # all-MiniLM-L6-v2 dimension


@pytest.mark.skipif(not has_rag_deps(), reason="faiss-cpu or sentence-transformers not installed")
def test_search_refund_query_returns_billing_docs():
    """
    Semantic search for 'refund' must return billing-related docs.
    This is the core RAG test — proves meaning-based search works.
    """
    import asyncio
    import app.services.rag_service as rag

    # Initialize if not already done
    if not rag.is_rag_ready():
        asyncio.get_event_loop().run_until_complete(rag.initialize_rag())

    results = asyncio.get_event_loop().run_until_complete(
        rag.search_knowledge_base("I want a refund", top_k=3)
    )

    assert len(results) > 0
    # Top result must be billing category
    assert results[0]["category"] == "billing"


@pytest.mark.skipif(not has_rag_deps(), reason="faiss-cpu or sentence-transformers not installed")
def test_search_password_query_returns_auth_docs():
    """Semantic search for password issue must return authentication docs."""
    import asyncio
    import app.services.rag_service as rag

    if not rag.is_rag_ready():
        asyncio.get_event_loop().run_until_complete(rag.initialize_rag())

    results = asyncio.get_event_loop().run_until_complete(
        rag.search_knowledge_base("I cannot log into my account", top_k=3)
    )

    assert len(results) > 0
    categories = [r["category"] for r in results]
    assert "authentication" in categories


@pytest.mark.skipif(not has_rag_deps(), reason="faiss-cpu or sentence-transformers not installed")
def test_search_returns_relevance_score():
    """Each result must have a relevance_score field."""
    import asyncio
    import app.services.rag_service as rag

    if not rag.is_rag_ready():
        asyncio.get_event_loop().run_until_complete(rag.initialize_rag())

    results = asyncio.get_event_loop().run_until_complete(
        rag.search_knowledge_base("refund policy", top_k=2)
    )

    for r in results:
        assert "relevance_score" in r
        assert isinstance(r["relevance_score"], float)


@pytest.mark.skipif(not has_rag_deps(), reason="faiss-cpu or sentence-transformers not installed")
def test_search_top_k_respected():
    """Search must return at most top_k results."""
    import asyncio
    import app.services.rag_service as rag

    if not rag.is_rag_ready():
        asyncio.get_event_loop().run_until_complete(rag.initialize_rag())

    results = asyncio.get_event_loop().run_until_complete(
        rag.search_knowledge_base("help me", top_k=2)
    )
    assert len(results) <= 2


@pytest.mark.skipif(not has_rag_deps(), reason="faiss-cpu or sentence-transformers not installed")
def test_semantic_search_beats_keyword_search():
    """
    The power of RAG — 'money back' should find the refund doc
    even though the word 'refund' is not in the query.
    This proves semantic (meaning) search works.
    """
    import asyncio
    import app.services.rag_service as rag

    if not rag.is_rag_ready():
        asyncio.get_event_loop().run_until_complete(rag.initialize_rag())

    results = asyncio.get_event_loop().run_until_complete(
        rag.search_knowledge_base("I need my money back", top_k=3)
    )

    titles = [r["title"] for r in results]
    # "Refund Policy" should appear even though we said "money back" not "refund"
    assert any("Refund" in t or "refund" in t.lower() for t in titles), \
        f"Expected refund doc in results, got: {titles}"