import logging
from uuid import uuid4

from pydantic import BaseModel, Field

from app.core import constants
from app.db import (
    DatabaseRow,
    claim_memo_chunk_index_lease,
    content_hash_for_memo,
    fetch_cached_embeddings,
    fetch_memos_needing_chunk_index,
    format_vector,
    rebuild_user_memo_chunk_edges,
    release_memo_chunk_index_lease,
    replace_memo_chunks,
    upsert_cached_embeddings,
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
    failed_memo_count: int
    failed_memo_ids: list[str]
    stale_memo_count: int
    edge_rebuild_failed: bool
    model: str


def index_dirty_memo_chunks(request: MemoChunkIndexRequest) -> MemoChunkIndexResponse:
    lease_token = str(uuid4())
    acquired = claim_memo_chunk_index_lease(
        request.user_id,
        lease_token,
        constants.MEMO_CHUNK_INDEX_LEASE_SECONDS,
    )
    if not acquired:
        return MemoChunkIndexResponse(
            status="busy",
            user_id=request.user_id,
            processed_memo_count=0,
            indexed_chunk_count=0,
            failed_memo_count=0,
            failed_memo_ids=[],
            stale_memo_count=0,
            edge_rebuild_failed=False,
            model=constants.EMBEDDING_MODEL,
        )

    try:
        return _index_dirty_memo_chunks_claimed(request)
    finally:
        try:
            release_memo_chunk_index_lease(request.user_id, lease_token)
        except Exception:
            logger.warning(
                "memo chunk index lease release failed for user %s",
                request.user_id,
                exc_info=True,
            )


def _index_dirty_memo_chunks_claimed(
    request: MemoChunkIndexRequest,
) -> MemoChunkIndexResponse:
    memos = fetch_memos_needing_chunk_index(request.user_id, request.limit)
    indexed_chunk_count = 0
    processed_memo_count = 0
    failed_memo_ids: list[str] = []
    stale_memo_count = 0

    for memo in memos:
        try:
            content_hash = content_hash_for_memo(memo)
            chunks = build_network_chunks(split_sentences(memo.content))
            cache_hashes = [build_embedding_cache_hash(chunk.text) for chunk in chunks]
            cached = fetch_cached_embeddings(request.user_id, cache_hashes)
            missing_hashes = list(dict.fromkeys(
                cache_hash
                for cache_hash in cache_hashes
                if cache_hash not in cached
            ))
            text_by_hash = {
                cache_hash: chunk.text
                for cache_hash, chunk in zip(cache_hashes, chunks, strict=True)
            }
            if missing_hashes:
                generated = encode_texts([text_by_hash[value] for value in missing_hashes])
                generated_rows = [
                    {
                        "user_id": request.user_id,
                        "chunk_hash": cache_hash,
                        "chunk_text": text_by_hash[cache_hash],
                        "embedding": generated[index],
                    }
                    for index, cache_hash in enumerate(missing_hashes)
                ]
                upsert_cached_embeddings(generated_rows)
                cached.update({
                    row["chunk_hash"]: row["embedding"]
                    for row in generated_rows
                })
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
                        "embedding": format_vector(cached[cache_hashes[index]]),
                    }
                )

            replaced = replace_memo_chunks(
                request.user_id,
                memo.id,
                content_hash,
                memo.content,
                rows,
            )
            if not replaced:
                stale_memo_count += 1
                continue
            indexed_chunk_count += len(rows)
            processed_memo_count += 1

        except Exception:
            # Isolate per-memo failures so one bad memo cannot halt chunk indexing
            # for the rest of the user's dirty memos in this batch.
            logger.warning(
                "memo chunk indexing failed for memo %s", memo.id, exc_info=True
            )
            failed_memo_ids.append(memo.id)

    edge_rebuild_failed = False
    if processed_memo_count:
        try:
            rebuild_user_memo_chunk_edges(
                request.user_id,
                constants.MEMO_CHUNK_EDGE_TOP_K,
                constants.MEMO_CHUNK_EDGE_MIN_SIMILARITY,
            )
        except Exception:
            edge_rebuild_failed = True
            logger.warning(
                "memo chunk edge rebuild failed for user %s",
                request.user_id,
                exc_info=True,
            )

    return MemoChunkIndexResponse(
        status="partial" if failed_memo_ids or edge_rebuild_failed else "ok",
        user_id=request.user_id,
        processed_memo_count=processed_memo_count,
        indexed_chunk_count=indexed_chunk_count,
        failed_memo_count=len(failed_memo_ids),
        failed_memo_ids=failed_memo_ids,
        stale_memo_count=stale_memo_count,
        edge_rebuild_failed=edge_rebuild_failed,
        model=constants.EMBEDDING_MODEL,
    )


def build_chunk_hash(content_hash: str, chunk_text: str) -> str:
    return short_hash(f"{content_hash}:{chunk_text}")


def build_embedding_cache_hash(chunk_text: str) -> str:
    return short_hash(f"{constants.EMBEDDING_MODEL}:{chunk_text}")
