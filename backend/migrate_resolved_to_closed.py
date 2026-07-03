"""
migrate_resolved_to_closed.py
==============================
One-time migration script.

Context:
  Under the OLD system, 'resolved' meant "ticket is done" (by anyone).
  Under the NEW system:
    - 'resolved' = customer self-solved (no agent/AI)
    - 'closed'   = solved by agent or AI assistant

This script bulk-updates all existing tickets whose status is still
'resolved' in the database to 'closed', since those were resolved
by support/AI under the old semantics.
"""

import asyncio
import os
from dotenv import load_dotenv
from motor.motor_asyncio import AsyncIOMotorClient
import certifi

load_dotenv(dotenv_path=os.path.join(os.path.dirname(__file__), ".env"))

MONGO_URL   = os.getenv("MONGO_URL", "mongodb://localhost:27017")
DB_NAME     = os.getenv("DB_NAME", "ai_support_db")
TICKETS_COL = os.getenv("TICKETS_COLLECTION", "tickets")


async def migrate():
    kwargs = {}
    if "localhost" not in MONGO_URL and "127.0.0.1" not in MONGO_URL:
        kwargs["tlsCAFile"] = certifi.where()

    client = AsyncIOMotorClient(MONGO_URL, **kwargs)
    db = client[DB_NAME]
    col = db[TICKETS_COL]

    # Count how many tickets will be affected
    count = await col.count_documents({"status": "resolved"})
    print(f"Found {count} ticket(s) with status='resolved'. Migrating to 'closed'...")

    if count == 0:
        print("Nothing to migrate.")
        client.close()
        return

    result = await col.update_many(
        {"status": "resolved"},
        {"$set": {"status": "closed"}}
    )

    print(f"Migration complete. Updated {result.modified_count} ticket(s) from 'resolved' to 'closed'.")
    client.close()


if __name__ == "__main__":
    asyncio.run(migrate())
