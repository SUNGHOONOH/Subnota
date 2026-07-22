import hashlib
import importlib
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
import numpy as np
from pydantic import BaseModel, Field
from sklearn.cluster import AgglomerativeClustering
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
from app.db.topics import has_topic_dirty_memos, mark_topic_memos_clean, replace_topic_clusters
from app.db.types import DatabaseRow, MemoRecord
from app.db.utils import content_hash_for_memo

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
TOPIC_LABEL_RESPONSE_SCHEMA = {
    "type": "object",
    "properties": {
        "label": {
            "type": "string",
            "description": (
                "메모 묶음을 포괄하는 상위 개념 한국어 카테고리명 1개. "
                "키워드 나열이나 문장이 아니라 폴더명처럼 짧은 명사구여야 한다."
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
        if request.persist:
            replace_topic_clusters(request.user_id, [], [], [])
            mark_topic_memos_clean(request.user_id, memos)
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
        if request.persist:
            replace_topic_clusters(request.user_id, [], [], [])
            mark_topic_memos_clean(request.user_id, memos)
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
    embeddings = load_or_create_topic_embeddings(request.user_id, memos, normalized_texts)
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

    if request.persist:
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
        model=constants.EMBEDDING_MODEL,
        clustering_method=clustering_method,
        clusters=results,
        message="State A topic discovery completed.",
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
        label = build_label(keywords, cluster_memos)
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
        if len(keywords) >= constants.TOPIC_KEYWORD_CANDIDATES:
            break

    return keywords or ["흩어진", "메모"]


def build_label(keywords: list[str], memos: list[MemoRecord] | None = None) -> str:
    llm_label = build_llm_topic_label(keywords, memos or [])
    if llm_label:
        return llm_label

    return build_keyword_label(keywords)


def build_keyword_label(keywords: list[str]) -> str:
    return " · ".join(keywords[: constants.TOPIC_LABEL_TERMS]) if keywords else "흩어진 메모"


def build_llm_topic_label(keywords: list[str], memos: list[MemoRecord]) -> str | None:
    if not settings.gemini_api_key or genai is None or genai_types is None or not keywords:
        return None

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

        label = clean_topic_label(extract_topic_label_response(response))
        if label:
            return label

    return None


def build_topic_label_prompt(keywords: list[str], memos: list[MemoRecord]) -> str:
    representative_lines = [memo_title(memo) for memo in memos[:5]]
    keyword_text = ", ".join(keywords[: constants.TOPIC_KEYWORD_CANDIDATES])
    memo_text = "\n".join(f"- {line}" for line in representative_lines if line)

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


def clean_topic_label(value: Any) -> str | None:
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
    if label in TOPIC_LABEL_BLOCKLIST:
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
