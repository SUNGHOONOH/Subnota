from typing import cast

from app.db.client import get_supabase
from app.db.types import DatabaseRow, MemoRecord
from app.db.utils import content_hash_for_memo, optional_str


def fetch_user_memos(user_id: str, *, include_empty: bool = False) -> list[MemoRecord]:
    client = get_supabase()
    response = (
        client.table("memos")
        .select(
            "id, content, content_hash, indexed_content_hash, "
            "schedule_scanned_hash, topic_dirty, created_at, updated_at, "
            "content_updated_at"
        )
        .eq("user_id", user_id)
        .eq("is_archived", False)
        .execute()
    )
    rows = cast(list[DatabaseRow], response.data or [])

    return [
        MemoRecord(
            id=str(row.get("id") or ""),
            content=str(row.get("content") or ""),
            content_hash=optional_str(row.get("content_hash")),
            indexed_content_hash=optional_str(row.get("indexed_content_hash")),
            schedule_scanned_hash=optional_str(row.get("schedule_scanned_hash")),
            topic_dirty=bool(row.get("topic_dirty")),
            created_at=optional_str(row.get("created_at")),
            updated_at=optional_str(row.get("updated_at")),
            content_updated_at=optional_str(row.get("content_updated_at")),
        )
        for row in rows
        if str(row.get("id") or "").strip()
        and (include_empty or str(row.get("content") or "").strip())
    ]


def fetch_memos_needing_schedule_scan(user_id: str, limit: int) -> list[MemoRecord]:
    return fetch_dirty_memos(user_id, "schedule", limit)


def fetch_dirty_memos(user_id: str, kind: str, limit: int) -> list[MemoRecord]:
    client = get_supabase()
    response = client.rpc(
        "fetch_dirty_memos",
        {"p_user_id": user_id, "p_kind": kind, "p_limit": limit},
    ).execute()
    rows = cast(list[DatabaseRow], response.data or [])
    return [
        MemoRecord(
            id=str(row.get("id") or ""),
            content=str(row.get("content") or ""),
            content_hash=optional_str(row.get("content_hash")),
            indexed_content_hash=optional_str(row.get("indexed_content_hash")),
            schedule_scanned_hash=optional_str(row.get("schedule_scanned_hash")),
            topic_dirty=bool(row.get("topic_dirty")),
            created_at=optional_str(row.get("created_at")),
            updated_at=optional_str(row.get("updated_at")),
            content_updated_at=optional_str(row.get("content_updated_at")),
        )
        for row in rows
        if str(row.get("id") or "").strip()
    ]


def mark_memo_schedule_scan_failed(memo_id: str) -> None:
    client = get_supabase()
    client.table("memos").update({"schedule_scan_status": "failed"}).eq(
        "id", memo_id
    ).execute()
