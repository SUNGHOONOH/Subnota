from fastapi import APIRouter, Depends, HTTPException

from app.api.dependencies.auth import require_admin_key, require_user_id
from app.core.config import settings
from app.db.rate_limits import consume_network_rate_limit
from app.features.memo.chunking import MemoChunkRequest, split_memo_chunks
from app.features.memo.indexing import MemoChunkIndexRequest, index_dirty_memo_chunks

router = APIRouter()


@router.post("/memo-chunks/split")
def split_memo_chunks_endpoint(
    request: MemoChunkRequest,
    user_id: str = Depends(require_user_id),
) -> dict:
    # The embedding path runs the model and is the costly one, so it is the only
    # path that consumes the rate limit. Auth + the request-body size cap
    # (MemoChunkRequest.text max_length) already bound the cheap split path.
    if request.include_embeddings:
        decision = consume_network_rate_limit(
            user_id,
            settings.chunk_split_rate_limit_per_minute,
        )
        if not decision.allowed:
            raise HTTPException(
                status_code=429,
                detail="요청이 많습니다. 잠시 후 다시 시도해 주세요.",
                headers={"Retry-After": str(decision.retry_after_seconds)},
            )
    return split_memo_chunks(request).model_dump()


@router.post("/memo-chunks/index-dirty", dependencies=[Depends(require_admin_key)])
def index_dirty_memo_chunks_endpoint(request: MemoChunkIndexRequest) -> dict:
    return index_dirty_memo_chunks(request).model_dump()
