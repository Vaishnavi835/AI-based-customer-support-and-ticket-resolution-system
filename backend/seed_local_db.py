"""
seed_local_db.py
================
Seeds the LOCAL MongoDB with demo users so login works right away.

Run with:
    .\\venv\\Scripts\\python.exe seed_local_db.py
"""
import sys, uuid
from datetime import datetime, timezone

sys.path.insert(0, ".")

from pymongo import MongoClient
from app.utils.auth import hash_password

MONGO_URL = "mongodb://localhost:27017"
DB_NAME   = "ai_support_db"

DEMO_USERS = [
    {
        "name":     "Admin User",
        "email":    "admin@support.com",
        "password": "Admin@123",
        "role":     "admin",
    },
    {
        "name":     "Support Agent",
        "email":    "agent@support.com",
        "password": "Agent@123",
        "role":     "support_agent",
    },
    {
        "name":     "Demo Customer",
        "email":    "customer@support.com",
        "password": "Customer@123",
        "role":     "customer",
    },
]


def seed():
    client = MongoClient(MONGO_URL, serverSelectionTimeoutMS=5000)
    # Verify connection
    client.admin.command("ping")
    print("[OK] Connected to local MongoDB")

    db        = client[DB_NAME]
    users_col = db["users"]

    for u in DEMO_USERS:
        existing = users_col.find_one({"email": u["email"]})
        if existing:
            # Reset password and clear lockout on existing user
            users_col.update_one(
                {"email": u["email"]},
                {"$set": {
                    "password":              hash_password(u["password"]),
                    "failed_login_attempts": 0,
                    "lockout_until":         None,
                }},
            )
            print(f"[UPDATED] {u['email']}")
        else:
            users_col.insert_one({
                "_id":                    str(uuid.uuid4()),
                "name":                   u["name"],
                "email":                  u["email"],
                "password":               hash_password(u["password"]),
                "role":                   u["role"],
                "created_at":             datetime.now(timezone.utc),
                "failed_login_attempts":  0,
                "lockout_until":          None,
            })
            print(f"[CREATED] {u['email']}")

    print("\nSeeding complete! Login credentials:")
    print("=" * 50)
    for u in DEMO_USERS:
        print(f"  {u['role']:15s} | {u['email']:28s} | {u['password']}")
    print("=" * 50)


if __name__ == "__main__":
    seed()
