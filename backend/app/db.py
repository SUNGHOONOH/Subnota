from dataclasses import dataclass
from datetime import datetime, timezone
from functools import lru_cache
from typing import Any, cast

from supabase import Client, create_client

from app import constants
from app.config import settings
from app.hashing import hash_text


@dataclass(frozen=True)
class MemoRecord:
    id: str
    content: str
    content_hash: str | None
    indexed_content_hash: str | None
    schedule_scanned_hash: str | None
    topic_dirty: bool
    created_at: str | None
    updated_at: str | None


DatabaseRow = dict[str, Any]


@lru_cache
def get_supabase() -> Client:
    if not settings.supabase_url or not settings.supabase_service_role_key:
        raise RuntimeError("SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required")

    return create_client(settings.supabase_url, settings.supabase_service_role_key)


def fetch_profile_ids() -> list[str]:
    client = get_supabase()
    response = client.table("profiles").select("id").execute()
    rows = cast(list[DatabaseRow], response.data or [])
    return [str(row["id"]) for row in rows if row.get("id")]


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


def replace_topic_clusters(
    user_id: str,
    clusters: list[DatabaseRow],
    memberships_by_cluster_index: list[list[DatabaseRow]],
) -> None:
    client = get_supabase()

    existing = (
        client.table("topic_clusters")
        .select("id")
        .eq("user_id", user_id)
        .execute()
    )
    existing_rows = cast(list[DatabaseRow], existing.data or [])
    existing_ids = [row["id"] for row in existing_rows if row.get("id")]

    if existing_ids:
        client.table("topic_cluster_memos").delete().in_("topic_id", existing_ids).execute()
        client.table("topic_clusters").delete().eq("user_id", user_id).execute()

    if not clusters:
        return

    inserted = client.table("topic_clusters").insert(clusters).execute()
    inserted_rows = cast(list[DatabaseRow], inserted.data or [])

    memberships: list[DatabaseRow] = []
    for index, topic in enumerate(inserted_rows):
        topic_id = topic.get("id")
        if not topic_id:
            continue
        for membership in memberships_by_cluster_index[index]:
            memberships.append({"topic_id": topic_id, **membership})

    if memberships:
        client.table("topic_cluster_memos").insert(memberships).execute()


def has_topic_dirty_memos(user_id: str) -> bool:
    client = get_supabase()
    response = (
        client.table("memos")
        .select("id")
        .eq("user_id", user_id)
        .eq("is_archived", False)
        .eq("topic_dirty", True)
        .limit(1)
        .execute()
    )
    rows = cast(list[DatabaseRow], response.data or [])
    return bool(rows)


def mark_topic_memos_clean(user_id: str) -> None:
    client = get_supabase()
    client.table("memos").update({"topic_dirty": False}).eq("user_id", user_id).execute()


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


def fetch_cached_embedding(user_id: str, chunk_hash: str) -> Any | None:
    client = get_supabase()
    response = (
        client.table("chunk_embedding_cache")
        .select("embedding")
        .eq("user_id", user_id)
        .eq("chunk_hash", chunk_hash)
        .limit(1)
        .execute()
    )
    rows = cast(list[DatabaseRow], response.data or [])
    if not rows:
        return None
    return rows[0].get("embedding")


def upsert_cached_embedding(
    user_id: str,
    chunk_hash: str,
    chunk_text: str,
    embedding: Any,
) -> None:
    client = get_supabase()
    client.table("chunk_embedding_cache").upsert(
        {
            "user_id": user_id,
            "chunk_hash": chunk_hash,
            "chunk_text": chunk_text,
            "embedding": format_vector(embedding),
            "embedding_model": constants.EMBEDDING_MODEL,
        },
        on_conflict="user_id,chunk_hash",
    ).execute()


def search_similar_chunks(
    user_id: str,
    query_embedding: Any,
    exclude_memo_id: str | None,
    limit: int,
) -> list[DatabaseRow]:
    client = get_supabase()
    response = client.rpc(
        "match_memo_chunks",
        {
            "p_user_id": user_id,
            "p_query_embedding": format_vector(query_embedding),
            "p_match_count": limit,
            "p_exclude_memo_id": exclude_memo_id,
        },
    ).execute()
    return cast(list[DatabaseRow], response.data or [])


def content_hash_for_memo(memo: MemoRecord) -> str:
    return memo.content_hash or hash_text(memo.content)


def format_vector(vector: Any) -> str:
    if isinstance(vector, str):
        return vector

    try:
        values = vector.tolist()
    except AttributeError:
        values = vector

    if values and isinstance(values[0], list):
        values = values[0]

    return "[" + ",".join(str(float(value)) for value in values) + "]"


def optional_str(value: Any) -> str | None:
    if value is None:
        return None
    return str(value)


def utc_now() -> str:
    return datetime.now(timezone.utc).isoformat()
