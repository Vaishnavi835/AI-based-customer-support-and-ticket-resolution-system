"""
RAG Service — Retrieval Augmented Generation
============================================

Pipeline:
  SETUP (once at startup):
    knowledge docs → embedding model → 384-number vectors → FAISS index

  AT QUERY TIME:
    question → embedding → query vector
                               ↓
                  FAISS finds closest doc vectors
                               ↓
                    top-k docs retrieved
                               ↓
          question + docs → Gemini → grounded answer

Key concepts implemented here:
  - Embeddings   : all-MiniLM-L6-v2 converts text → 384 numbers
  - Chunking     : each knowledge doc is one focused chunk (done in sample_docs.py)
  - Vector store : FAISS IndexFlatL2 stores all doc vectors in memory
  - Semantic search : cosine-like distance finds meaning-similar docs
"""

import os
import logging
import numpy as np
from app.knowledge.sample_docs import KNOWLEDGE_BASE

logger = logging.getLogger(__name__)

# ── Module-level state (loaded once at startup) ───────────────────────────────
faiss_index     = None   # FAISS index holding all doc embeddings
doc_store       = []     # list of docs in the same order as FAISS index
embedding_model = None   # SentenceTransformer model


# ── 1. initialize_rag ─────────────────────────────────────────────────────────

async def initialize_rag():
    """
    Load the embedding model, embed every knowledge base document,
    and build a FAISS index. Called once at app startup.

    Why module-level globals?
    Loading the model takes ~2 seconds and downloading it takes time once.
    We load it once at startup and reuse it for every query.
    """
    global faiss_index, doc_store, embedding_model

    try:
        import faiss
        from sentence_transformers import SentenceTransformer

        logger.info("RAG: Loading embedding model (all-MiniLM-L6-v2)...")
        embedding_model = SentenceTransformer("all-MiniLM-L6-v2")
        logger.info("RAG: Embedding model loaded")

        # Extract the text content from each knowledge base doc
        # This is what gets embedded — the actual text, not the metadata
        doc_store = KNOWLEDGE_BASE.copy()
        texts     = [doc["content"] for doc in doc_store]

        logger.info(f"RAG: Embedding {len(texts)} knowledge base documents...")

        # Generate embeddings — returns numpy array of shape (n_docs, 384)
        # Each row is one document converted to 384 numbers
        embeddings = embedding_model.encode(
            texts,
            show_progress_bar=True,    # shows progress in terminal
            convert_to_numpy=True,
        )

        # FAISS needs float32 specifically
        embeddings = embeddings.astype(np.float32)

        # Build the FAISS index
        # IndexFlatL2 = flat (brute force) index using L2 (Euclidean) distance
        # "Flat" means it checks every vector — perfect for small knowledge bases
        # For 1000+ docs you'd switch to IndexIVFFlat for speed
        dimension   = embeddings.shape[1]   # 384 for all-MiniLM-L6-v2
        faiss_index = faiss.IndexFlatL2(dimension)

        # Add all embeddings to the index
        faiss_index.add(embeddings)

        logger.info(
            f"RAG: FAISS index built — "
            f"{faiss_index.ntotal} vectors, "
            f"{dimension} dimensions"
        )

    except ImportError as e:
        logger.warning(f"RAG: Missing dependency ({e}). RAG disabled.")
        logger.warning("RAG: Run: pip install faiss-cpu sentence-transformers")
    except Exception as e:
        logger.error(f"RAG: Initialization failed: {e}")


# ── 2. search_knowledge_base ──────────────────────────────────────────────────

async def search_knowledge_base(query: str, top_k: int = 3) -> list:
    """
    Convert the query to an embedding and find the top_k most
    semantically similar documents in the FAISS index.

    Returns a list of matching knowledge base dicts, ordered by relevance.

    How it works:
      1. Embed the query → 384 numbers
      2. FAISS computes L2 distance between query vector and every stored vector
      3. Returns indices of the top_k closest vectors
      4. We look up those indices in doc_store to get the actual docs
    """
    if faiss_index is None or embedding_model is None:
        logger.warning("RAG: Not initialized — returning empty results")
        return []

    if not query.strip():
        return []

    try:
        # Embed the query — same model, same 384-dimension space
        query_embedding = embedding_model.encode(
            [query],
            convert_to_numpy=True,
        ).astype(np.float32)

        # Search FAISS
        # D = distances array  shape: (1, top_k)
        # I = indices array    shape: (1, top_k)
        # Lower distance = more similar
        actual_k = min(top_k, faiss_index.ntotal)
        D, I     = faiss_index.search(query_embedding, actual_k)

        # Build results — attach distance score so caller can see confidence
        results = []
        for idx, distance in zip(I[0], D[0]):
            if idx == -1:          # FAISS returns -1 for empty slots
                continue
            doc = doc_store[idx].copy()
            doc["relevance_score"] = float(distance)   # lower = more relevant
            results.append(doc)

        logger.info(
            f"RAG: Query '{query[:50]}' → "
            f"{len(results)} results, "
            f"best distance: {D[0][0]:.3f}"
        )
        return results

    except Exception as e:
        logger.error(f"RAG: Search failed: {e}")
        return []


# ── 3. generate_rag_response ──────────────────────────────────────────────────

async def generate_rag_response(
    question: str,
    ticket_context: dict = None,
) -> str:
    """
    Full RAG pipeline:
      1. Search knowledge base for relevant docs
      2. Build an augmented prompt: question + retrieved context
      3. Call Gemini with the augmented prompt
      4. Return a grounded, specific answer

    The key difference from plain Gemini:
      Without RAG → Gemini answers from general training data (generic)
      With RAG    → Gemini answers using YOUR company's actual policies (specific)
    """
    from app.services.ai_service import client  # reuse existing Gemini client

    # Step 1 — retrieve relevant docs
    relevant_docs = await search_knowledge_base(question, top_k=3)

    # Step 2 — build the augmented prompt
    prompt = _build_rag_prompt(
        question=question,
        relevant_docs=relevant_docs,
        ticket_context=ticket_context,
    )

    # Step 3 — call Gemini with the enriched prompt
    try:
        response = client.models.generate_content(
            model="gemini-2.5-flash",
            contents=prompt,
        )
        return response.text

    except Exception as e:
        logger.error(f"RAG: Gemini call failed: {e}")
        return (
            "I'm having trouble generating a response right now. "
            "A support agent has been notified."
        )


def _build_rag_prompt(
    question: str,
    relevant_docs: list,
    ticket_context: dict = None,
) -> str:
    """
    Build the augmented prompt that gets sent to Gemini.

    Structure:
      [System instruction]
      [Ticket context — optional]
      [Retrieved knowledge base docs]
      [Customer question]
      [Instruction to use the docs]
    """
    prompt = (
        "You are a helpful customer support assistant. "
        "Answer the customer's question using ONLY the knowledge base "
        "information provided below. "
        "If the answer is not in the knowledge base, say so honestly "
        "and offer to connect them with a human agent.\n\n"
    )

    # Add ticket context if available
    if ticket_context:
        prompt += (
            f"Ticket context:\n"
            f"  Title: {ticket_context.get('title', '')}\n"
            f"  Category: {ticket_context.get('category', '')}\n"
            f"  Status: {ticket_context.get('status', '')}\n\n"
        )

    # Add retrieved knowledge base docs
    if relevant_docs:
        prompt += "Relevant knowledge base articles:\n"
        prompt += "-" * 40 + "\n"
        for i, doc in enumerate(relevant_docs, 1):
            prompt += f"{i}. [{doc['title']}]\n"
            prompt += f"   {doc['content']}\n\n"
        prompt += "-" * 40 + "\n\n"
    else:
        prompt += (
            "Note: No relevant knowledge base articles found for this query.\n\n"
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
    """Return all knowledge base documents."""
    return KNOWLEDGE_BASE


def get_kb_by_category(category: str) -> list:
    """Return all docs for a given category."""
    return [doc for doc in KNOWLEDGE_BASE if doc["category"] == category]


def get_kb_categories() -> list:
    """Return all unique categories in the knowledge base."""
    return list(set(doc["category"] for doc in KNOWLEDGE_BASE))


def get_rag_stats() -> dict:
    """Return stats about the current RAG index — useful for a health endpoint."""
    return {
        "ready":        is_rag_ready(),
        "total_docs":   faiss_index.ntotal if faiss_index else 0,
        "dimensions":   faiss_index.d      if faiss_index else 0,
        "model":        "all-MiniLM-L6-v2",
        "kb_size":      len(KNOWLEDGE_BASE),
    }