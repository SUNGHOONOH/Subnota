from collections.abc import Iterable
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
    rows = fetch_dirty_memo_rows(row_scan_limit)
    return unique_user_ids(
        (
            row
            for row in rows
            if row.get("content_hash") is None
            or row.get("indexed_content_hash") is None
            or row.get("content_hash") != row.get("indexed_content_hash")
        ),
        user_limit,
    )


def fetch_profile_ids_with_dirty_schedule_memos(
    *,
    user_limit: int,
    row_scan_limit: int,
) -> list[str]:
    rows = fetch_dirty_memo_rows(row_scan_limit)
    return unique_user_ids(
        (
            row
            for row in rows
            if row.get("content_hash") is None
            or row.get("schedule_scanned_hash") is None
            or row.get("content_hash") != row.get("schedule_scanned_hash")
        ),
        user_limit,
    )


def fetch_profile_ids_with_dirty_topics(
    *,
    user_limit: int,
    row_scan_limit: int,
) -> list[str]:
    rows = fetch_dirty_memo_rows(row_scan_limit)
    return unique_user_ids(
        (row for row in rows if bool(row.get("topic_dirty"))),
        user_limit,
    )


def fetch_dirty_memo_rows(row_scan_limit: int) -> list[DatabaseRow]:
    client = get_supabase()
    response = (
        client.table("memos")
        .select(
            "user_id, content_hash, indexed_content_hash, "
            "schedule_scanned_hash, topic_dirty, updated_at"
        )
        .eq("is_archived", False)
        .order("updated_at", desc=True)
        .limit(row_scan_limit)
        .execute()
    )
    return cast(list[DatabaseRow], response.data or [])


def unique_user_ids(rows: Iterable[DatabaseRow], user_limit: int) -> list[str]:
    user_ids: list[str] = []
    seen: set[str] = set()

    for row in rows:
        if not isinstance(row, dict):
            continue
        user_id = str(row.get("user_id") or "")
        if not user_id or user_id in seen:
            continue

        seen.add(user_id)
        user_ids.append(user_id)

        if len(user_ids) >= user_limit:
            break

    return user_ids
