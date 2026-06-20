from fastapi import APIRouter, Depends

from app.api.dependencies.auth import require_admin_key
from app.features.memo.chunking import MemoChunkRequest, split_memo_chunks
from app.features.memo.indexing import MemoChunkIndexRequest, index_dirty_memo_chunks

router = APIRouter()


@router.post("/memo-chunks/split")
def split_memo_chunks_endpoint(request: MemoChunkRequest) -> dict:
    return split_memo_chunks(request).model_dump()


@router.post("/memo-chunks/index-dirty", dependencies=[Depends(require_admin_key)])
def index_dirty_memo_chunks_endpoint(request: MemoChunkIndexRequest) -> dict:
    return index_dirty_memo_chunks(request).model_dump()
