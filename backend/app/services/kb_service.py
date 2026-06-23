"""
Knowledge Base Service
======================

Handles all MongoDB CRUD for the knowledge_base collection.
After every write (add / update / delete), triggers a FAISS reindex
so the in-memory vector store stays in sync with the database.

Why a separate service from rag_service?
  rag_service owns the vector index and search logic.
  kb_service owns the persistence layer.
  Keeping them separate makes each easier to test and reason about.
"""

import uuid
import logging
from datetime import datetime, timezone
from fastapi import HTTPException
from app.database.connection import get_db
from app.knowledge.sample_docs import KNOWLEDGE_BASE

logger = logging.getLogger(__name__)


def _now():
    return datetime.now(timezone.utc)


# ── Seeding ───────────────────────────────────────────────────────────────────

async def seed_knowledge_base():
    """
    Populate the MongoDB knowledge_base collection from sample_docs.py
    if the collection is currently empty.

    This runs once on first startup. After that, the collection owns
    the data and sample_docs.py is just the initial source of truth.
    You can safely add new docs to sample_docs.py and they'll be seeded
    on the next fresh DB start — but existing docs won't be overwritten.
    """
    col   = get_db().knowledge_col
    count = await col.count_documents({})

    if count > 0:
        logger.info(f"KB: Collection already has {count} documents — skipping seed")
        return

    docs = [
        {
            "_id":        doc["id"],        # use the human-readable id (kb_001, etc.)
            "title":      doc["title"],
            "category":   doc["category"],
            "content":    doc["content"],
            "created_at": _now(),
            "updated_at": _now(),
        }
        for doc in KNOWLEDGE_BASE
    ]

    await col.insert_many(docs)
    logger.info(f"KB: Seeded {len(docs)} documents from sample_docs.py")


# ── Read ──────────────────────────────────────────────────────────────────────

async def get_all_kb_docs(category: str = None) -> list:
    """
    Fetch all KB documents from MongoDB.
    Optionally filter by category.

    Unlike get_knowledge_base() in rag_service (which reads from in-memory
    doc_store), this always reads the live database — used by admin list routes.
    """
    try:
        col = get_db().knowledge_col
        if col is not None:
            query = {}
            if category:
                query["category"] = category

            docs = await col.find(query).to_list(1000)
            for d in docs:
                d["id"] = d.pop("_id")
            return docs
    except Exception as e:
        logger.warning(f"KB: MongoDB query failed for get_all_kb_docs ({e}) — falling back to static KNOWLEDGE_BASE")

    # Fallback to static KNOWLEDGE_BASE
    docs = []
    for doc in KNOWLEDGE_BASE:
        if category and doc.get("category") != category:
            continue
        docs.append({
            "id": doc["id"],
            "category": doc["category"],
            "title": doc["title"],
            "content": doc["content"],
        })
    return docs


async def get_kb_doc_by_id(doc_id: str) -> dict:
    """Fetch a single KB document by ID. Raises 404 if not found."""
    try:
        col = get_db().knowledge_col
        if col is not None:
            doc = await col.find_one({"_id": doc_id})
            if doc:
                doc["id"] = doc.pop("_id")
                return doc
    except Exception as e:
        logger.warning(f"KB: MongoDB query failed for get_kb_doc_by_id ({e}) — falling back to static KNOWLEDGE_BASE")

    # Fallback to static KNOWLEDGE_BASE
    for doc in KNOWLEDGE_BASE:
        if doc.get("id") == doc_id:
            return {
                "id": doc["id"],
                "category": doc["category"],
                "title": doc["title"],
                "content": doc["content"],
            }
    
    raise HTTPException(
        status_code=404,
        detail=f"KB document not found: {doc_id}"
    )


# ── Write (each one triggers reindex) ────────────────────────────────────────

async def add_kb_doc(title: str, category: str, content: str) -> dict:
    """
    Add a new document to the knowledge base.

    ID format: kb_{8-char-uuid} so they're short and human-readable.
    After inserting, triggers a full FAISS reindex so the new doc
    is immediately searchable.
    """
    col    = get_db().knowledge_col
    doc_id = f"kb_{str(uuid.uuid4())[:8]}"

    doc = {
        "_id":        doc_id,
        "title":      title,
        "category":   category,
        "content":    content,
        "created_at": _now(),
        "updated_at": _now(),
    }
    await col.insert_one(doc)
    logger.info(f"KB: Added document '{title}' ({doc_id})")

    # Rebuild FAISS so this doc is immediately searchable
    await _trigger_reindex()

    doc["id"] = doc.pop("_id")
    return {"message": "KB document added and index rebuilt", "document": doc}


async def update_kb_doc(doc_id: str, updates: dict) -> dict:
    """
    Update title, category, and/or content of an existing KB document.

    Only the fields present in `updates` are changed.
    Triggers reindex because the embedding for this doc needs to be
    recalculated with the new content.
    """
    col = get_db().knowledge_col
    existing = await col.find_one({"_id": doc_id})
    if not existing:
        raise HTTPException(
            status_code=404,
            detail=f"KB document not found: {doc_id}"
        )

    # Build the update dict (only include fields that were actually provided)
    set_fields = {"updated_at": _now()}
    allowed    = {"title", "category", "content"}
    for field in allowed:
        if field in updates and updates[field] is not None:
            set_fields[field] = updates[field]

    if len(set_fields) == 1:   # only updated_at, nothing else changed
        raise HTTPException(status_code=400, detail="No fields to update")

    await col.update_one({"_id": doc_id}, {"$set": set_fields})
    logger.info(f"KB: Updated document {doc_id}: {list(set_fields.keys())}")

    await _trigger_reindex()
    return {"message": "KB document updated and index rebuilt", "id": doc_id}


async def delete_kb_doc(doc_id: str) -> dict:
    """
    Delete a KB document permanently.

    Triggers reindex so the doc is no longer returned by searches.
    Note: deleted docs remain in FAISS until reindex completes (~1s).
    """
    col    = get_db().knowledge_col
    result = await col.delete_one({"_id": doc_id})

    if result.deleted_count == 0:
        raise HTTPException(
            status_code=404,
            detail=f"KB document not found: {doc_id}"
        )

    logger.info(f"KB: Deleted document {doc_id}")
    await _trigger_reindex()
    return {"message": "KB document deleted and index rebuilt", "id": doc_id}


# ── Internal ──────────────────────────────────────────────────────────────────

async def _trigger_reindex():
    """
    Import lazily to avoid circular imports at module load time.
    (rag_service imports nothing from kb_service, so no true circular dep,
    but keeping the import local is safer as the codebase grows.)
    """
    from app.services.rag_service import reindex_rag
    await reindex_rag()