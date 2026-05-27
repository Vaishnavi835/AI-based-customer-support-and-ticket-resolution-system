from motor.motor_asyncio import AsyncIOMotorClient
from dotenv import load_dotenv
import os

load_dotenv()

MONGO_URL = os.getenv("MONGO_URL", "mongodb://localhost:27017")
DB_NAME   = os.getenv("DB_NAME",   "ai_support_db")

client = AsyncIOMotorClient(MONGO_URL)
db     = client[DB_NAME]

users_col     = db["users"]
tickets_col   = db["tickets"]
chat_col      = db["chat_history"]
knowledge_col = db["knowledge_base"]