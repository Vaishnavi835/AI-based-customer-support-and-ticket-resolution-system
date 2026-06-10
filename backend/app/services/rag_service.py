"""
RAG Service — Retrieval Augmented Generation

Day 16: Structure and knowledge base setup
Day 17: Full FAISS integration + semantic search + Gemini augmentation

Pipeline:
  1. Load knowledge base docs
  2. Generate embeddings for each doc (done once at startup)
  3. Store in FAISS index
  4. At query time: embed the question, find top-k similar docs
  5. Pass question + retrieved docs to Gemini
"""

from app.knowledge.sample_docs import KNOWLEDGE_BASE


# ── These will be initialized at app startup (Day 17) ────────────────────────
faiss_index   = None   # the FAISS index holding all doc embeddings
doc_store     = []     # list of docs in the same order as the FAISS index
embedding_model = None # SentenceTransformer model


def get_knowledge_base() -> list:
    """Return all knowledge base documents."""
    return KNOWLEDGE_BASE


def get_kb_by_category(category: str) -> list:
    """Return all docs for a given category."""
    return [doc for doc in KNOWLEDGE_BASE if doc["category"] == category]


def get_kb_categories() -> list:
    """Return all unique categories in the knowledge base."""
    return list(set(doc["category"] for doc in KNOWLEDGE_BASE))


# ── Stubs — will be implemented Day 17 ───────────────────────────────────────

async def initialize_rag():
    """
    Load embedding model, embed all knowledge base docs, build FAISS index.
    Called once at app startup.
    """
    # TODO Day 17
    pass


async def search_knowledge_base(query: str, top_k: int = 3) -> list:
    """
    Embed the query and retrieve the top_k most relevant docs from FAISS.
    Returns list of matching knowledge base entries.
    """
    # TODO Day 17
    return []


async def generate_rag_response(
    question: str,
    ticket_context: dict = None,
) -> str:
    """
    Full RAG pipeline:
      1. Search knowledge base for relevant docs
      2. Build augmented prompt with retrieved context
      3. Call Gemini with question + context
      4. Return grounded answer
    """
    # TODO Day 17
    return ""