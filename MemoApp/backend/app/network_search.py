from typing import Any

from pydantic import BaseModel, Field

from app import constants
from app.db import fetch_cached_embedding, search_similar_chunks, upsert_cached_embedding
from app.hashing import short_hash
from app.memo_chunking import MemoChunk, MemoChunkRequest, split_memo_chunks
from app.topic_discovery import encode_texts


class NetworkSearchRequest(BaseModel):
    text: str
    cursor_index: int
    user_id: str = ""
    memo_id: str | None = None
    limit: int = Field(5, ge=1, le=10)


class NetworkSearchResult(BaseModel):
    memo_id: str
    chunk_id: str
    chunk_text: str
    memo_content: str
    memo_created_at: str | None = None
    memo_updated_at: str | None = None
    start_index: int
    end_index: int
    similarity: float


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

    rows = search_similar_chunks(
        request.user_id,
        embedding,
        request.memo_id,
        request.limit,
    )

    return NetworkSearchResponse(
        status="ok",
        model=constants.EMBEDDING_MODEL,
        query_chunk=query_chunk,
        results=[row_to_result(row) for row in rows],
    )


def row_to_result(row: dict[str, Any]) -> NetworkSearchResult:
    return NetworkSearchResult(
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


def optional_str(value: Any) -> str | None:
    return str(value) if value is not None else None
