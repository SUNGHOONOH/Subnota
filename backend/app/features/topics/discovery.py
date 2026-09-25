import hashlib
import json
import logging
import re
from collections import defaultdict
from typing import Any, cast

try:
    from google import genai
    from google.genai import types as genai_types
except Exception:  # pragma: no cover - optional runtime dependency
    genai = None
    genai_types = None

from huggingface_hub import InferenceClient
import igraph as ig
import leidenalg
import numpy as np
from pydantic import BaseModel, Field
from sklearn.feature_extraction.text import CountVectorizer
from sklearn.metrics.pairwise import cosine_similarity

from app.core import constants
from app.core.config import settings
from app.db.embeddings import (
    fetch_inbox_embeddings_for_user,
    fetch_topic_memo_embeddings,
    rebuild_user_memo_similarity_edges,
    upsert_topic_memo_embeddings,
)
from app.db.memos import fetch_user_memos
from app.db.topics import (
    apply_incremental_topic_clusters,
    fetch_existing_topic_identities,
    has_topic_dirty_memos,
    mark_topic_memos_clean,
    replace_topic_clusters,
)
from app.db.types import DatabaseRow, MemoRecord
from app.db.utils import content_hash_for_memo
from app.features.language import ContentLanguage, detect_content_language

logger = logging.getLogger(__name__)

DATE_TOKEN_RE = re.compile(
    r"(오늘|내일|모레|글피|\d{1,2}월\s*\d{1,2}일|\d{2,4}[./-]\d{1,2}[./-]\d{1,2})"
)
TOKEN_RE = re.compile(r"[가-힣A-Za-z0-9]{2,}")
TOPIC_LABEL_BLOCKLIST = {
    "기타",
    "내용",
    "메모",
    "생각",
    "일반",
    "정보",
    "주제",
    "토픽",
}
TOPIC_LABEL_BLOCKLIST_EN = {
    "content",
    "general",
    "information",
    "misc",
    "miscellaneous",
    "miscellaneous notes",
    "notes",
    "thoughts",
    "topic",
}
TOPIC_LABEL_RESPONSE_SCHEMA = {
    "type": "object",
    "properties": {
        "label": {
            "type": "string",
            "description": (
                "One short noun-phrase category name in the dominant language of "
                "the memo group. Do not list keywords or write a sentence."
            ),
        },
    },
    "required": ["label"],
    "additionalProperties": False,
}


class TopicDiscoveryRequest(BaseModel):
    user_id: str = Field(..., description="Supabase auth user id")
    force: bool = Field(False, description="Run even if memo count is low")
    persist: bool = Field(True, description="Save clusters into Supabase topic tables")
    preserve_existing_identity: bool = Field(
        True,
        description="Reuse matching topic ids and labels during automatic refreshes",
    )


class TopicClusterResult(BaseModel):
    label: str
    keywords: list[str]
    memo_count: int
    representative_memo_ids: list[str]
    confidence: float | None = None


class TopicDiscoveryResponse(BaseModel):
    status: str
    user_id: str
    memo_count: int
    cluster_count: int
    model: str
    clustering_method: str | None = None
    clusters: list[TopicClusterResult]
    message: str | None = None


def run_topic_discovery(request: TopicDiscoveryRequest) -> TopicDiscoveryResponse:
    if not request.force and not has_topic_dirty_memos(request.user_id):
        return TopicDiscoveryResponse(
            status="skipped",
            user_id=request.user_id,
            memo_count=0,
            cluster_count=0,
            model=constants.EMBEDDING_MODEL_SIGNATURE,
            clustering_method=None,
            clusters=[],
            message="No topic_dirty memos. State A topic discovery skipped.",
        )

    memos = sorted(fetch_user_memos(request.user_id), key=lambda memo: memo.id)

    is_full_regeneration = not request.preserve_existing_identity
    existing_topics = (
        fetch_existing_topic_identities(request.user_id)
        if request.persist and request.preserve_existing_identity
        else []
    )

    if (
        len(memos) < constants.TOPIC_MIN_MEMOS
        and not request.force
        and not existing_topics
    ):
        if request.persist:
            # Automatic maintenance never clears a user's existing knowledge
            # map just because notes were removed below the discovery threshold.
            if is_full_regeneration:
                replace_topic_clusters(request.user_id, [], [], [])
            mark_topic_memos_clean(request.user_id, memos)
        return TopicDiscoveryResponse(
            status="skipped",
            user_id=request.user_id,
            memo_count=len(memos),
            cluster_count=0,
            model=constants.EMBEDDING_MODEL_SIGNATURE,
            clustering_method=None,
            clusters=[],
            message=f"Need at least {constants.TOPIC_MIN_MEMOS} memos. Use force=true for testing.",
        )

    if not memos:
        if request.persist:
            if is_full_regeneration:
                replace_topic_clusters(request.user_id, [], [], [])
            elif existing_topics:
                storage_clusters: list[DatabaseRow] = []
                memberships: list[list[DatabaseRow]] = []
                edges: list[list[DatabaseRow]] = []
                append_empty_existing_topics(
                    existing_topics,
                    {},
                    request.user_id,
                    storage_clusters,
                    memberships,
                    edges,
                )
                apply_incremental_topic_clusters(
                    request.user_id, storage_clusters, memberships, edges
                )
            mark_topic_memos_clean(request.user_id, memos)
        return TopicDiscoveryResponse(
            status="skipped",
            user_id=request.user_id,
            memo_count=0,
            cluster_count=0,
            model=constants.EMBEDDING_MODEL_SIGNATURE,
            clustering_method=None,
            clusters=[],
            message="No memos found.",
        )

    normalized_texts = [normalize_for_embedding(memo.content) for memo in memos]
    embeddings = load_or_create_topic_embeddings(request.user_id, memos, normalized_texts)
    if existing_topics:
        grouped, preserved_identities = build_incremental_topic_groups(
            memos,
            embeddings,
            existing_topics,
        )
        clustering_method = "incremental_neighbor_vote"
    else:
        labels, clustering_method = cluster_embeddings(embeddings)
        grouped = group_memos_by_cluster(memos, labels)
        preserved_identities = {}
    results, storage_clusters, memberships, edges = build_topic_results(
        request.user_id,
        grouped,
        embeddings,
        memos,
        build_input_hash(memos),
        clustering_method,
        preserved_identities,
    )
    if existing_topics:
        append_empty_existing_topics(
            existing_topics,
            preserved_identities,
            request.user_id,
            storage_clusters,
            memberships,
            edges,
        )

    # Saved links decorate the map; a fetch failure must not break discovery.
    try:
        inbox_rows = fetch_inbox_embeddings_for_user(request.user_id)
    except Exception:
        logger.warning("inbox embeddings fetch failed", exc_info=True)
        inbox_rows = []
    inbox_items, inbox_edges = attach_inbox_items_to_clusters(
        grouped,
        embeddings,
        inbox_rows,
        constants.TOPIC_INBOX_ATTACH_MIN_SIMILARITY,
        memos,
        memo_edge_top_k=constants.TOPIC_MEMO_INBOX_EDGE_TOP_K,
        memo_edge_min_similarity=constants.TOPIC_MEMO_INBOX_EDGE_MIN_SIMILARITY,
    )
    inbox_items.extend([[] for _ in range(len(storage_clusters) - len(inbox_items))])
    inbox_edges.extend([[] for _ in range(len(storage_clusters) - len(inbox_edges))])

    if request.persist:
        if existing_topics:
            apply_incremental_topic_clusters(
                request.user_id,
                storage_clusters,
                memberships,
                edges,
                inbox_items_by_cluster_index=inbox_items,
                inbox_edges_by_cluster_index=inbox_edges,
            )
        else:
            replace_topic_clusters(
                request.user_id,
                storage_clusters,
                memberships,
                edges,
                inbox_items_by_cluster_index=inbox_items,
                inbox_edges_by_cluster_index=inbox_edges,
            )
        rebuild_user_memo_similarity_edges(
            request.user_id,
            constants.MEMO_SIMILARITY_EDGE_TOP_K,
            constants.MEMO_SIMILARITY_EDGE_MIN_SIMILARITY,
        )
        mark_topic_memos_clean(request.user_id, memos)

    return TopicDiscoveryResponse(
        status="ok",
        user_id=request.user_id,
        memo_count=len(memos),
        cluster_count=len(results),
        model=constants.EMBEDDING_MODEL_SIGNATURE,
        clustering_method=clustering_method,
        clusters=results,
        message=(
            "State A topic discovery fully regenerated."
            if is_full_regeneration
            else "State A topic discovery completed."
        ),
    )


FloatArray = Any


def load_or_create_topic_embeddings(
    user_id: str,
    memos: list[MemoRecord],
    normalized_texts: list[str],
) -> FloatArray:
    cached = fetch_topic_memo_embeddings(user_id, [memo.id for memo in memos])
    content_hashes = [content_hash_for_memo(memo) for memo in memos]
    missing_indices = [
        index
        for index, memo in enumerate(memos)
        if (memo.id, content_hashes[index]) not in cached
    ]

    if missing_indices:
        generated = encode_texts([normalized_texts[index] for index in missing_indices])
        rows: list[DatabaseRow] = []
        for generated_index, memo_index in enumerate(missing_indices):
            memo = memos[memo_index]
            vector = generated[generated_index]
            cached[(memo.id, content_hashes[memo_index])] = vector
            rows.append(
                {
                    "user_id": user_id,
                    "memo_id": memo.id,
                    "content_hash": content_hashes[memo_index],
                    "embedding": vector,
                }
            )
        upsert_topic_memo_embeddings(rows)

    ordered = [cached[(memo.id, content_hashes[index])] for index, memo in enumerate(memos)]
    return normalize_rows(np.asarray(ordered, dtype=np.float64))


def encode_texts(texts: list[str]) -> FloatArray:
    if not settings.hf_token:
        raise RuntimeError("HF_TOKEN is required for Hugging Face Inference API embeddings")

    client = InferenceClient(
        token=settings.hf_token,
        provider="hf-inference",
        timeout=settings.hf_timeout_seconds,
    )
    batches: list[Any] = []

    for start in range(0, len(texts), constants.EMBEDDING_BATCH_SIZE):
        batch = texts[start : start + constants.EMBEDDING_BATCH_SIZE]
        embeddings = client.feature_extraction(
            batch,
            model=constants.EMBEDDING_MODEL,
            normalize=True,
            truncate=True,
        )
        batches.append(to_2d_embedding_array(embeddings))

    return normalize_rows(np.vstack(batches))


def to_2d_embedding_array(value: Any) -> FloatArray:
    embeddings = np.asarray(value, dtype=np.float64)
    if embeddings.ndim == 1:
        embeddings = embeddings.reshape(1, -1)
    if embeddings.ndim == 3:
        embeddings = embeddings.mean(axis=1)
    if embeddings.ndim != 2:
        raise RuntimeError(f"Unexpected embedding shape from Hugging Face API: {embeddings.shape}")
    return embeddings


def normalize_rows(embeddings: FloatArray) -> FloatArray:
    norms = np.linalg.norm(embeddings, axis=1, keepdims=True)
    return np.divide(embeddings, norms, out=np.zeros_like(embeddings), where=norms != 0)


def cluster_embeddings(embeddings: FloatArray) -> tuple[list[int], str]:
    if len(embeddings) == 0:
        return [], "leiden"

    weighted_edges = build_weighted_memo_edges(embeddings)
    if not weighted_edges:
        # Isolated notes stay as singleton communities. `group_memos_by_cluster`
        # intentionally leaves them unassigned instead of inventing a topic.
        return list(range(len(embeddings))), "leiden"

    graph = ig.Graph(
        n=len(embeddings),
        edges=[(source, target) for source, target, _weight in weighted_edges],
        directed=False,
    )
    graph.es["weight"] = [weight for _source, _target, weight in weighted_edges]
    partition = leidenalg.find_partition(
        graph,
        leidenalg.RBConfigurationVertexPartition,
        weights="weight",
        resolution_parameter=constants.TOPIC_LEIDEN_RESOLUTION,
        n_iterations=constants.TOPIC_LEIDEN_ITERATIONS,
        seed=constants.TOPIC_LEIDEN_SEED,
    )
    communities = [sorted(int(node) for node in community) for community in partition]
    ordered_communities = sorted(
        communities,
        key=lambda community: (-len(community), community[0]),
    )
    labels = [-1 for _ in range(len(embeddings))]
    for label, community in enumerate(ordered_communities):
        for memo_index in community:
            labels[memo_index] = label
    return labels, "leiden"


def build_weighted_memo_edges(
    embeddings: FloatArray,
) -> list[tuple[int, int, float]]:
    if len(embeddings) <= 1:
        return []

    similarities: Any = cosine_similarity(cast(Any, embeddings))
    edge_weights: dict[tuple[int, int], float] = {}
    for source_index in range(len(embeddings)):
        ranked_targets = sorted(
            (
                (target_index, float(similarities[source_index][target_index]))
                for target_index in range(len(embeddings))
                if target_index != source_index
            ),
            key=lambda item: (-item[1], item[0]),
        )[: constants.MEMO_SIMILARITY_EDGE_TOP_K]
        for target_index, similarity in ranked_targets:
            if similarity < constants.MEMO_SIMILARITY_EDGE_MIN_SIMILARITY:
                continue
            edge = (min(source_index, target_index), max(source_index, target_index))
            edge_weights[edge] = max(edge_weights.get(edge, 0.0), similarity)

    return [
        (source_index, target_index, similarity)
        for (source_index, target_index), similarity in sorted(edge_weights.items())
    ]


def build_incremental_topic_groups(
    memos: list[MemoRecord],
    embeddings: FloatArray,
    existing_topics: list[DatabaseRow],
) -> tuple[list[list[int]], dict[int, DatabaseRow]]:
    """Keep old communities intact and attach only dirty notes by neighbour vote.

    An automatic refresh deliberately does not run a new global partition over
    existing topics: that would silently merge, split, or rename a user's map.
    Changed notes first vote among their current non-dirty memo neighbours.  The
    remaining notes may form *new* communities, but only at the minimum size.
    """
    memo_index_by_id = {memo.id: index for index, memo in enumerate(memos)}
    dirty_indices = {
        index for index, memo in enumerate(memos) if memo.topic_dirty
    }
    normalized_topics = sorted(
        (
            topic
            for topic in existing_topics
            if str(topic.get("id") or "")
        ),
        key=lambda topic: str(topic["id"]),
    )
    indices_by_topic_id: dict[str, list[int]] = {
        str(topic["id"]): [] for topic in normalized_topics
    }
    assigned_indices: set[int] = set()

    for topic in normalized_topics:
        topic_id = str(topic["id"])
        for memo_id in topic.get("memo_ids", []):
            memo_index = memo_index_by_id.get(str(memo_id))
            if memo_index is None or memo_index in dirty_indices:
                continue
            # Historical data should be exclusive; choose the stable first id
            # if an older map contains an accidental duplicate membership.
            if memo_index in assigned_indices:
                continue
            indices_by_topic_id[topic_id].append(memo_index)
            assigned_indices.add(memo_index)

    anchor_topic_by_index = {
        memo_index: topic_id
        for topic_id, indices in indices_by_topic_id.items()
        for memo_index in indices
    }
    unmatched_indices: list[int] = []
    for memo_index in sorted(dirty_indices, key=lambda index: memos[index].id):
        vote_by_topic: dict[str, float] = defaultdict(float)
        candidates = sorted(
            (
                (other_index, float(embeddings[memo_index] @ embeddings[other_index]))
                for other_index in anchor_topic_by_index
            ),
            key=lambda item: (-item[1], memos[item[0]].id),
        )[: constants.MEMO_SIMILARITY_EDGE_TOP_K]
        for other_index, similarity in candidates:
            if similarity < constants.MEMO_SIMILARITY_EDGE_MIN_SIMILARITY:
                continue
            vote_by_topic[anchor_topic_by_index[other_index]] += similarity

        if not vote_by_topic:
            unmatched_indices.append(memo_index)
            continue
        topic_id, score = min(
            vote_by_topic.items(), key=lambda item: (-item[1], item[0])
        )
        if score < constants.TOPIC_INCREMENTAL_ATTACH_MIN_SCORE:
            unmatched_indices.append(memo_index)
            continue
        indices_by_topic_id[topic_id].append(memo_index)

    grouped: list[list[int]] = []
    preserved_identities: dict[int, DatabaseRow] = {}
    for topic in normalized_topics:
        topic_id = str(topic["id"])
        indices = sorted(indices_by_topic_id[topic_id])
        if not indices:
            continue
        preserved_identities[len(grouped)] = topic
        grouped.append(indices)

    if unmatched_indices:
        unmatched_vectors = np.asarray(embeddings[unmatched_indices], dtype=np.float64)
        labels, _ = cluster_embeddings(unmatched_vectors)
        candidate_groups = group_memos_by_cluster(
            [memos[index] for index in unmatched_indices], labels
        )
        remaining_capacity = max(0, constants.TOPIC_MAX_CLUSTERS - len(grouped))
        for local_indices in candidate_groups[:remaining_capacity]:
            if len(local_indices) < constants.TOPIC_NEW_COMMUNITY_MIN_MEMOS:
                continue
            grouped.append([unmatched_indices[index] for index in local_indices])

    return grouped, preserved_identities


def attach_inbox_items_to_clusters(
    grouped_indices: list[list[int]],
    embeddings: FloatArray,
    inbox_rows: list[DatabaseRow],
    min_similarity: float,
    memos: list[MemoRecord] | None = None,
    memo_edge_top_k: int = constants.TOPIC_MEMO_INBOX_EDGE_TOP_K,
    memo_edge_min_similarity: float = constants.TOPIC_MEMO_INBOX_EDGE_MIN_SIMILARITY,
) -> tuple[list[list[DatabaseRow]], list[list[DatabaseRow]]]:
    """Assign each saved inbox summary to its closest topic centroid.

    Inbox items never influence the clustering itself — they only decorate the
    resulting map, so a burst of saved links cannot reshape the memo topics."""
    per_cluster: list[list[DatabaseRow]] = [[] for _ in grouped_indices]
    per_cluster_edges: list[list[DatabaseRow]] = [[] for _ in grouped_indices]
    if not inbox_rows or not grouped_indices:
        return per_cluster, per_cluster_edges

    centroids = normalize_rows(
        np.asarray(
            [embeddings[indices].mean(axis=0) for indices in grouped_indices],
            dtype=np.float64,
        )
    )

    for row in inbox_rows:
        vector = np.asarray(row["embedding"], dtype=np.float64)
        if embeddings.shape[1] != vector.shape[0]:
            continue
        norm = float(np.linalg.norm(vector))
        if norm == 0:
            continue
        normalized_vector = vector / norm
        similarities = centroids @ normalized_vector
        best = int(np.argmax(similarities))
        score = float(similarities[best])
        if score < min_similarity:
            continue
        inbox_session_id = row["inbox_session_id"]
        per_cluster[best].append(
            {
                "inbox_session_id": inbox_session_id,
                "score": round(score, 4),
            }
        )

        if memos is None or memo_edge_top_k <= 0:
            continue
        ranked_memos = sorted(
            (
                (memo_index, float(embeddings[memo_index] @ normalized_vector))
                for memo_index in grouped_indices[best]
            ),
            key=lambda item: item[1],
            reverse=True,
        )[:memo_edge_top_k]
        for memo_index, similarity in ranked_memos:
            if similarity < memo_edge_min_similarity:
                continue
            per_cluster_edges[best].append(
                {
                    "memo_id": memos[memo_index].id,
                    "inbox_session_id": inbox_session_id,
                    "similarity": round(similarity, 4),
                }
            )

    return per_cluster, per_cluster_edges


def group_memos_by_cluster(
    memos: list[MemoRecord],
    labels: list[int],
) -> list[list[int]]:
    groups: dict[int, list[int]] = defaultdict(list)
    for index, label in enumerate(labels):
        groups[label].append(index)

    communities = [
        sorted(indices)
        for label, indices in groups.items()
        if label != -1 and len(indices) >= constants.TOPIC_NEW_COMMUNITY_MIN_MEMOS
    ]
    return sorted(communities, key=lambda indices: (-len(indices), indices[0]))[
        : constants.TOPIC_MAX_CLUSTERS
    ]


def build_topic_results(
    user_id: str,
    grouped_indices: list[list[int]],
    embeddings: FloatArray,
    memos: list[MemoRecord],
    input_hash: str,
    clustering_method: str,
    preserved_identities: dict[int, DatabaseRow] | None = None,
) -> tuple[
    list[TopicClusterResult],
    list[DatabaseRow],
    list[list[DatabaseRow]],
    list[list[DatabaseRow]],
]:
    results: list[TopicClusterResult] = []
    storage_clusters: list[DatabaseRow] = []
    memberships: list[list[DatabaseRow]] = []
    edges: list[list[DatabaseRow]] = []
    keywords_by_group = extract_keywords_by_group(grouped_indices, memos)
    stable_identities = preserved_identities or {}

    for group_index, indices in enumerate(grouped_indices):
        cluster_memos = [memos[index] for index in indices]
        keywords = keywords_by_group[group_index]
        preserved_identity = stable_identities.get(group_index)
        preserved_label = str((preserved_identity or {}).get("label") or "").strip()
        label = preserved_label or build_label(keywords, cluster_memos)
        representative_ids = select_representative_memos(indices, embeddings, memos)
        confidence = cluster_confidence(indices, embeddings)

        results.append(
            TopicClusterResult(
                label=label,
                keywords=keywords,
                memo_count=len(cluster_memos),
                representative_memo_ids=representative_ids,
                confidence=confidence,
            )
        )
        storage_cluster: DatabaseRow = {
                "user_id": user_id,
                "label": label,
                "keywords": keywords,
                "representative_memo_ids": representative_ids,
                "memo_count": len(cluster_memos),
                "confidence": confidence,
                "model_version": f"{constants.EMBEDDING_MODEL_SIGNATURE}:{clustering_method}",
                "input_hash": input_hash,
                "source": "server",
        }
        if preserved_identity and preserved_identity.get("id"):
            storage_cluster["id"] = str(preserved_identity["id"])
        storage_clusters.append(storage_cluster)
        memberships.append(
            [
                {
                    "memo_id": memo.id,
                    "score": confidence,
                }
                for memo in cluster_memos
            ]
        )
        edges.append(build_topic_memo_edges(indices, embeddings, memos))

    return results, storage_clusters, memberships, edges


def append_empty_existing_topics(
    existing_topics: list[DatabaseRow],
    preserved_identities: dict[int, DatabaseRow],
    user_id: str,
    storage_clusters: list[DatabaseRow],
    memberships: list[list[DatabaseRow]],
    edges: list[list[DatabaseRow]],
) -> None:
    """Retain an emptied topic row until the user explicitly regenerates."""
    active_ids = {
        str(topic.get("id") or "") for topic in preserved_identities.values()
    }
    for topic in sorted(existing_topics, key=lambda item: str(item.get("id") or "")):
        topic_id = str(topic.get("id") or "")
        if not topic_id or topic_id in active_ids:
            continue
        storage_clusters.append(
            {
                "id": topic_id,
                "user_id": user_id,
                "label": str(topic.get("label") or ""),
                "keywords": list(topic.get("keywords") or []),
                "representative_memo_ids": [],
                "memo_count": 0,
                "confidence": None,
                "model_version": str(
                    topic.get("model_version")
                    or f"{constants.EMBEDDING_MODEL_SIGNATURE}:incremental_neighbor_vote"
                ),
                "input_hash": str(topic.get("input_hash") or ""),
                "source": str(topic.get("source") or "server"),
            }
        )
        memberships.append([])
        edges.append([])


def build_topic_memo_edges(
    indices: list[int],
    embeddings: FloatArray,
    memos: list[MemoRecord],
) -> list[DatabaseRow]:
    if len(indices) <= 1:
        return []

    vectors = embeddings[indices]
    similarities: Any = cosine_similarity(cast(Any, vectors))
    candidates: list[tuple[int, int, float]] = []

    for source_local_index in range(len(indices)):
        ranked_targets = sorted(
            (
                (
                    target_local_index,
                    float(similarities[source_local_index][target_local_index]),
                )
                for target_local_index in range(len(indices))
                if target_local_index != source_local_index
            ),
            key=lambda item: item[1],
            reverse=True,
        )[: constants.TOPIC_MEMO_EDGE_TOP_K]

        for target_local_index, similarity in ranked_targets:
            if similarity < constants.TOPIC_MEMO_EDGE_MIN_SIMILARITY:
                continue
            left = min(source_local_index, target_local_index)
            right = max(source_local_index, target_local_index)
            candidates.append((left, right, similarity))

    deduped: dict[tuple[int, int], float] = {}
    for left, right, similarity in candidates:
        key = (left, right)
        deduped[key] = max(deduped.get(key, 0), similarity)

    return [
        {
            "source_memo_id": memos[indices[left]].id,
            "target_memo_id": memos[indices[right]].id,
            "similarity": round(similarity, 4),
        }
        for (left, right), similarity in sorted(
            deduped.items(),
            key=lambda item: item[1],
            reverse=True,
        )
    ]


def extract_keywords_by_group(
    grouped_indices: list[list[int]],
    memos: list[MemoRecord],
) -> list[list[str]]:
    docs = [
        normalize_for_keywords(" ".join(memos[index].content for index in indices))
        for indices in grouped_indices
    ]
    language_by_group = [
        detect_content_language(" ".join(memos[index].content for index in indices))
        for indices in grouped_indices
    ]
    docs = [
        doc if doc else ("miscellaneous notes" if language == "en" else "흩어진 메모")
        for doc, language in zip(docs, language_by_group)
    ]

    vectorizer = CountVectorizer(
        tokenizer=tokenize,
        token_pattern=None,
        ngram_range=(1, 3),
        min_df=1,
        max_features=3000,
    )
    try:
        matrix: Any = vectorizer.fit_transform(docs)
    except ValueError:
        return [
            (["miscellaneous", "notes"] if language == "en" else ["흩어진", "메모"])
            for language in language_by_group
        ]

    terms = [str(term) for term in vectorizer.get_feature_names_out()]
    counts: Any = np.asarray(matrix.toarray(), dtype=np.float64)
    row_sums = counts.sum(axis=1, keepdims=True)
    tf = np.divide(counts, row_sums, out=np.zeros_like(counts), where=row_sums != 0)
    doc_freq = (counts > 0).sum(axis=0)
    idf = np.log((1 + len(docs)) / (1 + doc_freq)) + 1
    scores = tf * idf

    return [
        select_keywords_for_row(
            row_scores,
            terms,
            fallback=("miscellaneous", "notes")
            if language == "en"
            else ("흩어진", "메모"),
        )
        for row_scores, language in zip(scores, language_by_group)
    ]


def select_keywords_for_row(
    row_scores: Any,
    terms: list[str],
    fallback: tuple[str, str] = ("흩어진", "메모"),
) -> list[str]:
    ranked_indices = sorted(
        range(len(terms)),
        key=lambda index: float(row_scores[index]),
        reverse=True,
    )
    keywords: list[str] = []
    for index in ranked_indices:
        if row_scores[index] <= 0:
            break
        clean = terms[index].strip()
        if not clean or clean in keywords:
            continue
        keywords.append(clean)
        if len(keywords) >= constants.TOPIC_KEYWORD_CANDIDATES:
            break

    return keywords or list(fallback)


def build_label(keywords: list[str], memos: list[MemoRecord] | None = None) -> str:
    cluster_memos = memos or []
    language = detect_content_language(" ".join(memo.content for memo in cluster_memos))
    llm_label = build_llm_topic_label(keywords, cluster_memos)
    if llm_label:
        return llm_label

    return build_keyword_label(keywords, language)


def build_keyword_label(
    keywords: list[str], language: ContentLanguage = "ko"
) -> str:
    if keywords:
        return " · ".join(keywords[: constants.TOPIC_LABEL_TERMS])
    return "Miscellaneous notes" if language == "en" else "흩어진 메모"


def build_llm_topic_label(keywords: list[str], memos: list[MemoRecord]) -> str | None:
    if not settings.gemini_api_key or genai is None or genai_types is None or not keywords:
        return None

    language = detect_content_language(" ".join(memo.content for memo in memos))

    client = genai.Client(
        api_key=settings.gemini_api_key,
        http_options=genai_types.HttpOptions(timeout=constants.TOPIC_LLM_LABEL_TIMEOUT_MS),
    )
    config = genai_types.GenerateContentConfig(
        maxOutputTokens=constants.TOPIC_LLM_LABEL_MAX_OUTPUT_TOKENS,
        responseMimeType="application/json",
        responseJsonSchema=TOPIC_LABEL_RESPONSE_SCHEMA,
        temperature=0.2,
    )
    prompt = build_topic_label_prompt(keywords, memos)

    for model in constants.TOPIC_LABEL_MODELS:
        try:
            response = client.models.generate_content(
                model=model,
                contents=prompt,
                config=config,
            )
        except Exception:
            continue

        label = clean_topic_label(extract_topic_label_response(response), language)
        if label:
            return label

    return None


def build_topic_label_prompt(keywords: list[str], memos: list[MemoRecord]) -> str:
    representative_lines = [memo_title(memo) for memo in memos[:5]]
    keyword_text = ", ".join(keywords[: constants.TOPIC_KEYWORD_CANDIDATES])
    memo_text = "\n".join(f"- {line}" for line in representative_lines if line)

    language = detect_content_language(" ".join(memo.content for memo in memos))
    if language == "en":
        return f"""Task: name a topic graph node in a personal knowledge-management app.

Goal: create one broad, useful category name that covers the supplied memo group.

Rules:
- Use a short, intuitive folder-like noun phrase in English (2-4 words).
- Abstract one level above specific incidents, numbers, times, or error symptoms.
- Do not introduce a topic that is unsupported by the input.
- Do not list keywords, write a sentence, or include explanations.
- Technical abbreviations such as UI, API, or SQL are allowed.
- Avoid generic labels such as notes, information, general, content, topic, or miscellaneous.

Good examples:
- Keywords: weekly calendar, all-day block, ellipsis, layout error -> {{"label":"Calendar UI"}}
- Keywords: time, 200 degrees, oven, chicken breast -> {{"label":"Cooking"}}
- Keywords: probability, distribution, expected value, Bayes -> {{"label":"Statistics"}}
- Keywords: WAL, SQLite, sync, indexing -> {{"label":"Databases"}}

Bad examples:
- {{"label":"time · 200 degrees · 2 hours"}}
- {{"label":"fixing an all-day block error"}}
- {{"label":"Notes"}}

Response: return JSON matching the schema only.

Input keywords:
{keyword_text}

Representative memos:
{memo_text or "- Untitled memo"}"""

    return f"""작업: 개인 지식관리 앱의 토픽 그래프 노드 이름을 정한다.

목표: 입력된 메모 묶음을 가장 넓게 포괄하는 상위 개념 카테고리명 1개를 만든다.

판단 기준:
- 폴더명처럼 짧고 직관적이어야 한다.
- 세부 사건, 수치, 시간, 오류 증상을 그대로 쓰지 말고 한 단계 위로 추상화한다.
- 입력에 근거 없는 새 주제는 만들지 않는다.
- 키워드 나열, 문장, 설명을 쓰지 않는다.
- 2~8자 한국어 명사 또는 짧은 명사구를 우선한다.
- UI, API, SQL 같은 보편적 기술 약어는 허용한다.
- 금지 라벨: 메모, 정보, 기타, 내용, 생각, 일반, 주제, 토픽

좋은 예시:
- 키워드: 주별 캘린더, 종일 블록, ellipsis, 레이아웃 오류 → {{"label":"캘린더 UI"}}
- 키워드: 시간, 200도, 2시간, 오븐, 닭가슴살 → {{"label":"요리"}}
- 키워드: 확률, 분포, 기대값, 베이즈, 문제풀이 → {{"label":"통계학"}}
- 키워드: WAL, SQLite, 동기화, 검색, 인덱싱 → {{"label":"데이터베이스"}}

나쁜 예시:
- {{"label":"시간 · 200도 · 2시간"}}
- {{"label":"종일 블록 오류 수정"}}
- {{"label":"메모"}}

응답: JSON schema에 맞는 JSON만 반환한다.

입력 키워드:
{keyword_text}

대표 메모:
{memo_text or "- 제목 없음"}"""


def extract_topic_label_response(response: Any) -> str | None:
    parsed = getattr(response, "parsed", None)
    if isinstance(parsed, dict):
        label = parsed.get("label")
        return label if isinstance(label, str) else None

    text = getattr(response, "text", None)
    if isinstance(text, str) and text.strip():
        label = extract_label_from_json_text(text)
        if label:
            return label
        return text

    candidates = getattr(response, "candidates", None)
    if not candidates:
        return None

    for candidate in candidates:
        content = getattr(candidate, "content", None)
        parts = getattr(content, "parts", None)
        if not parts:
            continue
        for part in parts:
            if getattr(part, "thought", False):
                continue
            part_text = getattr(part, "text", None)
            if isinstance(part_text, str) and part_text.strip():
                return part_text

    return None


def extract_label_from_json_text(text: str) -> str | None:
    stripped = text.strip()
    json_candidates = [stripped]
    match = re.search(r"\{.*?\}", stripped, flags=re.DOTALL)
    if match:
        json_candidates.append(match.group(0))

    for candidate in json_candidates:
        try:
            payload = json.loads(candidate)
        except json.JSONDecodeError:
            continue
        if isinstance(payload, dict):
            label = payload.get("label")
            if isinstance(label, str):
                return label

    return None


def clean_topic_label(
    value: Any, language: ContentLanguage = "ko"
) -> str | None:
    if not isinstance(value, str):
        return None

    label = value.strip()
    label = label.removeprefix("```").removesuffix("```").strip()
    label = label.strip("\"'`“”‘’[](){}")
    label = re.sub(r"^(라벨|카테고리|토픽)\s*[:：]\s*", "", label).strip()
    label = re.split(r"[\n\r]", label, maxsplit=1)[0].strip()
    label = label.strip("\"'`“”‘’[](){}.,，。")
    label = re.sub(r"\s+", " ", label)

    if not label:
        return None
    if any(separator in label for separator in ("·", ",", "，", "/", "\\", "|", ";", "；")):
        return None
    if len(label) > constants.TOPIC_LLM_LABEL_MAX_CHARS:
        return None
    blocklist = TOPIC_LABEL_BLOCKLIST_EN if language == "en" else TOPIC_LABEL_BLOCKLIST
    if label.casefold() in blocklist:
        return None
    if not re.search(r"[가-힣A-Za-z]", label):
        return None

    return label


def memo_title(memo: MemoRecord, limit: int = 80) -> str:
    first_line = next(
        (line.strip() for line in memo.content.splitlines() if line.strip()),
        "",
    )
    if not first_line:
        return "제목 없는 메모"
    return first_line[:limit].strip()


def select_representative_memos(
    indices: list[int],
    embeddings: FloatArray,
    memos: list[MemoRecord],
    limit: int = 3,
) -> list[str]:
    if len(indices) <= limit:
        return [memos[index].id for index in indices]

    cluster_vectors = embeddings[indices]
    centroid = cluster_vectors.mean(axis=0, keepdims=True)
    similarities = np.asarray(
        cosine_similarity(cast(Any, cluster_vectors), cast(Any, centroid)).ravel(),
        dtype=np.float64,
    )
    ranked_local_indices = sorted(
        range(len(similarities)),
        key=lambda index: float(similarities[index]),
        reverse=True,
    )[:limit]
    return [memos[indices[local_index]].id for local_index in ranked_local_indices]


def cluster_confidence(indices: list[int], embeddings: FloatArray) -> float | None:
    if len(indices) <= 1:
        return None

    sims: Any = cosine_similarity(cast(Any, embeddings[indices]))
    upper = sims[np.triu_indices_from(sims, k=1)]
    if upper.size == 0:
        return None

    return round(float(np.mean(upper)), 4)


def normalize_for_embedding(content: str) -> str:
    text = content.strip()
    text = re.sub(r"\s+", " ", text)
    return text


def normalize_for_keywords(content: str) -> str:
    text = DATE_TOKEN_RE.sub(" ", content)
    text = re.sub(r"\s+", " ", text)
    return text.strip()


def tokenize(text: str) -> list[str]:
    return TOKEN_RE.findall(text)


def build_input_hash(memos: list[MemoRecord]) -> str:
    digest = hashlib.sha256()
    for memo in sorted(memos, key=lambda item: item.id):
        digest.update(memo.id.encode("utf-8"))
        digest.update((memo.updated_at or "").encode("utf-8"))
        digest.update(memo.content.encode("utf-8"))
    return digest.hexdigest()
