from fastapi import APIRouter, Depends

from app.api.dependencies.auth import require_user_id
from app.features.network.search import NetworkSearchRequest, search_network_chunks

router = APIRouter()


@router.post("/network/search")
def search_network_chunks_endpoint(
    request: NetworkSearchRequest,
    user_id: str = Depends(require_user_id),
) -> dict:
    return search_network_chunks(request.model_copy(update={"user_id": user_id})).model_dump()
