"""Shared helpers for PostgREST / supabase-py query batching (URL size, round-trips)."""

# PostgREST GET query strings grow with `.in_(uuid, [...])`; stay under typical limits.
IN_FILTER_CHUNK_SIZE = 80

# Minimal adherence row for rolling % in a time window (see adherence_stats.calculate_time_window_percentage).
ADHERENCE_WINDOW_COLUMNS = "patient_id, scheduled_time, confirmed_at"


def chunked_ids(ids: list[str], size: int = IN_FILTER_CHUNK_SIZE) -> list[list[str]]:
    """Split a list of UUID strings into chunks for batched `.in_()` filters."""
    return [ids[i : i + size] for i in range(0, len(ids), size)]
