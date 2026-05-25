import hashlib
import importlib
import re
from collections import defaultdict
from typing import Any, cast

from huggingface_hub import InferenceClient
import numpy as np
from pydantic import BaseModel, Field
from sklearn.cluster import AgglomerativeClustering
from sklearn.feature_extraction.text import CountVectorizer
from sklearn.metrics.pairwise import cosine_similarity

from app import constants
from app.config import settings
from app.db import (
    DatabaseRow,
    MemoRecord,
    fetch_user_memos,
    has_topic_dirty_memos,
    mark_topic_memos_clean,
    replace_topic_clusters,
)

DATE_TOKEN_RE = re.compile(
    r"(오늘|내일|모레|글피|\d{1,2}월\s*\d{1,2}일|\d{2,4}[./-]\d{1,2}[./-]\d{1,2})"
)
TOKEN_RE = re.compile(r"[가-힣A-Za-z0-9]{2,}")


class TopicDiscoveryRequest(BaseModel):
    user_id: str = Field(..., description="Supabase auth user id")
    force: bool = Field(False, description="Run even if memo count is low")
    persist: bool = Field(True, description="Save clusters into Supabase topic tables")


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
            model=constants.EMBEDDING_MODEL,
            clustering_method=None,
            clusters=[],
            message="No topic_dirty memos. State A topic discovery skipped.",
        )

    memos = fetch_user_memos(request.user_id)

    if len(memos) < constants.TOPIC_MIN_MEMOS and not request.force:
        return TopicDiscoveryResponse(
            status="skipped",
            user_id=request.user_id,
            memo_count=len(memos),
            cluster_count=0,
            model=constants.EMBEDDING_MODEL,
            clustering_method=None,
            clusters=[],
            message=f"Need at least {constants.TOPIC_MIN_MEMOS} memos. Use force=true for testing.",
        )

    if not memos:
        return TopicDiscoveryResponse(
            status="skipped",
            user_id=request.user_id,
            memo_count=0,
            cluster_count=0,
            model=constants.EMBEDDING_MODEL,
            clustering_method=None,
            clusters=[],
            message="No memos found.",
        )

    normalized_texts = [normalize_for_embedding(memo.content) for memo in memos]
    embeddings = encode_texts(normalized_texts)
    labels, clustering_method = cluster_embeddings(embeddings)
    grouped = group_memos_by_cluster(memos, labels)
    results, storage_clusters, memberships, edges = build_topic_results(
        request.user_id,
        grouped,
        embeddings,
        memos,
        build_input_hash(memos),
        clustering_method,
    )

    if request.persist:
        replace_topic_clusters(request.user_id, storage_clusters, memberships, edges)
        mark_topic_memos_clean(request.user_id)

    return TopicDiscoveryResponse(
        status="ok",
        user_id=request.user_id,
        memo_count=len(memos),
        cluster_count=len(results),
        model=constants.EMBEDDING_MODEL,
        clustering_method=clustering_method,
        clusters=results,
        message="State A topic discovery completed.",
    )


FloatArray = Any


def encode_texts(texts: list[str]) -> FloatArray:
    if not settings.hf_token:
        raise RuntimeError("HF_TOKEN is required for Hugging Face Inference API embeddings")

    client = InferenceClient(token=settings.hf_token)
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
    if len(embeddings) <= 2:
        return [0 for _ in range(len(embeddings))], "single_cluster"

    if len(embeddings) >= constants.TOPIC_HDBSCAN_MIN_MEMOS:
        return run_hdbscan(embeddings), "hdbscan"

    return run_agglomerative(embeddings), "agglomerative"


def run_agglomerative(embeddings: FloatArray) -> list[int]:
    clustering = AgglomerativeClustering(
        n_clusters=None,
        metric="cosine",
        linkage="average",
        distance_threshold=constants.TOPIC_DISTANCE_THRESHOLD,
    )
    labels = clustering.fit_predict(cast(Any, embeddings))
    return labels_to_ints(labels)


def run_hdbscan(embeddings: FloatArray) -> list[int]:
    min_cluster_size = min(constants.TOPIC_HDBSCAN_MIN_CLUSTER_SIZE, len(embeddings))
    min_samples = min(constants.TOPIC_HDBSCAN_MIN_SAMPLES, min_cluster_size)

    hdbscan_class = get_sklearn_hdbscan_class()
    clustering = hdbscan_class(
        min_cluster_size=max(2, min_cluster_size),
        min_samples=max(1, min_samples),
        metric="euclidean",
    )
    labels = clustering.fit_predict(cast(Any, embeddings))
    return labels_to_ints(labels)


def labels_to_ints(labels: Any) -> list[int]:
    return [int(label) for label in labels]


def get_sklearn_hdbscan_class() -> Any:
    cluster_module = importlib.import_module("sklearn.cluster")
    hdbscan_class = getattr(cluster_module, "HDBSCAN", None)
    if hdbscan_class is None:
        raise RuntimeError(
            "scikit-learn HDBSCAN is unavailable. Use the backend venv and install "
            "scikit-learn>=1.3: /Users/sunghoon/Projects/memo/MemoApp/backend/.venv/bin/python "
            "-m pip install -U scikit-learn"
        )
    return hdbscan_class


def group_memos_by_cluster(
    memos: list[MemoRecord],
    labels: list[int],
) -> list[list[int]]:
    groups: dict[int, list[int]] = defaultdict(list)
    for index, label in enumerate(labels):
        groups[label].append(index)

    multi_memo_groups: list[list[int]] = []
    scattered: list[int] = []

    for label, indices in groups.items():
        if label == -1 or len(indices) <= 1:
            scattered.extend(indices)
        else:
            multi_memo_groups.append(indices)

    multi_memo_groups.sort(key=len, reverse=True)
    selected = multi_memo_groups[: constants.TOPIC_MAX_CLUSTERS]

    if scattered:
        selected.append(scattered)

    return selected


def build_topic_results(
    user_id: str,
    grouped_indices: list[list[int]],
    embeddings: FloatArray,
    memos: list[MemoRecord],
    input_hash: str,
    clustering_method: str,
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

    for group_index, indices in enumerate(grouped_indices):
        cluster_memos = [memos[index] for index in indices]
        keywords = keywords_by_group[group_index]
        label = build_label(keywords)
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
        storage_clusters.append(
            {
                "user_id": user_id,
                "label": label,
                "keywords": keywords,
                "representative_memo_ids": representative_ids,
                "memo_count": len(cluster_memos),
                "confidence": confidence,
                "model_version": f"{constants.EMBEDDING_MODEL}:{clustering_method}",
                "input_hash": input_hash,
                "source": "server",
            }
        )
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
    docs = [doc if doc else "흩어진 메모" for doc in docs]

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
        return [["흩어진", "메모"] for _ in grouped_indices]

    terms = [str(term) for term in vectorizer.get_feature_names_out()]
    counts: Any = np.asarray(matrix.toarray(), dtype=np.float64)
    row_sums = counts.sum(axis=1, keepdims=True)
    tf = np.divide(counts, row_sums, out=np.zeros_like(counts), where=row_sums != 0)
    doc_freq = (counts > 0).sum(axis=0)
    idf = np.log((1 + len(docs)) / (1 + doc_freq)) + 1
    scores = tf * idf

    return [select_keywords_for_row(row_scores, terms) for row_scores in scores]


def select_keywords_for_row(row_scores: Any, terms: list[str]) -> list[str]:
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
        if len(keywords) >= constants.TOPIC_LABEL_TERMS:
            break

    return keywords or ["흩어진", "메모"]


def build_label(keywords: list[str]) -> str:
    return " · ".join(keywords[: constants.TOPIC_LABEL_TERMS]) if keywords else "흩어진 메모"


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
