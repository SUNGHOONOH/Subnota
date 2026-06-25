from fastapi import APIRouter, Depends, HTTPException

from app.api.dependencies.auth import require_user_id
from app.core.config import settings
from app.db.rate_limits import consume_network_rate_limit
from app.features.network.search import NetworkSearchRequest, search_network_chunks

router = APIRouter()


@router.post("/network/search")
def search_network_chunks_endpoint(
    request: NetworkSearchRequest,
    user_id: str = Depends(require_user_id),
) -> dict:
    decision = consume_network_rate_limit(
        user_id,
        settings.network_rate_limit_per_minute,
    )
    if not decision.allowed:
        raise HTTPException(
            status_code=429,
            detail="요청이 많습니다. 잠시 후 다시 시도해 주세요.",
            headers={"Retry-After": str(decision.retry_after_seconds)},
        )
    return search_network_chunks(request.model_copy(update={"user_id": user_id})).model_dump()
