import sys
from pathlib import Path

import numpy as np

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app.db.types import MemoRecord
from app.features.topics.discovery import (
    build_topic_results,
    build_incremental_topic_groups,
    cluster_embeddings,
    group_memos_by_cluster,
)


def memo(memo_id: str, *, topic_dirty: bool = False) -> MemoRecord:
    return MemoRecord(
        id=memo_id,
        content=f"content {memo_id}",
        content_hash=None,
        indexed_content_hash=None,
        schedule_scanned_hash=None,
        topic_dirty=topic_dirty,
        created_at=None,
        updated_at=None,
        content_updated_at=None,
    )


def test_leiden_communities_are_deterministic() -> None:
    embeddings = np.asarray(
        [
            [1.0, 0.0, 0.0],
            [0.99, 0.01, 0.0],
            [0.98, 0.02, 0.0],
            [0.0, 1.0, 0.0],
            [0.01, 0.99, 0.0],
            [0.02, 0.98, 0.0],
        ],
        dtype=np.float64,
    )

    first_labels, first_method = cluster_embeddings(embeddings)
    second_labels, second_method = cluster_embeddings(embeddings)

    assert first_method == second_method == "leiden"
    assert first_labels == second_labels
    assert len(set(first_labels[:3])) == 1
    assert len(set(first_labels[3:])) == 1
    assert first_labels[0] != first_labels[3]


def test_unconnected_notes_remain_unassigned() -> None:
    embeddings = np.asarray(
        [
            [1.0, 0.0, 0.0],
            [0.0, 1.0, 0.0],
            [0.0, 0.0, 1.0],
        ],
        dtype=np.float64,
    )

    labels, _ = cluster_embeddings(embeddings)

    assert group_memos_by_cluster([memo("a"), memo("b"), memo("c")], labels) == []


def test_incremental_refresh_preserves_existing_topics_and_only_attaches_dirty_notes() -> None:
    memos = [
        memo("memo-a1"),
        memo("memo-a2"),
        memo("memo-b1"),
        memo("memo-b2"),
        memo("memo-new-a", topic_dirty=True),
        memo("memo-noise", topic_dirty=True),
    ]
    embeddings = np.asarray(
        [
            [1.0, 0.0],
            [0.99, 0.01],
            [0.0, 1.0],
            [0.01, 0.99],
            [0.98, 0.02],
            [-1.0, 0.0],
        ],
        dtype=np.float64,
    )
    existing_topics = [
        {
            "id": "topic-a",
            "label": "Stable A",
            "memo_ids": ["memo-a1", "memo-a2"],
        },
        {
            "id": "topic-b",
            "label": "Stable B",
            "memo_ids": ["memo-b1", "memo-b2"],
        },
    ]

    grouped_indices, preserved = build_incremental_topic_groups(
        memos, embeddings, existing_topics
    )

    assert preserved[0]["id"] == "topic-a"
    assert preserved[1]["id"] == "topic-b"
    assert grouped_indices[0] == [0, 1, 4]
    assert grouped_indices[1] == [2, 3]
    assert all(5 not in group for group in grouped_indices)


def test_preserved_identity_keeps_id_and_label_in_storage_result() -> None:
    memos = [memo("memo-1"), memo("memo-2")]
    embeddings = np.asarray([[1.0, 0.0], [0.99, 0.01]], dtype=np.float64)

    results, storage_clusters, memberships, _edges = build_topic_results(
        "user-1",
        [[0, 1]],
        embeddings,
        memos,
        "input-hash",
        "leiden",
        {0: {"id": "topic-stable", "label": "기존 주제"}},
    )

    assert results[0].label == "기존 주제"
    assert storage_clusters[0]["id"] == "topic-stable"
    assert storage_clusters[0]["label"] == "기존 주제"
    assert {row["memo_id"] for row in memberships[0]} == {"memo-1", "memo-2"}
