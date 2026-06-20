from typing import cast

from app.core import constants
from app.db.client import get_supabase
from app.db.types import DatabaseRow, MemoRecord
from app.db.utils import content_hash_for_memo, format_vector, optional_str, utc_now


def fetch_user_memos(user_id: str) -> list[MemoRecord]:
    client = get_supabase()
    response = (
        client.table("memos")
        .select(
            "id, content, content_hash, indexed_content_hash, "
            "schedule_scanned_hash, topic_dirty, created_at, updated_at"
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
        )
        for row in rows
        if str(row.get("id") or "").strip() and str(row.get("content") or "").strip()
    ]


def fetch_memos_needing_schedule_scan(user_id: str, limit: int) -> list[MemoRecord]:
    memos = fetch_user_memos(user_id)
    pending = [
        memo
        for memo in memos
        if memo.content_hash is None
        or memo.schedule_scanned_hash is None
        or memo.content_hash != memo.schedule_scanned_hash
    ]
    return pending[:limit]


def fetch_memos_needing_chunk_index(user_id: str, limit: int) -> list[MemoRecord]:
    memos = fetch_user_memos(user_id)
    pending = [
        memo
        for memo in memos
        if memo.content_hash is None
        or memo.indexed_content_hash is None
        or memo.content_hash != memo.indexed_content_hash
    ]
    return pending[:limit]


def mark_memo_schedule_scanned(memo_id: str, content_hash: str) -> None:
    client = get_supabase()
    client.table("memos").update(
        {
            "content_hash": content_hash,
            "schedule_scanned_hash": content_hash,
            "schedule_scan_status": "scanned",
            "schedule_scanned_at": utc_now(),
        }
    ).eq("id", memo_id).execute()


def mark_memo_schedule_scan_failed(memo_id: str) -> None:
    client = get_supabase()
    client.table("memos").update({"schedule_scan_status": "failed"}).eq(
        "id", memo_id
    ).execute()


def mark_memo_indexed(memo_id: str, content_hash: str) -> None:
    client = get_supabase()
    client.table("memos").update(
        {
            "content_hash": content_hash,
            "indexed_content_hash": content_hash,
            "last_indexed_at": utc_now(),
        }
    ).eq("id", memo_id).execute()


def replace_memo_chunks(
    user_id: str,
    memo_id: str,
    content_hash: str,
    chunks: list[DatabaseRow],
) -> None:
    client = get_supabase()
    client.table("memo_chunks").delete().eq("memo_id", memo_id).execute()

    if chunks:
        rows = [
            {
                "user_id": user_id,
                "memo_id": memo_id,
                "embedding_model": constants.EMBEDDING_MODEL,
                "content_hash": content_hash,
                **chunk,
            }
            for chunk in chunks
        ]
        client.table("memo_chunks").insert(rows).execute()

    mark_memo_indexed(memo_id, content_hash)
