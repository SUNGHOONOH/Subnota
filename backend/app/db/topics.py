from uuid import uuid4
from typing import cast

from app.db.client import get_supabase
from app.db.types import DatabaseRow, MemoRecord

def replace_topic_clusters(
    user_id: str,
    clusters: list[DatabaseRow],
    memberships_by_cluster_index: list[list[DatabaseRow]],
    edges_by_cluster_index: list[list[DatabaseRow]] | None = None,
) -> None:
    client = get_supabase()

    cluster_rows: list[DatabaseRow] = []
    memberships: list[DatabaseRow] = []
    edges: list[DatabaseRow] = []
    for index, cluster in enumerate(clusters):
        topic_id = str(uuid4())
        cluster_rows.append({**cluster, "id": topic_id})
        for membership in memberships_by_cluster_index[index]:
            memberships.append({"topic_id": topic_id, **membership})
        if edges_by_cluster_index:
            for edge in edges_by_cluster_index[index]:
                edges.append({"topic_id": topic_id, **edge})
    client.rpc(
        "replace_topic_map",
        {
            "p_user_id": user_id,
            "p_clusters": cluster_rows,
            "p_memberships": memberships,
            "p_edges": edges,
        },
    ).execute()


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


def mark_topic_memos_clean(user_id: str, memos: list[MemoRecord]) -> None:
    client = get_supabase()
    for memo in memos:
        query = (
            client.table("memos")
            .update({"topic_dirty": False})
            .eq("user_id", user_id)
            .eq("id", memo.id)
            .eq("topic_dirty", True)
        )
        if memo.content_hash is None:
            query = query.is_("content_hash", "null").eq("content", memo.content)
        else:
            query = query.eq("content_hash", memo.content_hash)
        query.execute()
