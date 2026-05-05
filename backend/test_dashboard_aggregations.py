import sys
import json
from fastapi.testclient import TestClient

# Make sure main is accessible
import main
from utils.supabase_client import supabase

client = TestClient(main.app)

def run_tests():
    print("--- 🏥 Medicomates CORE Aggregation Tests ---\n")
    
    # 1. We need a patient ID. Let's find any existing patient in the database to test with.
    # We'll fetch from profiles where role='patient'
    try:
        profiles = supabase.table("profiles").select("id").eq("role", "patient").limit(1).execute()
        if not profiles.data:
            print("❌ No patient found in the database. Please ensure you have test data.")
            sys.exit(1)
            
        patient_id = profiles.data[0]["id"]
        print(f"✅ Found test patient ID: {patient_id}")
        
    except Exception as e:
        print(f"❌ Failed to query database: {e}")
        sys.exit(1)

    print(f"\n--- Testing GET /api/adherence/{patient_id} ---")
    response = client.get(f"/api/adherence/{patient_id}?days=30")
    if response.status_code == 200:
        data = response.json()
        print(f"✅ Success. Fetched {len(data)} logs.")
        if len(data) > 0:
            print(f"   Sample status injected: {data[0].get('status')}")
            print(f"   Sample medicine injected: {data[0].get('medicine_name')}")
    else:
        print(f"❌ Failed: {response.status_code} - {response.text}")

    print(f"\n--- Testing GET /api/adherence/{patient_id}/summary ---")
    response = client.get(f"/api/adherence/{patient_id}/summary")
    if response.status_code == 200:
        data = response.json()
        print(f"✅ Success. Found {len(data)} grouped medicines.")
        if len(data) > 0:
            print(f"   Sample overall %: {data[0].get('percentage')}%")
            if data[0].get('time_slots'):
                print(f"   Sample slot %: {data[0]['time_slots'][0].get('percentage')}% at {data[0]['time_slots'][0].get('time')}")
    else:
        print(f"❌ Failed: {response.status_code} - {response.text}")

    print(f"\n--- Testing GET /api/dashboard/patient/{patient_id} ---")
    response = client.get(f"/api/dashboard/patient/{patient_id}")
    if response.status_code == 200:
        data = response.json()
        print(f"✅ Success.")
        print(f"   Streak: {data.get('streak')}")
        print(f"   Weekly %: {data.get('weekly_percentage')}%")
        print(f"   Last Week %: {data.get('last_week_percentage')}%")
        print(f"   Today's Meds count: {len(data.get('todays_medicines', []))}")
    else:
        print(f"❌ Failed: {response.status_code} - {response.text}")
        
    # Test Doctor Dashboard (Find a doctor)
    try:
        doctors = supabase.table("profiles").select("id").eq("role", "doctor").limit(1).execute()
        if doctors.data:
            doctor_id = doctors.data[0]["id"]
            print(f"\n--- Testing GET /api/dashboard/doctor/{doctor_id} ---")
            response = client.get(f"/api/dashboard/doctor/{doctor_id}")
            if response.status_code == 200:
                data = response.json()
                print(f"✅ Success.")
                print(f"   Patients connected: {len(data.get('patients', []))}")
            else:
                print(f"❌ Failed: {response.status_code} - {response.text}")
        else:
            print("\n⚠️ No doctor found to test doctor dashboard.")
    except Exception as e:
        print(f"❌ Failed to test doctor dashboard: {e}")

    print("\n--- All Tests Completed ---")

if __name__ == "__main__":
    run_tests()
