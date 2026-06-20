import logging
from typing import Any

from pydantic import BaseModel, Field

from app.core import constants
from app.db import (
    fetch_cached_embedding,
    search_similar_chunks,
    search_similar_inbox_embeddings,
    upsert_cached_embedding,
)
from app.shared.hashing import short_hash
from app.features.memo.chunking import MemoChunk, MemoChunkRequest, split_memo_chunks
from app.features.topics.discovery import encode_texts

logger = logging.getLogger(__name__)


class NetworkSearchRequest(BaseModel):
    text: str
    cursor_index: int
    user_id: str = ""
    memo_id: str | None = None
    limit: int = Field(5, ge=1, le=10)


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
    chunk_response = split_memo_chunks(
        MemoChunkRequest(text=request.text, cursor_index=request.cursor_index)
    )
    query_chunk = chunk_response.cursor_network_chunk

    if query_chunk is None:
        return NetworkSearchResponse(
            status="skipped",
            model=constants.EMBEDDING_MODEL,
            query_chunk=None,
            results=[],
            message="No chunk found at cursor.",
        )

    chunk_hash = short_hash(query_chunk.text)
    embedding = fetch_cached_embedding(request.user_id, chunk_hash)
    if embedding is None:
        embedding = encode_texts([query_chunk.text])[0]
        upsert_cached_embedding(request.user_id, chunk_hash, query_chunk.text, embedding)

    memo_rows = search_similar_chunks(
        request.user_id,
        embedding,
        request.memo_id,
        request.limit,
    )
    try:
        inbox_rows = search_similar_inbox_embeddings(
            request.user_id,
            embedding,
            request.limit,
        )
    except Exception:
        logger.warning("inbox embedding search failed", exc_info=True)
        inbox_rows = []
    results = [memo_row_to_result(row) for row in memo_rows] + [
        inbox_row_to_result(row) for row in inbox_rows
    ]
    results.sort(key=lambda result: result.similarity, reverse=True)

    return NetworkSearchResponse(
        status="ok",
        model=constants.EMBEDDING_MODEL,
        query_chunk=query_chunk,
        results=results[: request.limit],
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
