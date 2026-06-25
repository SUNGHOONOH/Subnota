from typing import cast

from app.db.client import get_supabase
from app.db.types import DatabaseRow


def fetch_profile_ids() -> list[str]:
    client = get_supabase()
    response = client.table("profiles").select("id").execute()
    rows = cast(list[DatabaseRow], response.data or [])
    return [str(row["id"]) for row in rows if row.get("id")]


def fetch_profile_ids_with_dirty_chunk_memos(
    *,
    user_limit: int,
    row_scan_limit: int,
) -> list[str]:
    return fetch_dirty_user_ids("chunks", user_limit, row_scan_limit)


def fetch_profile_ids_with_dirty_schedule_memos(
    *,
    user_limit: int,
    row_scan_limit: int,
) -> list[str]:
    return fetch_dirty_user_ids("schedule", user_limit, row_scan_limit)


def fetch_profile_ids_with_dirty_topics(
    *,
    user_limit: int,
    row_scan_limit: int,
) -> list[str]:
    return fetch_dirty_user_ids("topics", user_limit, row_scan_limit)


def fetch_dirty_user_ids(kind: str, user_limit: int, row_scan_limit: int) -> list[str]:
    response = get_supabase().rpc(
        "find_dirty_memo_user_ids",
        {
            "p_kind": kind,
            "p_row_scan_limit": row_scan_limit,
            "p_user_limit": user_limit,
        },
    ).execute()
    rows = cast(list[DatabaseRow], response.data or [])
    return [str(row["user_id"]) for row in rows if row.get("user_id")]
