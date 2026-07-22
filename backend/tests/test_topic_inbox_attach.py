import numpy as np

from app.db.types import MemoRecord
from app.features.topics.discovery import attach_inbox_items_to_clusters


def normalized(rows: list[list[float]]) -> np.ndarray:
    matrix = np.asarray(rows, dtype=np.float64)
    return matrix / np.linalg.norm(matrix, axis=1, keepdims=True)


def memo(memo_id: str) -> MemoRecord:
    return MemoRecord(
        id=memo_id,
        content=memo_id,
        content_hash=None,
        indexed_content_hash=None,
        schedule_scanned_hash=None,
        topic_dirty=True,
        created_at=None,
        updated_at=None,
        content_updated_at=None,
    )


# Two well-separated clusters: axis-x memos and axis-y memos.
EMBEDDINGS = normalized(
    [
        [1.0, 0.0, 0.0],
        [0.9, 0.1, 0.0],
        [0.0, 1.0, 0.0],
        [0.1, 0.9, 0.0],
    ]
)
MEMOS = [memo('m0'), memo('m1'), memo('m2'), memo('m3')]
GROUPED = [[0, 1], [2, 3]]


def test_assigns_each_inbox_item_to_nearest_centroid() -> None:
    inbox = [
        {"inbox_session_id": "x-ish", "embedding": [0.95, 0.05, 0.0]},
        {"inbox_session_id": "y-ish", "embedding": [0.0, 1.0, 0.1]},
    ]

    per_cluster, _ = attach_inbox_items_to_clusters(
        GROUPED, EMBEDDINGS, inbox, 0.45, MEMOS,
    )

    assert [item["inbox_session_id"] for item in per_cluster[0]] == ["x-ish"]
    assert [item["inbox_session_id"] for item in per_cluster[1]] == ["y-ish"]
    assert 0 < per_cluster[0][0]["score"] <= 1


def test_links_each_item_to_its_most_similar_memos() -> None:
    # x-ish sits closest to m0 ([1,0,0]) then m1 ([0.9,0.1,0]).
    inbox = [{"inbox_session_id": "x-ish", "embedding": [0.99, 0.01, 0.0]}]

    _, edges = attach_inbox_items_to_clusters(
        GROUPED, EMBEDDINGS, inbox, 0.45, MEMOS, memo_edge_top_k=2,
    )

    assert [edge["memo_id"] for edge in edges[0]] == ["m0", "m1"]
    assert all(edge["inbox_session_id"] == "x-ish" for edge in edges[0])
    assert edges[0][0]["similarity"] >= edges[0][1]["similarity"]
    assert edges[1] == []


def test_memo_edges_respect_the_similarity_floor() -> None:
    # Attached to cluster 0 but barely — only m0 clears a high floor.
    inbox = [{"inbox_session_id": "x-ish", "embedding": [1.0, 0.0, 0.0]}]

    _, edges = attach_inbox_items_to_clusters(
        GROUPED, EMBEDDINGS, inbox, 0.45, MEMOS, memo_edge_top_k=2,
        memo_edge_min_similarity=0.999,
    )

    assert [edge["memo_id"] for edge in edges[0]] == ["m0"]


def test_drops_items_below_the_similarity_floor() -> None:
    inbox = [{"inbox_session_id": "far", "embedding": [0.0, 0.0, 1.0]}]

    per_cluster, edges = attach_inbox_items_to_clusters(
        GROUPED, EMBEDDINGS, inbox, 0.45, MEMOS,
    )

    assert per_cluster == [[], []]
    assert edges == [[], []]


def test_handles_empty_inputs_and_zero_vectors() -> None:
    empty_items, empty_edges = attach_inbox_items_to_clusters(
        [], EMBEDDINGS, [], 0.45, [],
    )
    assert empty_items == []
    assert empty_edges == []

    zero = [{"inbox_session_id": "zero", "embedding": [0.0, 0.0, 0.0]}]
    items, edges = attach_inbox_items_to_clusters(
        GROUPED, EMBEDDINGS, zero, 0.45, MEMOS,
    )
    assert items == [[], []]
    assert edges == [[], []]
