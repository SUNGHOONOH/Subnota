from typing import Any, cast

from app.core import constants
from app.db.client import get_supabase
from app.db.types import DatabaseRow
from app.db.utils import format_vector, parse_vector


def fetch_topic_memo_embeddings(
    user_id: str,
    memo_ids: list[str],
) -> dict[tuple[str, str], list[float]]:
    if not memo_ids:
        return {}
    client = get_supabase()
    response = (
        client.table("topic_memo_embedding_cache")
        .select("memo_id, content_hash, embedding")
        .eq("user_id", user_id)
        .eq("embedding_model", constants.EMBEDDING_MODEL_SIGNATURE)
        .in_("memo_id", memo_ids)
        .execute()
    )
    rows = cast(list[DatabaseRow], response.data or [])
    return {
        (str(row["memo_id"]), str(row["content_hash"])): parse_vector(row["embedding"])
        for row in rows
        if row.get("memo_id") and row.get("content_hash") and row.get("embedding") is not None
    }


def upsert_topic_memo_embeddings(rows: list[DatabaseRow]) -> None:
    if not rows:
        return
    client = get_supabase()
    client.table("topic_memo_embedding_cache").upsert(
        [
            {
                **row,
                "embedding": format_vector(row["embedding"]),
                "embedding_model": constants.EMBEDDING_MODEL_SIGNATURE,
            }
            for row in rows
        ],
        on_conflict="memo_id,embedding_model",
    ).execute()


def search_similar_topic_memos(
    user_id: str,
    query_embedding: Any,
    exclude_memo_id: str | None,
    limit: int,
) -> list[DatabaseRow]:
    client = get_supabase()
    response = client.rpc(
        "match_topic_memo_embeddings",
        {
            "p_embedding_model": constants.EMBEDDING_MODEL_SIGNATURE,
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
            "p_embedding_model": constants.EMBEDDING_MODEL_SIGNATURE,
            "p_user_id": user_id,
            "p_query_embedding": format_vector(query_embedding),
            "p_match_count": limit,
        },
    ).execute()
    return cast(list[DatabaseRow], response.data or [])


def rebuild_user_memo_similarity_edges(
    user_id: str,
    match_count: int,
    min_similarity: float,
) -> int:
    client = get_supabase()
    response = client.rpc(
        "rebuild_user_memo_similarity_edges",
        {
            "p_user_id": user_id,
            "p_embedding_model": constants.EMBEDDING_MODEL_SIGNATURE,
            "p_match_count": match_count,
            "p_min_similarity": min_similarity,
        },
    ).execute()
    return int(response.data or 0)


def fetch_inbox_embeddings_for_user(user_id: str) -> list[DatabaseRow]:
    """Latest summary embedding per saved inbox session, parsed to floats."""
    client = get_supabase()
    response = (
        client.table("inbox_session_embeddings")
        .select("inbox_session_id, embedding, updated_at")
        .eq("user_id", user_id)
        .eq("embedding_model", constants.EMBEDDING_MODEL_SIGNATURE)
        .order("updated_at", desc=True)
        .execute()
    )
    rows = cast(list[DatabaseRow], response.data or [])

    seen: set[str] = set()
    latest: list[DatabaseRow] = []
    for row in rows:
        session_id = str(row.get("inbox_session_id") or "")
        embedding = row.get("embedding")
        if not session_id or session_id in seen or embedding is None:
            continue
        seen.add(session_id)
        latest.append(
            {"inbox_session_id": session_id, "embedding": parse_vector(embedding)}
        )
    return latest
