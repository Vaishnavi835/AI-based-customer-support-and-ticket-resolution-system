from datetime import datetime, timezone


def utcnow() -> datetime:
    return datetime.now(timezone.utc)


def serialize_doc(doc: dict) -> dict:
    if doc and "_id" in doc:
        doc["id"] = doc.pop("_id")
    return doc


def serialize_docs(docs: list) -> list:
    return [serialize_doc(d) for d in docs]