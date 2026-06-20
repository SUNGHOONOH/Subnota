from fastapi import APIRouter, Depends

from app.api.dependencies.auth import require_admin_key
from app.features.topics.discovery import TopicDiscoveryRequest, run_topic_discovery

router = APIRouter()


@router.post("/topic-discovery/run", dependencies=[Depends(require_admin_key)])
def run_topic_discovery_endpoint(request: TopicDiscoveryRequest) -> dict:
    return run_topic_discovery(request).model_dump()
