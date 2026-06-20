from app.db.client import get_supabase
from app.db.types import DatabaseRow


def upsert_schedule_inbox_items(
    user_id: str,
    memo_id: str,
    items: list[DatabaseRow],
) -> None:
    if not items:
        return

    client = get_supabase()
    rows = [{"user_id": user_id, "memo_id": memo_id, **item} for item in items]
    client.table("schedule_inbox").upsert(rows, on_conflict="user_id,source_key").execute()
