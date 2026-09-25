from typing import cast
from uuid import uuid4

from app.db.client import get_supabase
from app.db.types import DatabaseRow, MemoRecord


def fetch_existing_topic_identities(user_id: str) -> list[DatabaseRow]:
    client = get_supabase()
    cluster_response = (
        client.table("topic_clusters")
        .select(
            "id, label, keywords, representative_memo_ids, memo_count, confidence, "
            "model_version, input_hash, source"
        )
        .eq("user_id", user_id)
        .execute()
    )
    cluster_rows = cast(list[DatabaseRow], cluster_response.data or [])
    topic_ids = [str(row.get("id") or "") for row in cluster_rows]
    topic_ids = [topic_id for topic_id in topic_ids if topic_id]
    if not topic_ids:
        return []

    membership_response = (
        client.table("topic_cluster_memos")
        .select("topic_id, memo_id")
        .in_("topic_id", topic_ids)
        .execute()
    )
    membership_rows = cast(list[DatabaseRow], membership_response.data or [])
    memo_ids_by_topic: dict[str, list[str]] = {topic_id: [] for topic_id in topic_ids}
    for row in membership_rows:
        topic_id = str(row.get("topic_id") or "")
        memo_id = str(row.get("memo_id") or "")
        if topic_id in memo_ids_by_topic and memo_id:
            memo_ids_by_topic[topic_id].append(memo_id)

    return [
        {
            "id": topic_id,
            "label": str(row.get("label") or ""),
            "keywords": list(row.get("keywords") or []),
            "representative_memo_ids": list(
                row.get("representative_memo_ids") or []
            ),
            "memo_count": int(row.get("memo_count") or 0),
            "confidence": row.get("confidence"),
            "model_version": row.get("model_version"),
            "input_hash": row.get("input_hash"),
            "source": str(row.get("source") or "server"),
            "memo_ids": sorted(memo_ids_by_topic[topic_id]),
        }
        for row in cluster_rows
        if (topic_id := str(row.get("id") or "")) in memo_ids_by_topic
    ]


def replace_topic_clusters(
    user_id: str,
    clusters: list[DatabaseRow],
    memberships_by_cluster_index: list[list[DatabaseRow]],
    edges_by_cluster_index: list[list[DatabaseRow]] | None = None,
    inbox_items_by_cluster_index: list[list[DatabaseRow]] | None = None,
    inbox_edges_by_cluster_index: list[list[DatabaseRow]] | None = None,
) -> None:
    client = get_supabase()

    cluster_rows: list[DatabaseRow] = []
    memberships: list[DatabaseRow] = []
    edges: list[DatabaseRow] = []
    inbox_items: list[DatabaseRow] = []
    inbox_edges: list[DatabaseRow] = []
    for index, cluster in enumerate(clusters):
        topic_id = str(cluster.get("id") or uuid4())
        cluster_rows.append({**cluster, "id": topic_id})
        for membership in memberships_by_cluster_index[index]:
            memberships.append({"topic_id": topic_id, **membership})
        if edges_by_cluster_index:
            for edge in edges_by_cluster_index[index]:
                edges.append({"topic_id": topic_id, **edge})
        if inbox_items_by_cluster_index:
            for item in inbox_items_by_cluster_index[index]:
                inbox_items.append({"topic_id": topic_id, **item})
        if inbox_edges_by_cluster_index:
            for edge in inbox_edges_by_cluster_index[index]:
                inbox_edges.append({"topic_id": topic_id, **edge})
    client.rpc(
        "replace_topic_map",
        {
            "p_user_id": user_id,
            "p_clusters": cluster_rows,
            "p_memberships": memberships,
            "p_edges": edges,
            "p_inbox_items": inbox_items,
            "p_inbox_edges": inbox_edges,
        },
    ).execute()


def apply_incremental_topic_clusters(
    user_id: str,
    clusters: list[DatabaseRow],
    memberships_by_cluster_index: list[list[DatabaseRow]],
    edges_by_cluster_index: list[list[DatabaseRow]] | None = None,
    inbox_items_by_cluster_index: list[list[DatabaseRow]] | None = None,
    inbox_edges_by_cluster_index: list[list[DatabaseRow]] | None = None,
) -> None:
    """Refresh memberships without deleting existing topic identities.

    Automatic discovery must not replace topic rows: those ids are referenced by
    the knowledge map and by folder provenance.  We only replace the dependent
    rows for the supplied topics, then upsert their current metadata.
    """
    client = get_supabase()
    cluster_rows: list[DatabaseRow] = []
    memberships: list[DatabaseRow] = []
    edges: list[DatabaseRow] = []
    inbox_items: list[DatabaseRow] = []
    inbox_edges: list[DatabaseRow] = []

    for index, cluster in enumerate(clusters):
        topic_id = str(cluster.get("id") or uuid4())
        cluster_rows.append({**cluster, "id": topic_id, "user_id": user_id})
        for membership in memberships_by_cluster_index[index]:
            memberships.append({"topic_id": topic_id, **membership})
        if edges_by_cluster_index:
            edges.extend({"topic_id": topic_id, **edge} for edge in edges_by_cluster_index[index])
        if inbox_items_by_cluster_index:
            inbox_items.extend(
                {"topic_id": topic_id, **item}
                for item in inbox_items_by_cluster_index[index]
            )
        if inbox_edges_by_cluster_index:
            inbox_edges.extend(
                {"topic_id": topic_id, **edge}
                for edge in inbox_edges_by_cluster_index[index]
            )

    if not cluster_rows:
        return

    topic_ids = [str(cluster["id"]) for cluster in cluster_rows]
    client.table("topic_clusters").upsert(cluster_rows, on_conflict="id").execute()
    # Every affected topic is present above, including an existing topic that
    # became temporarily empty. Its row stays; only its derived relationships
    # are rebuilt from the current memo set.
    for table_name in (
        "topic_memo_inbox_edges",
        "topic_cluster_inbox_items",
        "topic_memo_edges",
        "topic_cluster_memos",
    ):
        client.table(table_name).delete().in_("topic_id", topic_ids).execute()

    if memberships:
        client.table("topic_cluster_memos").insert(memberships).execute()
    if edges:
        client.table("topic_memo_edges").insert(edges).execute()
    if inbox_items:
        client.table("topic_cluster_inbox_items").insert(inbox_items).execute()
    if inbox_edges:
        client.table("topic_memo_inbox_edges").insert(inbox_edges).execute()


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


def mark_user_topics_dirty(user_id: str) -> None:
    get_supabase().table("memos").update({"topic_dirty": True}).eq(
        "user_id", user_id
    ).eq("is_archived", False).neq("content", "").execute()


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
