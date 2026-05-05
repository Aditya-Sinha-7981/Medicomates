import asyncio
from datetime import datetime, timezone, timedelta
from utils.supabase_client import supabase
from utils.adherence_stats import compute_status, calculate_percentage

async def test():
    patient_id = "mock-patient-uuid-001"
    days = 30
    cutoff = (datetime.now(timezone.utc) - timedelta(days=days)).isoformat()
    result = supabase.table("adherence_logs").select("*, medicines(name)").eq("patient_id", patient_id).gte("scheduled_time", cutoff).order("scheduled_time", desc=True).execute()
    print(result.data)

asyncio.run(test())
