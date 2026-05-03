# STUB — Lead replaces internals. Backend 2 calls these functions as-is.

def schedule_medicine(medicine_id: str, reminder_times: list) -> None:
    print(f"[STUB] Would schedule {medicine_id} at {reminder_times}")

def unschedule_medicine(medicine_id: str) -> None:
    print(f"[STUB] Would unschedule {medicine_id}")

def reschedule_medicine(medicine_id: str, new_times: list) -> None:
    unschedule_medicine(medicine_id)
    schedule_medicine(medicine_id, new_times)
