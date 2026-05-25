from pydantic import BaseModel, Field

from app import constants
from app.db import (
    DatabaseRow,
    content_hash_for_memo,
    fetch_memos_needing_chunk_index,
    format_vector,
    replace_memo_chunks,
)
from app.hashing import short_hash
from app.memo_chunking import build_network_chunks, split_sentences
from app.topic_discovery import encode_texts


class MemoChunkIndexRequest(BaseModel):
    user_id: str
    limit: int = Field(50, ge=1, le=200)


class MemoChunkIndexResponse(BaseModel):
    status: str
    user_id: str
    processed_memo_count: int
    indexed_chunk_count: int
    model: str


def index_dirty_memo_chunks(request: MemoChunkIndexRequest) -> MemoChunkIndexResponse:
    memos = fetch_memos_needing_chunk_index(request.user_id, request.limit)
    indexed_chunk_count = 0

    for memo in memos:
        content_hash = content_hash_for_memo(memo)
        chunks = build_network_chunks(split_sentences(memo.content))
        embeddings = encode_texts([chunk.text for chunk in chunks]) if chunks else []
        rows: list[DatabaseRow] = []

        for index, chunk in enumerate(chunks):
            embedding = embeddings[index]
            rows.append(
                {
                    "chunk_hash": build_chunk_hash(content_hash, chunk.text),
                    "chunk_index": chunk.index,
                    "chunk_text": chunk.text,
                    "start_index": chunk.start,
                    "end_index": chunk.end,
                    "sentence_indices": chunk.sentence_indices,
                    "embedding": format_vector(embedding),
                }
            )

        replace_memo_chunks(request.user_id, memo.id, content_hash, rows)
        indexed_chunk_count += len(rows)

    return MemoChunkIndexResponse(
        status="ok",
        user_id=request.user_id,
        processed_memo_count=len(memos),
        indexed_chunk_count=indexed_chunk_count,
        model=constants.EMBEDDING_MODEL,
    )


def build_chunk_hash(content_hash: str, chunk_text: str) -> str:
    return short_hash(f"{content_hash}:{chunk_text}")
