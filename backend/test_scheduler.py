import asyncio
from datetime import datetime, timedelta
import os
import sys

# Ensure backend directory is in python path
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from scheduler import scheduler, start_scheduler, shutdown_scheduler
from services.scheduler_service import schedule_medicine

async def main():
    print("Starting scheduler test...")
    start_scheduler()
    
    # IMPORTANT: Put an actual medicine_id from your Supabase database here!
    # Without a valid ID, the job will fail to fetch the medicine and exit early.
    medicine_id = input("Enter an active medicine_id from your database to test: ").strip()
    
    if not medicine_id:
        print("No medicine ID provided. Exiting.")
        return

    # Schedule a reminder for 1 minute from now
    now = datetime.now()
    test_time = now + timedelta(minutes=1)
    time_str = test_time.strftime("%H:%M")
    
    print(f"Scheduling reminder for {time_str}...")
    schedule_medicine(medicine_id, [time_str])
    
    print(f"\nWaiting for {time_str} to arrive... (Press Ctrl+C to cancel)")
    try:
        # Keep the event loop running so the scheduler can trigger the job
        while True:
            await asyncio.sleep(1)
    except KeyboardInterrupt:
        print("\nStopping scheduler...")
    finally:
        shutdown_scheduler()

if __name__ == "__main__":
    asyncio.run(main())
