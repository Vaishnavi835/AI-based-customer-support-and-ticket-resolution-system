"""
RAG Routes — Semantic Search API
=================================

Endpoints:
  POST /rag/search              — search knowledge base by natural language query
  GET  /rag/knowledge-base      — list all knowledge base documents
  GET  /rag/knowledge-base/{id} — get a single document
  GET  /rag/stats               — FAISS index stats + readiness check
  POST /rag/ask                 — standalone RAG answer (without a chat session)
"""

from fastapi import APIRouter, HTTPException, Depends, Query
from pydantic import BaseModel
from typing import Optional
from app.services.rag_service import (
    search_knowledge_base,
    generate_rag_response,
    get_knowledge_base,
    get_kb_by_category,
    get_kb_categories,
    get_rag_stats,
    is_rag_ready,
)
from app.utils.dependencies import get_current_user, require_role
from app.utils.roles import Role

router = APIRouter(tags=["rag"])


# ── Request schemas ───────────────────────────────────────────────────────────

class SearchRequest(BaseModel):
    query: str
    top_k: int = 3


class AskRequest(BaseModel):
    question:   str
    top_k:      int = 3
    ticket_id:  Optional[str] = None   # optional ticket context


# ── Endpoints ─────────────────────────────────────────────────────────────────

@router.post("/search")
async def semantic_search(
    data: SearchRequest,
    current_user: dict = Depends(get_current_user),
):
    """
    Search the knowledge base using natural language.
    Returns top_k most semantically relevant documents.

    This is the core of semantic search — you can ask:
      "how do I get my money back"
    and it finds the Refund Policy doc even without the word 'refund'.
    """
    if not data.query.strip():
        raise HTTPException(status_code=400, detail="Query cannot be empty")

    if not is_rag_ready():
        raise HTTPException(
            status_code=503,
            detail="RAG service not ready. Check server logs."
        )

    results = await search_knowledge_base(data.query, top_k=data.top_k)

    return {
        "query":        data.query,
        "total_results": len(results),
        "results":      results,
    }


@router.post("/ask")
async def ask_rag(
    data: AskRequest,
    current_user: dict = Depends(get_current_user),
):
    """
    Ask a question and get a RAG-powered answer from Gemini.
    Gemini answers using ONLY your knowledge base — not general training data.

    Use this to test RAG responses outside of a chat session.
    """
    if not data.question.strip():
        raise HTTPException(status_code=400, detail="Question cannot be empty")

    if not is_rag_ready():
        raise HTTPException(
            status_code=503,
            detail="RAG service not ready. Check server logs."
        )

    # Get ticket context if ticket_id provided
    ticket_context = None
    if data.ticket_id:
        from app.database.connection import get_db
        db     = get_db()
        ticket = await db.tickets_col.find_one({"_id": data.ticket_id})
        if ticket:
            ticket_context = ticket

    # Get the docs that will be used (for transparency in response)
    relevant_docs = await search_knowledge_base(data.question, top_k=data.top_k)

    # Generate RAG answer
    answer = await generate_rag_response(
        question=data.question,
        ticket_context=ticket_context,
    )

    return {
        "question":      data.question,
        "answer":        answer,
        "sources_used":  [
            {"id": d["id"], "title": d["title"], "category": d["category"]}
            for d in relevant_docs
        ],
    }


@router.get("/stats")
async def rag_stats(
    current_user: dict = Depends(require_role(Role.admin, Role.support_agent)),
):
    """
    FAISS index statistics and readiness check.
    Shows how many vectors are stored, dimensions, model name.
    Admin and Support Agent only.
    """
    return get_rag_stats()


@router.get("/knowledge-base")
async def list_knowledge_base(
    category: Optional[str] = Query(None, description="Filter by category"),
    current_user: dict = Depends(require_role(Role.admin, Role.support_agent)),
):
    """
    List all knowledge base documents.
    Optionally filter by category.
    Admin and Support Agent only.
    """
    if category:
        docs = get_kb_by_category(category)
        if not docs:
            raise HTTPException(
                status_code=404,
                detail=f"No documents found for category: {category}"
            )
        return {"category": category, "total": len(docs), "documents": docs}

    docs       = get_knowledge_base()
    categories = get_kb_categories()
    return {
        "total":      len(docs),
        "categories": sorted(categories),
        "documents":  docs,
    }


@router.get("/knowledge-base/{doc_id}")
async def get_knowledge_doc(
    doc_id:       str,
    current_user: dict = Depends(require_role(Role.admin, Role.support_agent)),
):
    """Get a single knowledge base document by ID."""
    docs = get_knowledge_base()
    doc  = next((d for d in docs if d["id"] == doc_id), None)
    if not doc:
        raise HTTPException(
            status_code=404,
            detail=f"Document not found: {doc_id}"
        )
    return doc