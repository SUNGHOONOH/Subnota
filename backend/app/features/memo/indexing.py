import logging

from pydantic import BaseModel, Field

from app.core import constants
from app.db import (
    DatabaseRow,
    content_hash_for_memo,
    fetch_memos_needing_chunk_index,
    format_vector,
    replace_memo_chunks,
)
from app.shared.hashing import short_hash
from app.features.memo.chunking import build_network_chunks, split_sentences
from app.features.topics.discovery import encode_texts

logger = logging.getLogger(__name__)


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
    processed_memo_count = 0

    for memo in memos:
        try:
            content_hash = content_hash_for_memo(memo)
            chunks = build_network_chunks(split_sentences(memo.content))
            embeddings = (
                encode_texts([chunk.text for chunk in chunks]) if chunks else []
            )
            rows: list[DatabaseRow] = []
            seen_hashes: set[str] = set()

            for index, chunk in enumerate(chunks):
                chunk_hash = build_chunk_hash(content_hash, chunk.text)
                # memo_chunks enforces unique (memo_id, chunk_hash); repeated chunk
                # text in a memo would otherwise fail the whole insert, leaving the
                # memo with its old chunks deleted but no new ones written.
                if chunk_hash in seen_hashes:
                    continue
                seen_hashes.add(chunk_hash)
                rows.append(
                    {
                        "chunk_hash": chunk_hash,
                        "chunk_index": chunk.index,
                        "chunk_text": chunk.text,
                        "start_index": chunk.start,
                        "end_index": chunk.end,
                        "sentence_indices": chunk.sentence_indices,
                        "embedding": format_vector(embeddings[index]),
                    }
                )

            replace_memo_chunks(request.user_id, memo.id, content_hash, rows)
            indexed_chunk_count += len(rows)
            processed_memo_count += 1
        except Exception:
            # Isolate per-memo failures so one bad memo cannot halt chunk indexing
            # for the rest of the user's dirty memos in this batch.
            logger.warning(
                "memo chunk indexing failed for memo %s", memo.id, exc_info=True
            )

    return MemoChunkIndexResponse(
        status="ok",
        user_id=request.user_id,
        processed_memo_count=processed_memo_count,
        indexed_chunk_count=indexed_chunk_count,
        model=constants.EMBEDDING_MODEL,
    )


def build_chunk_hash(content_hash: str, chunk_text: str) -> str:
    return short_hash(f"{content_hash}:{chunk_text}")
