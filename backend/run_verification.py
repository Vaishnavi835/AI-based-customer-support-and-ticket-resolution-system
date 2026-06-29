import asyncio
from fastapi.testclient import TestClient
from app.main import app
from app.utils.dependencies import get_current_user
from app.schemas.user import UserResponse
from app.database.connection import get_db
from datetime import datetime, timedelta, timezone

def override_get_current_user(role, user_id):
    async def _mock():
        return {"_id": user_id, "id": user_id, "role": role, "email": f"{user_id}@test.com", "name": user_id}
    return _mock

async def test_4_customer_cannot_hit_cc(client):
    print("Running Test 4: Customer hits GET /tickets/cc")
    app.dependency_overrides[get_current_user] = override_get_current_user("customer", "cust_1")
    res = await client.get("/tickets/cc")
    print(f"Status: {res.status_code}")
    assert res.status_code == 403, f"Expected 403 Forbidden, got {res.status_code}"
    print("Test 4 Passed!")

async def test_5_agent_cannot_self_cc_unassigned(client):
    print("\nRunning Test 5: Agent self-CCs to unassigned ticket")
    db = get_db()
    ticket_id = "test_ticket_5"
    await db.tickets_col.delete_one({"_id": ticket_id})
    await db.tickets_col.insert_one({"_id": ticket_id, "assigned_to": "agent_1", "cc_agents": []})
    
    app.dependency_overrides[get_current_user] = override_get_current_user("support_agent", "agent_2")
    res = await client.patch(f"/tickets/{ticket_id}/cc", json={"add_agent_id": "agent_2"})
    print(f"Status: {res.status_code}")
    assert res.status_code == 403, f"Expected 403 Forbidden, got {res.status_code}"
    
    await db.tickets_col.delete_one({"_id": ticket_id})
    print("Test 5 Passed!")

async def test_7_last_30_days_exclusion(client):
    print("\nRunning Test 7: Last 30 Days logic")
    db = get_db()
    t1_id = "t_recent"
    t2_id = "t_old"
    await db.tickets_col.delete_many({"_id": {"$in": [t1_id, t2_id]}})
    now = datetime.now(timezone.utc)
    recent = now - timedelta(days=10)
    old = now - timedelta(days=35)
    
    await db.tickets_col.insert_many([
        {"_id": t1_id, "status": "resolved", "resolved_at": recent, "assigned_to": "agent_1"},
        {"_id": t2_id, "status": "closed", "resolved_at": old, "assigned_to": "agent_1"}
    ])
    
    app.dependency_overrides[get_current_user] = override_get_current_user("support_agent", "agent_1")
    res = await client.get("/tickets/completed-recent")
    tickets = res.json()
    ids = [t["id"] for t in tickets]
    
    print(f"Returned IDs: {ids}")
    assert t1_id in ids, "Recent ticket missing"
    assert t2_id not in ids, "Old ticket wrongly included"
    
    await db.tickets_col.delete_many({"_id": {"$in": [t1_id, t2_id]}})
    print("Test 7 Passed!")

async def test_8_race_condition(client):
    print("\nRunning Test 8: CC Race condition prevention")
    db = get_db()
    ticket_id = "t_race"
    await db.tickets_col.delete_one({"_id": ticket_id})
    await db.users_col.delete_many({"_id": {"$in": ["agent_x", "agent_y"]}})
    
    await db.users_col.insert_many([
        {"_id": "agent_x", "id": "agent_x", "role": "support_agent", "email": "agent_x@test.com", "name": "Agent X"},
        {"_id": "agent_y", "id": "agent_y", "role": "support_agent", "email": "agent_y@test.com", "name": "Agent Y"},
    ])
    
    await db.tickets_col.insert_one({"_id": ticket_id, "assigned_to": "admin_1", "cc_agents": ["start_agent"]})
    
    app.dependency_overrides[get_current_user] = override_get_current_user("admin", "admin_1")
    
    r1 = client.patch(f"/tickets/{ticket_id}/cc", json={"add_agent_id": "agent_x"})
    r2 = client.patch(f"/tickets/{ticket_id}/cc", json={"add_agent_id": "agent_y"})
    await asyncio.gather(r1, r2)
    
    t = await db.tickets_col.find_one({"_id": ticket_id})
    print(f"Final CCs: {t['cc_agents']}")
    assert "start_agent" in t["cc_agents"]
    assert "agent_x" in t["cc_agents"]
    assert "agent_y" in t["cc_agents"]
    
    await db.tickets_col.delete_one({"_id": ticket_id})
    await db.users_col.delete_many({"_id": {"$in": ["agent_x", "agent_y"]}})
    print("Test 8 Passed!")

async def async_main():
    from app.database.connection import connect_db, disconnect_db
    from app.services.kb_service import seed_knowledge_base
    from app.services.rag_service import initialize_rag
    from httpx import AsyncClient, ASGITransport

    await connect_db()
    await seed_knowledge_base()
    await initialize_rag()

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://testserver") as client:
        await test_4_customer_cannot_hit_cc(client)
        await test_5_agent_cannot_self_cc_unassigned(client)
        await test_7_last_30_days_exclusion(client)
        await test_8_race_condition(client)

    await disconnect_db()

def main():
    import nest_asyncio
    nest_asyncio.apply()
    asyncio.run(async_main())

if __name__ == "__main__":
    main()
