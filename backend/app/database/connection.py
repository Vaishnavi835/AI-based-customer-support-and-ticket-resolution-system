from motor.motor_asyncio import AsyncIOMotorClient
from dotenv import load_dotenv
import os
import logging

load_dotenv()

logger = logging.getLogger(__name__)


class Database:
    client: AsyncIOMotorClient = None
    db = None

    # Collection handles - set during startup
    users_col     = None
    tickets_col   = None
    chat_col      = None
    knowledge_col = None


db_instance = Database()


async def connect_db():
    """Connect to MongoDB - called on app startup."""
    try:
        mongo_url  = os.getenv("MONGO_URL", "mongodb://localhost:27017")
        db_name    = os.getenv("DB_NAME",   "ai_support_db")

        db_instance.client = AsyncIOMotorClient(mongo_url)
        db_instance.db     = db_instance.client[db_name]

        # Load collection names from .env
        db_instance.users_col     = db_instance.db[os.getenv("USERS_COLLECTION",    "users")]
        db_instance.tickets_col   = db_instance.db[os.getenv("TICKETS_COLLECTION",  "tickets")]
        db_instance.chat_col      = db_instance.db[os.getenv("CHAT_COLLECTION",     "chat_history")]
        db_instance.knowledge_col = db_instance.db[os.getenv("KNOWLEDGE_COLLECTION","knowledge_base")]

        # Ping to verify connection is actually alive
        await db_instance.client.admin.command("ping")
        logger.info(f"Connected to MongoDB: {db_name}")

    except Exception as e:
        logger.error(f"Failed to connect to MongoDB: {e}")
        raise


async def disconnect_db():
    """Disconnect from MongoDB - called on app shutdown."""
    if db_instance.client:
        db_instance.client.close()
        logger.info("Disconnected from MongoDB")


def get_db() -> Database:
    """Return the database instance for use in routes."""
    return db_instance
