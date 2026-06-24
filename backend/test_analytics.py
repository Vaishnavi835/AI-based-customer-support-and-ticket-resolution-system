import asyncio
from app.database.connection import connect_db, get_db
from app.services.ticket_service import get_ticket_analytics, get_agent_workload

async def main():
    await connect_db()
    try:
        analytics = await get_ticket_analytics(30)
        print("ANALYTICS:", analytics)
        workload = await get_agent_workload()
        print("WORKLOAD:", workload)
    except Exception as e:
        print("ERROR:", e)

if __name__ == "__main__":
    asyncio.run(main())
