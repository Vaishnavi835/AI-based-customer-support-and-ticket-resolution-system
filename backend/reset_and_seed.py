import asyncio
from datetime import datetime, timedelta, timezone
import random
import uuid
from motor.motor_asyncio import AsyncIOMotorClient

import os
from dotenv import load_dotenv

load_dotenv()
MONGO_URI = os.getenv("MONGO_URL", "mongodb://localhost:27017")
DB_NAME = os.getenv("DB_NAME", "support_ai_db")

async def seed():
    client = AsyncIOMotorClient(MONGO_URI)
    db = client[DB_NAME]
    
    print("Clearing existing tickets...")
    await db[os.getenv("TICKETS_COLLECTION", "tickets")].delete_many({})
    
    users_cursor = db[os.getenv("USERS_COLLECTION", "users")].find({})
    users = await users_cursor.to_list(100)
    
    customers = [u["_id"] for u in users if u.get("role") == "customer"]
    agents = [u["_id"] for u in users if u.get("role") == "support_agent"]

    # If no users exist, let's create a few mock users for seeding
    if not customers:
        from app.utils.auth import hash_password
        customers = []
        for i in range(3):
            u_id = str(uuid.uuid4())
            await db[os.getenv("USERS_COLLECTION", "users")].insert_one({
                "_id": u_id,
                "name": f"Customer {i+1}",
                "email": f"customer{i+1}@example.com",
                "password": hash_password("Password123!"),
                "role": "customer",
                "created_at": datetime.now(timezone.utc)
            })
            customers.append(u_id)
            
    if not agents:
        from app.utils.auth import hash_password
        agents = []
        for i in range(2):
            u_id = str(uuid.uuid4())
            await db[os.getenv("USERS_COLLECTION", "users")].insert_one({
                "_id": u_id,
                "name": f"Agent {i+1}",
                "email": f"agent{i+1}@example.com",
                "password": hash_password("Password123!"),
                "role": "support_agent",
                "created_at": datetime.now(timezone.utc)
            })
            agents.append(u_id)
    
    now = datetime.now(timezone.utc)
    tickets = []
    
    def make_ticket(status, hours_ago_created, priority="medium", rating=None, resolved_hours_ago=None, updated_hours_ago=0):
        t_id = str(uuid.uuid4())
        created = now - timedelta(hours=hours_ago_created)
        updated = now - timedelta(hours=updated_hours_ago)
        resolved = (now - timedelta(hours=resolved_hours_ago)) if resolved_hours_ago else None
        
        ticket = {
            "_id": t_id,
            "id": t_id,
            "title": f"Issue with {random.choice(['billing', 'login', 'dashboard', 'export', 'API'])}",
            "description": "User is experiencing an issue. Please assist.",
            "status": status,
            "priority": priority,
            "urgency": random.choice(["low", "medium", "high"]),
            "category": random.choice(["billing", "technical", "account", "finance", "general"]),
            "requester_id": random.choice(customers),
            "user_id": random.choice(customers),
            "assigned_to": random.choice(agents) if status not in ["open"] else None,
            "cc_emails": [],
            "created_at": created,
            "updated_at": updated,
            "resolved_at": resolved,
            "rating": rating,
            "history": []
        }
        return ticket

    for i in range(12):
        tickets.append(make_ticket("open", random.uniform(0.2, 5.0), updated_hours_ago=random.uniform(0.1, 0.2)))

    for i in range(3):
        tickets.append(make_ticket("pending", random.uniform(3, 10.0), updated_hours_ago=random.uniform(1, 2)))

    for i in range(4):
        tickets.append(make_ticket("escalated", random.uniform(25, 30.0), priority="high", updated_hours_ago=random.uniform(1, 4)))

    for i in range(4):
        created = random.uniform(5, 12)
        resolved = created - random.uniform(1, 3)
        tickets.append(make_ticket("resolved", created, rating=random.choice([4, 5]), resolved_hours_ago=resolved, updated_hours_ago=resolved))

    for i in range(2):
        created = random.uniform(30, 40)
        resolved = created - random.uniform(25, 28)
        tickets.append(make_ticket("resolved", created, rating=random.choice([2, 3]), resolved_hours_ago=resolved, updated_hours_ago=resolved))

    print(f"Inserting {len(tickets)} tickets...")
    await db[os.getenv("TICKETS_COLLECTION", "tickets")].insert_many(tickets)
    print("Seed complete.")

if __name__ == "__main__":
    asyncio.run(seed())
