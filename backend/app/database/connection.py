from motor.motor_asyncio import AsyncIOMotorClient
from dotenv import load_dotenv
from urllib.parse import quote_plus
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
    mongo_url  = os.getenv("MONGO_URL", "mongodb://localhost:27017")
    db_name    = os.getenv("DB_NAME",   "ai_support_db")
    try:
        # Use serverSelectionTimeoutMS=5000 to timeout connection after 5 seconds
        db_instance.client = AsyncIOMotorClient(mongo_url, serverSelectionTimeoutMS=5000)
        db_instance.db     = db_instance.client[db_name]

        # Load collection handles
        db_instance.users_col     = db_instance.db[os.getenv("USERS_COLLECTION",    "users")]
        db_instance.tickets_col   = db_instance.db[os.getenv("TICKETS_COLLECTION",  "tickets")]
        db_instance.chat_col      = db_instance.db[os.getenv("CHAT_COLLECTION",     "chat_history")]
        db_instance.knowledge_col = db_instance.db[os.getenv("KNOWLEDGE_COLLECTION","knowledge_base")]

        # Ping database to confirm the connection is active
        await db_instance.client.admin.command("ping")
        logger.info(f"Successfully connected to MongoDB: {db_name}")

        # Create indexes for search performance
        await db_instance.tickets_col.create_index("status")
        await db_instance.tickets_col.create_index("priority")
        await db_instance.tickets_col.create_index("assigned_to")
        await db_instance.tickets_col.create_index("user_id")
        logger.info("Database indexes created")

    except Exception as e:
        logger.error("=" * 60)
        logger.error(f"FATAL: Database connection failed: {e}")
        if "localhost" not in mongo_url:
            logger.error("Troubleshooting cloud connection (MongoDB Atlas):")
            logger.error("1. Check if you added your IP address to 'Network Access' / IP Access List in Atlas.")
            logger.error("2. Ensure username, password, and database name are correct in the connection string.")
        else:
            logger.error("Troubleshooting local connection:")
            logger.error("1. Ensure local MongoDB service is installed and running.")
        logger.error("=" * 60)
        raise



async def disconnect_db():
    """Disconnect from MongoDB - called on app shutdown."""
    if db_instance.client:
        db_instance.client.close()
        logger.info("Disconnected from MongoDB")


def get_db() -> Database:
    """Return the database instance for use in routes."""
    return db_instance
