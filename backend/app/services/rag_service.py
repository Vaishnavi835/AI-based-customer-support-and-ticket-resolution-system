"""
RAG Service — Retrieval Augmented Generation
============================================

Day 19 additions.
  - search_knowledge_base() now accepts a threshold param
    (filters out low-relevance docs so Gemini doesn't hallucinate on garbage context)
  - generate_rag_response() now accepts conversation_history
    (last 4 messages are added to the prompt so responses are context-aware)
  - get_knowledge_base() now returns doc_store (from MongoDB) not sample_docs.py

Day 20 additions:
  - initialize_rag() loads from MongoDB instead of the static file
  - reindex_rag() rebuilds the FAISS index after any KB change
"""

import os
import logging
import numpy as np
from typing import Optional

logger = logging.getLogger(__name__)

# ── Module-level state (loaded once at startup) ───────────────────────────────
from app.knowledge.sample_docs import KNOWLEDGE_BASE

faiss_index     = None   # FAISS index holding all doc embeddings
doc_store       = [
    {
        "id":       d["id"],
        "title":    d["title"],
        "category": d["category"],
        "content":  d["content"],
    }
    for d in KNOWLEDGE_BASE
]     # list of docs in the same order as FAISS index
embedding_model = None   # SentenceTransformer model


# ── 1. initialize_rag ─────────────────────────────────────────────────────────

async def initialize_rag():
    """
    Load the embedding model, embed every knowledge base document from MongoDB,
    and build a FAISS index. Called once at app startup.

    Day 20 change: reads from MongoDB (knowledge_col) not sample_docs.py.
    This means your live KB is always what's in the database.
    """
    global faiss_index, doc_store, embedding_model

    try:
        import faiss
        # pyrefly: ignore [missing-import]
        from sentence_transformers import SentenceTransformer

        logger.info("RAG: Loading embedding model (all-MiniLM-L6-v2)...")
        embedding_model = SentenceTransformer("all-MiniLM-L6-v2")
        logger.info("RAG: Embedding model loaded")

        # Load docs from MongoDB (seeded from sample_docs.py on first startup)
        docs = []
        try:
            from app.database.connection import get_db
            db_inst = get_db()
            if db_inst and db_inst.knowledge_col is not None:
                db_docs = await db_inst.knowledge_col.find({}).to_list(1000)
                docs = [
                    {
                        "id":       d["_id"],
                        "title":    d["title"],
                        "category": d["category"],
                        "content":  d["content"],
                    }
                    for d in db_docs
                ]
        except Exception as db_err:
            logger.warning(f"RAG: MongoDB query failed during init ({db_err}) — using static KNOWLEDGE_BASE fallback")

        if not docs:
            from app.knowledge.sample_docs import KNOWLEDGE_BASE
            docs = [
                {
                    "id":       d["id"],
                    "title":    d["title"],
                    "category": d["category"],
                    "content":  d["content"],
                }
                for d in KNOWLEDGE_BASE
            ]

        doc_store = docs
        texts = [doc["content"] for doc in doc_store]

        logger.info(f"RAG: Embedding {len(texts)} knowledge base documents...")
        embeddings = embedding_model.encode(
            texts,
            show_progress_bar=True,
            convert_to_numpy=True,
        ).astype(np.float32)

        dimension   = embeddings.shape[1]   # 384 for all-MiniLM-L6-v2
        faiss_index = faiss.IndexFlatL2(dimension)
        faiss_index.add(embeddings)

        logger.info(
            f"RAG: FAISS index built — "
            f"{faiss_index.ntotal} vectors, {dimension} dimensions"
        )

    except ImportError as e:
        logger.warning(f"RAG: Missing dependency ({e}). RAG disabled.")
        logger.warning("RAG: Run: pip install faiss-cpu sentence-transformers")
    except Exception as e:
        logger.error(f"RAG: Initialization failed: {e}")


# ── 2. reindex_rag ────────────────────────────────────────────────────────────

async def reindex_rag():
    """
    Rebuild the FAISS index from the current MongoDB knowledge_base.

    Called automatically after every add / update / delete via the admin API.
    Also available as a manual trigger via POST /rag/reindex.

    Why: FAISS is an in-memory index. When the DB changes, the index is stale.
    Rebuilding is fast because the model is already loaded (embedding ~50ms/doc).
    """
    global faiss_index, doc_store

    if embedding_model is None:
        logger.warning("RAG: Cannot reindex — embedding model not loaded yet")
        return

    try:
        # pyrefly: ignore [missing-import]
        import faiss
        docs = []
        try:
            from app.database.connection import get_db
            db_inst = get_db()
            if db_inst and db_inst.knowledge_col is not None:
                db_docs = await db_inst.knowledge_col.find({}).to_list(1000)
                docs = [
                    {
                        "id":       d["_id"],
                        "title":    d["title"],
                        "category": d["category"],
                        "content":  d["content"],
                    }
                    for d in db_docs
                ]
        except Exception as db_err:
            logger.warning(f"RAG: MongoDB query failed during reindex ({db_err}) — using static KNOWLEDGE_BASE fallback")

        if not docs:
            from app.knowledge.sample_docs import KNOWLEDGE_BASE
            docs = [
                {
                    "id":       d["id"],
                    "title":    d["title"],
                    "category": d["category"],
                    "content":  d["content"],
                }
                for d in KNOWLEDGE_BASE
            ]

        doc_store = docs
        texts      = [doc["content"] for doc in doc_store]
        embeddings = embedding_model.encode(texts, convert_to_numpy=True).astype(np.float32)

        dimension   = embeddings.shape[1]
        faiss_index = faiss.IndexFlatL2(dimension)
        faiss_index.add(embeddings)

        logger.info(f"RAG: Reindexed successfully — {faiss_index.ntotal} documents")

    except Exception as e:
        logger.error(f"RAG: Reindex failed: {e}")


# ── 3. search_knowledge_base ──────────────────────────────────────────────────

async def search_knowledge_base(
    query:     str,
    top_k:     int   = 3,
    threshold: float = 2.0,     # Day 19: NEW param
) -> list:
    """
    Convert the query to an embedding and find the top_k most semantically
    similar documents in the FAISS index.

    Day 19 addition — threshold:
      FAISS always returns top_k results, even if they're completely unrelated.
      A query about "weather" would return billing/auth docs because FAISS finds
      the "closest" vectors it has, even if they're far away.

      L2 distance interpretation:
        0.0 – 0.5  → very similar (nearly identical text)
        0.5 – 1.5  → related (same topic)
        1.5 – 2.0  → loosely related (borderline)
        2.0+       → unrelated — filtered out by default threshold

      Lower threshold = stricter (fewer but more precise results)
      Higher threshold = looser (more results, risk of noise)
    """
    if faiss_index is None or embedding_model is None:
        logger.warning("RAG: Not initialized — returning empty results")
        return []

    if not query.strip():
        return []

    try:
        query_embedding = embedding_model.encode(
            [query],
            convert_to_numpy=True,
        ).astype(np.float32)

        actual_k = min(top_k, faiss_index.ntotal)
        D, I     = faiss_index.search(query_embedding, actual_k)

        results = []
        for idx, distance in zip(I[0], D[0]):
            if idx == -1:
                continue
            # Day 19: filter out low-relevance results
            if distance > threshold:
                logger.debug(
                    f"RAG: Skipping doc '{doc_store[idx]['title']}' "
                    f"(distance {distance:.2f} > threshold {threshold})"
                )
                continue
            doc = doc_store[idx].copy()
            doc["relevance_score"] = float(distance)
            results.append(doc)

        logger.info(
            f"RAG: '{query[:50]}' → "
            f"{len(results)} results within threshold "
            f"(best: {D[0][0]:.3f})"
        )
        return results

    except Exception as e:
        logger.error(f"RAG: Search failed: {e}")
        return []


# ── 4. generate_rag_response ──────────────────────────────────────────────────

async def generate_rag_response(
    question:             str,
    conversation_history: Optional[list] = None,   # Day 19: NEW param
    ticket_context:       Optional[dict] = None,
) -> tuple[str, list]:
    """
    Full RAG pipeline:
      1. Search knowledge base (with threshold filtering)
      2. Build augmented prompt: ticket + recent history + KB docs + question
      3. Call Gemini
      4. Return grounded answer and sources
    """
    from app.services.ai_service import client

    relevant_docs = await search_knowledge_base(question, top_k=3)

    prompt = _build_rag_prompt(
        question=question,
        relevant_docs=relevant_docs,
        ticket_context=ticket_context,
        conversation_history=conversation_history,  # Day 19
    )

    try:
        response = client.models.generate_content(
            model="gemini-2.5-flash",
            contents=prompt,
        )
        return response.text, relevant_docs

    except Exception as e:
        logger.error(f"RAG: Gemini call failed: {e}")
        raise e


# ── 5. _build_rag_prompt ──────────────────────────────────────────────────────

def _build_rag_prompt(
    question:             str,
    relevant_docs:        list,
    ticket_context:       Optional[dict] = None,
    conversation_history: Optional[list] = None,   # Day 19: NEW param
) -> str:
    """
    Build the augmented prompt sent to Gemini.

    Structure (in order):
      1. System instruction
      2. Ticket context (optional)
      3. Recent conversation — last 4 messages (Day 19, optional)
      4. Retrieved KB docs
      5. Current question
      6. Output instruction
    """
    prompt = (
        "You are a helpful customer support assistant. "
        "First, determine if you have enough details from the customer to understand their specific issue. "
        "If their request is vague or lacks necessary details, politely ask clarifying questions before attempting to provide a solution. "
        "Once you have enough details, answer the customer's question using ONLY the knowledge base "
        "information provided below. "
        "If the answer is not in the knowledge base, say so honestly "
        "and offer to connect them with a human agent.\n\n"
    )

    # 1. Ticket context
    if ticket_context:
        prompt += (
            f"Ticket context:\n"
            f"  Title:    {ticket_context.get('title', '')}\n"
            f"  Category: {ticket_context.get('category', '')}\n"
            f"  Status:   {ticket_context.get('status', '')}\n\n"
        )

    # 2. Recent conversation history (Day 19)
    # Why only last 4? Token limit. Older turns add noise, not value.
    if conversation_history:
        recent = conversation_history[-4:]
        prompt += "Recent conversation:\n"
        for msg in recent:
            role = "Customer" if msg["role"] == "user" else "Support Agent"
            prompt += f"  {role}: {msg['content']}\n"
        prompt += "\n"

    # 3. Retrieved KB docs
    if relevant_docs:
        prompt += "Relevant knowledge base articles:\n"
        prompt += "-" * 40 + "\n"
        for i, doc in enumerate(relevant_docs, 1):
            prompt += f"{i}. [{doc['title']}]\n"
            prompt += f"   {doc['content']}\n\n"
        prompt += "-" * 40 + "\n\n"
    else:
        prompt += (
            "Note: No relevant knowledge base articles found for this query. "
            "Answer based on the conversation context if possible.\n\n"
        )

    prompt += f"Customer question: {question}\n\n"
    prompt += (
        "Please provide a clear, helpful answer based on the knowledge base above. "
        "Be specific and reference the relevant policy or procedure."
    )

    return prompt


# ── Helper utilities ──────────────────────────────────────────────────────────

def is_rag_ready() -> bool:
    """Return True if RAG is initialized and ready to serve queries."""
    return faiss_index is not None and embedding_model is not None


def get_knowledge_base() -> list:
    """
    Return all knowledge base documents.
    Day 20: returns doc_store (populated from MongoDB) not the static file.
    """
    return doc_store


def get_kb_by_category(category: str) -> list:
    """Return all docs for a given category."""
    return [doc for doc in doc_store if doc["category"] == category]


def get_kb_categories() -> list:
    """Return all unique categories in the knowledge base."""
    return list(set(doc["category"] for doc in doc_store))


def get_rag_stats() -> dict:
    """Return stats about the current RAG index."""
    return {
        "ready":      is_rag_ready(),
        "total_docs": faiss_index.ntotal if faiss_index else 0,
        "dimensions": faiss_index.d      if faiss_index else 0,
        "model":      "all-MiniLM-L6-v2",
        "kb_size":    len(doc_store),
    }