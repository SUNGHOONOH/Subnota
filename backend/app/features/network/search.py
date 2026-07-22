import logging
import re
from concurrent.futures import ThreadPoolExecutor
from typing import Any

from pydantic import BaseModel, Field

from app.core import constants
from app.db.embeddings import (
    fetch_cached_embedding,
    fetch_memo_chunk_neighbors,
    search_similar_chunks,
    search_similar_inbox_embeddings,
    upsert_cached_embedding,
)
from app.db.memos import fetch_memo_chunk_refs
from app.shared.hashing import short_hash
from app.features.memo.chunking import MemoChunk, split_sentences
from app.features.topics.discovery import encode_texts

logger = logging.getLogger(__name__)
NETWORK_SEARCH_EXECUTOR = ThreadPoolExecutor(
    max_workers=8,
    thread_name_prefix="network-search",
)


class NetworkSearchRequest(BaseModel):
    query_text: str = Field(min_length=1, max_length=constants.NETWORK_QUERY_MAX_CHARS)
    user_id: str = ""
    memo_id: str | None = None
    cursor_index: int | None = Field(default=None, ge=0)
    limit: int = Field(5, ge=1, le=10)
    minimum_similarity: float = Field(
        constants.NETWORK_DEFAULT_MIN_SIMILARITY,
        ge=0,
        le=1,
    )

class NetworkSearchResult(BaseModel):
    source_kind: str = "memo"
    source_label: str | None = None
    memo_id: str | None = None
    inbox_session_id: str | None = None
    chunk_id: str
    chunk_text: str
    memo_content: str | None = None
    memo_created_at: str | None = None
    memo_updated_at: str | None = None
    start_index: int
    end_index: int
    similarity: float
    source_type: str | None = None
    title: str | None = None
    source_url: str | None = None
    thumbnail_url: str | None = None
    created_at: str | None = None


class NetworkSearchResponse(BaseModel):
    status: str
    model: str
    query_chunk: MemoChunk | None
    results: list[NetworkSearchResult]
    message: str | None = None


def search_network_chunks(request: NetworkSearchRequest) -> NetworkSearchResponse:
    query_text = request.query_text.strip()
    if not query_text:
        return NetworkSearchResponse(
            status="skipped",
            model=constants.EMBEDDING_MODEL,
            query_chunk=None,
            results=[],
            message="검색할 문단이 비어 있습니다.",
        )

    # Hybrid: when the cursor sits on an already-indexed chunk of the active
    # memo, serve its precomputed neighbours (no live embedding). Falls back to
    # the live KNN path when the chunk isn't indexed yet or has no edges.
    if request.memo_id:
        indexed_chunk = resolve_indexed_chunk(
            request.user_id,
            request.memo_id,
            request.cursor_index,
            query_text,
        )
        if indexed_chunk is not None:
            precomputed = build_precomputed_response(request, indexed_chunk)
            if precomputed is not None:
                return precomputed

    return search_live_network_chunks(request, query_text)


def _normalize_ws(text: str) -> str:
    return re.sub(r"\s+", " ", text).strip()


def resolve_indexed_chunk(
    user_id: str,
    memo_id: str,
    cursor_index: int | None,
    query_text: str,
) -> dict[str, Any] | None:
    """Map the cursor onto one of the memo's stored chunks, by character offset
    when available, otherwise by whitespace-normalized sentence overlap.

    Verbatim containment does not work here: stored chunk_text joins sentences
    with '\\n' while the editor's cursor paragraph joins them with spaces, so a
    multi-sentence chunk is never a literal substring of the query."""
    refs = fetch_memo_chunk_refs(user_id, memo_id)
    if not refs:
        return None

    if cursor_index is not None:
        for ref in refs:
            if ref["start_index"] <= cursor_index < ref["end_index"]:
                return ref

    query_norm = _normalize_ws(query_text)
    if not query_norm:
        return None
    query_sentences = [
        _normalize_ws(sentence.text) for sentence in split_sentences(query_text)
    ]

    best: dict[str, Any] | None = None
    best_score = 0
    for ref in refs:
        chunk_norm = _normalize_ws(str(ref["chunk_text"]))
        if not chunk_norm:
            continue
        if chunk_norm in query_norm or query_norm in chunk_norm:
            score = len(chunk_norm)
        else:
            # Partial overlap (query window straddling a chunk boundary):
            # score by the total length of shared sentences.
            score = sum(
                len(sentence)
                for sentence in query_sentences
                if sentence and sentence in chunk_norm
            )
        if score > best_score:
            best = ref
            best_score = score
    return best


def build_precomputed_response(
    request: NetworkSearchRequest,
    chunk: dict[str, Any],
) -> NetworkSearchResponse | None:
    chunk_id = str(chunk["id"])
    chunk_text = str(chunk["chunk_text"])

    memo_rows = fetch_memo_chunk_neighbors(request.user_id, chunk_id, request.limit)
    if not memo_rows:
        # No edges yet (e.g. before the batch rebuild) — signal the caller to
        # fall back to the live path so results don't regress.
        return None

    # Inbox connections still come from vector search, but reuse the chunk's
    # cached embedding (written at index time) so this remains a cache hit.
    inbox_rows: list[dict[str, Any]] = []
    cache_hash = short_hash(f"{constants.EMBEDDING_MODEL}:{chunk_text}")
    embedding = fetch_cached_embedding(request.user_id, cache_hash)
    if embedding is not None:
        try:
            inbox_rows = search_similar_inbox_embeddings(
                request.user_id, embedding, request.limit
            )
        except Exception:
            logger.warning("inbox embedding search failed", exc_info=True)
            inbox_rows = []

    results = [memo_row_to_result(row) for row in memo_rows] + [
        inbox_row_to_result(row) for row in inbox_rows
    ]
    results = [
        result
        for result in results
        if result.similarity >= request.minimum_similarity
    ]
    results.sort(key=lambda result: result.similarity, reverse=True)

    query_chunk = MemoChunk(
        id=f"chunk-{chunk_id}",
        index=0,
        text=chunk_text,
        start=0,
        end=len(chunk_text),
        sentence_indices=[],
    )
    return NetworkSearchResponse(
        status="ok",
        model=constants.EMBEDDING_MODEL,
        query_chunk=query_chunk,
        results=results[: request.limit],
        message=None if results else "관련성이 충분한 연결을 찾지 못했습니다.",
    )


def search_live_network_chunks(
    request: NetworkSearchRequest,
    query_text: str,
) -> NetworkSearchResponse:
    query_hash = short_hash(query_text)
    query_chunk = MemoChunk(
        id=f"query-{query_hash}",
        index=0,
        text=query_text,
        start=0,
        end=len(query_text),
        sentence_indices=[],
    )

    chunk_hash = short_hash(f"{constants.EMBEDDING_MODEL}:{query_text}")
    embedding = fetch_cached_embedding(request.user_id, chunk_hash)
    if embedding is None:
        embedding = encode_texts([query_text])[0]
        upsert_cached_embedding(request.user_id, chunk_hash, query_text, embedding)

    memo_future = NETWORK_SEARCH_EXECUTOR.submit(
        search_similar_chunks,
        request.user_id,
        embedding,
        request.memo_id,
        request.limit,
    )
    inbox_future = NETWORK_SEARCH_EXECUTOR.submit(
        search_similar_inbox_embeddings,
        request.user_id,
        embedding,
        request.limit,
    )
    memo_rows = memo_future.result()
    try:
        inbox_rows = inbox_future.result()
    except Exception:
        logger.warning("inbox embedding search failed", exc_info=True)
        inbox_rows = []
    results = [memo_row_to_result(row) for row in memo_rows] + [
        inbox_row_to_result(row) for row in inbox_rows
    ]
    results = [
        result
        for result in results
        if result.similarity >= request.minimum_similarity
    ]
    results.sort(key=lambda result: result.similarity, reverse=True)

    return NetworkSearchResponse(
        status="ok",
        model=constants.EMBEDDING_MODEL,
        query_chunk=query_chunk,
        results=results[: request.limit],
        message=None if results else "관련성이 충분한 연결을 찾지 못했습니다.",
    )


def memo_row_to_result(row: dict[str, Any]) -> NetworkSearchResult:
    return NetworkSearchResult(
        source_kind="memo",
        memo_id=str(row.get("memo_id") or ""),
        chunk_id=str(row.get("chunk_id") or ""),
        chunk_text=str(row.get("chunk_text") or ""),
        memo_content=str(row.get("memo_content") or ""),
        memo_created_at=optional_str(row.get("memo_created_at")),
        memo_updated_at=optional_str(row.get("memo_updated_at")),
        start_index=int(row.get("start_index") or 0),
        end_index=int(row.get("end_index") or 0),
        similarity=float(row.get("similarity") or 0),
    )


def inbox_row_to_result(row: dict[str, Any]) -> NetworkSearchResult:
    return NetworkSearchResult(
        source_kind="inbox",
        source_label=optional_str(row.get("source_label")),
        inbox_session_id=optional_str(row.get("inbox_session_id")),
        chunk_id=str(row.get("chunk_id") or ""),
        chunk_text=str(row.get("chunk_text") or ""),
        start_index=0,
        end_index=len(str(row.get("chunk_text") or "")),
        similarity=float(row.get("similarity") or 0),
        source_type=optional_str(row.get("source_type")),
        title=optional_str(row.get("title")),
        source_url=optional_str(row.get("source_url")),
        thumbnail_url=optional_str(row.get("thumbnail_url")),
        created_at=optional_str(row.get("created_at")),
    )


def optional_str(value: Any) -> str | None:
    return str(value) if value is not None else None
