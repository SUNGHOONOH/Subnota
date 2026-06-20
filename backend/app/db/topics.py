import logging
from typing import cast

from app.db.client import get_supabase
from app.db.types import DatabaseRow

logger = logging.getLogger(__name__)


def replace_topic_clusters(
    user_id: str,
    clusters: list[DatabaseRow],
    memberships_by_cluster_index: list[list[DatabaseRow]],
    edges_by_cluster_index: list[list[DatabaseRow]] | None = None,
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

    can_write_edges = True
    if existing_ids:
        try:
            client.table("topic_memo_edges").delete().in_("topic_id", existing_ids).execute()
        except Exception:
            logger.warning("topic edge delete failed", exc_info=True)
            can_write_edges = False
        client.table("topic_cluster_memos").delete().in_("topic_id", existing_ids).execute()
        client.table("topic_clusters").delete().eq("user_id", user_id).execute()

    if not clusters:
        return

    inserted = client.table("topic_clusters").insert(clusters).execute()
    inserted_rows = cast(list[DatabaseRow], inserted.data or [])

    memberships: list[DatabaseRow] = []
    edges: list[DatabaseRow] = []
    for index, topic in enumerate(inserted_rows):
        topic_id = topic.get("id")
        if not topic_id:
            continue
        for membership in memberships_by_cluster_index[index]:
            memberships.append({"topic_id": topic_id, **membership})
        if edges_by_cluster_index:
            for edge in edges_by_cluster_index[index]:
                edges.append({"topic_id": topic_id, **edge})

    if memberships:
        client.table("topic_cluster_memos").insert(memberships).execute()
    if edges and can_write_edges:
        try:
            client.table("topic_memo_edges").insert(edges).execute()
        except Exception:
            logger.warning("topic edge insert failed", exc_info=True)


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
