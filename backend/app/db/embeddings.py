from typing import Any, cast

from app.core import constants
from app.db.client import get_supabase
from app.db.types import DatabaseRow
from app.db.utils import format_vector


def fetch_cached_embedding(user_id: str, chunk_hash: str) -> Any | None:
    client = get_supabase()
    response = (
        client.table("chunk_embedding_cache")
        .select("embedding")
        .eq("user_id", user_id)
        .eq("chunk_hash", chunk_hash)
        .eq("embedding_model", constants.EMBEDDING_MODEL)
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


def search_similar_inbox_embeddings(
    user_id: str,
    query_embedding: Any,
    limit: int,
) -> list[DatabaseRow]:
    client = get_supabase()
    response = client.rpc(
        "match_inbox_session_embeddings",
        {
            "p_user_id": user_id,
            "p_query_embedding": format_vector(query_embedding),
            "p_match_count": limit,
        },
    ).execute()
    return cast(list[DatabaseRow], response.data or [])
