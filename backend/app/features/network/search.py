import logging
from concurrent.futures import ThreadPoolExecutor
from typing import Any

from pydantic import BaseModel, Field

from app.core import constants
from app.db.embeddings import (
    fetch_cached_embedding,
    search_similar_inbox_embeddings,
    search_similar_topic_memos,
    upsert_cached_embedding,
)
from app.features.memo.chunking import MemoChunk
from app.features.topics.discovery import encode_texts, normalize_for_embedding
from app.shared.hashing import short_hash

logger = logging.getLogger(__name__)
NETWORK_SEARCH_EXECUTOR = ThreadPoolExecutor(
    max_workers=8,
    thread_name_prefix="network-search",
)


class NetworkSearchRequest(BaseModel):
    query_text: str = Field(min_length=1, max_length=constants.NETWORK_QUERY_MAX_CHARS)
    user_id: str = ""
    memo_id: str | None = None
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


def search_state_b(request: NetworkSearchRequest) -> NetworkSearchResponse:
    query_text = normalize_for_embedding(request.query_text)
    if not query_text:
        return NetworkSearchResponse(
            status="skipped",
            model=constants.EMBEDDING_MODEL_SIGNATURE,
            query_chunk=None,
            results=[],
            message="검색할 메모가 비어 있습니다.",
        )

    query_hash = short_hash(query_text)
    query_chunk = MemoChunk(
        id=f"query-{query_hash}",
        index=0,
        text=query_text,
        start=0,
        end=len(query_text),
        sentence_indices=[],
    )

    chunk_hash = short_hash(f"{constants.EMBEDDING_MODEL_SIGNATURE}:{query_text}")
    embedding = fetch_cached_embedding(request.user_id, chunk_hash)
    if embedding is None:
        embedding = encode_texts([query_text])[0]
        upsert_cached_embedding(request.user_id, chunk_hash, query_text, embedding)

    memo_future = NETWORK_SEARCH_EXECUTOR.submit(
        search_similar_topic_memos,
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
        model=constants.EMBEDDING_MODEL_SIGNATURE,
        query_chunk=query_chunk,
        results=results[: request.limit],
        message=None if results else "관련성이 충분한 연결을 찾지 못했습니다.",
    )


def memo_row_to_result(row: dict[str, Any]) -> NetworkSearchResult:
    memo_id = str(row.get("memo_id") or "")
    memo_content = str(row.get("memo_content") or "")
    preview = next(
        (line.strip() for line in memo_content.splitlines() if line.strip()),
        memo_content.strip(),
    )[:240]
    return NetworkSearchResult(
        source_kind="memo",
        memo_id=memo_id,
        chunk_id=memo_id,
        chunk_text=preview,
        memo_content=memo_content,
        memo_created_at=optional_str(row.get("memo_created_at")),
        memo_updated_at=optional_str(row.get("memo_updated_at")),
        start_index=0,
        end_index=len(preview),
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
