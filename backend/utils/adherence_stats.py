from datetime import datetime, timezone

def calculate_percentage(taken: int, total: int) -> int:
    if total == 0:
        return 0
    return round((taken / total) * 100)

def compute_status(scheduled_time: str, confirmed_at: str | None) -> str:
    if confirmed_at is not None:
        return "taken"
    
    # Parse scheduled_time. Assumes UTC isoformat (e.g., 2025-04-10T08:00:00Z or +00:00)
    try:
        # replace Z with +00:00 for fromisoformat compatibility in python 3.10-, though 3.11 supports Z
        s_time = datetime.fromisoformat(scheduled_time.replace("Z", "+00:00"))
        if s_time < datetime.now(timezone.utc):
            return "missed"
        return "pending"
    except Exception:
        return "pending"

def calculate_streak(logs: list[dict]) -> dict:
    """
    Computes the current and best streak of days with 100% adherence.
    Logs must have scheduled_time and status (or we compute it).
    A day is 100% if all scheduled logs that are past due are "taken".
    If a day has a "missed" log, the streak is broken.
    Future ("pending") logs are ignored.
    """
    # Group logs by YYYY-MM-DD
    days = {}
    for log in logs:
        s_time_str = log.get("scheduled_time")
        if not s_time_str:
            continue
        try:
            dt = datetime.fromisoformat(s_time_str.replace("Z", "+00:00"))
            day_key = dt.date().isoformat()
            if day_key not in days:
                days[day_key] = []
            days[day_key].append(log)
        except Exception:
            pass

    # Sort days descending
    sorted_days = sorted(days.keys(), reverse=True)
    
    current_streak = 0
    best_streak = 0
    temp_streak = 0
    
    for day in sorted_days:
        day_logs = days[day]
        all_taken = True
        has_past = False
        
        for log in day_logs:
            status = log.get("status")
            if not status:
                status = compute_status(log["scheduled_time"], log.get("confirmed_at"))
            
            if status != "pending":
                has_past = True
                if status == "missed":
                    all_taken = False
                    break
        
        if has_past:
            if all_taken:
                temp_streak += 1
            else:
                if temp_streak > best_streak:
                    best_streak = temp_streak
                # current streak is only the streak counting backwards from the most recent day without missing
                if current_streak == 0 and temp_streak > 0:
                    current_streak = temp_streak 
                elif current_streak == temp_streak:
                    # we are still in the current streak block
                    pass
                else:
                    # we broke a previous streak
                    pass
                
                temp_streak = 0
                
    if temp_streak > best_streak:
        best_streak = temp_streak
        
    # If there were no missed days at all, current streak equals temp_streak
    if temp_streak > 0 and current_streak == 0:
        current_streak = temp_streak
    elif temp_streak > 0 and current_streak != temp_streak:
        # The last block was the oldest one, if we never updated current_streak properly
        # actually, if we never hit a missed day, current_streak is temp_streak
        pass
        
    # Recalculate accurately:
    # Go backwards from most recent day. If taken, current_streak++, if missed, stop.
    current_streak_calc = 0
    for day in sorted_days:
        day_logs = days[day]
        has_past = False
        all_taken = True
        for log in day_logs:
            status = log.get("status") or compute_status(log["scheduled_time"], log.get("confirmed_at"))
            if status != "pending":
                has_past = True
                if status == "missed":
                    all_taken = False
        if has_past:
            if all_taken:
                current_streak_calc += 1
            else:
                break
                
    # Best streak calculation over all blocks
    best_streak_calc = 0
    curr_block = 0
    for day in sorted(days.keys()): # ascending order
        day_logs = days[day]
        has_past = False
        all_taken = True
        for log in day_logs:
            status = log.get("status") or compute_status(log["scheduled_time"], log.get("confirmed_at"))
            if status != "pending":
                has_past = True
                if status == "missed":
                    all_taken = False
        if has_past:
            if all_taken:
                curr_block += 1
                best_streak_calc = max(best_streak_calc, curr_block)
            else:
                curr_block = 0

    return {"current": current_streak_calc, "best": best_streak_calc}

def calculate_time_window_percentage(logs: list[dict], start_date: datetime, end_date: datetime) -> int:
    """Calculates percentage of taken vs total (taken + missed) in a time window."""
    taken = 0
    total = 0
    for log in logs:
        try:
            s_time = datetime.fromisoformat(log["scheduled_time"].replace("Z", "+00:00"))
            if start_date <= s_time <= end_date:
                status = log.get("status") or compute_status(log["scheduled_time"], log.get("confirmed_at"))
                if status in ["taken", "missed"]:
                    total += 1
                    if status == "taken":
                        taken += 1
        except Exception:
            pass
            
    return calculate_percentage(taken, total)
