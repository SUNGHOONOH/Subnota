from fastapi import APIRouter, Depends

from app.api.dependencies.auth import require_admin_key, require_user_id
from app.features.topics.discovery import TopicDiscoveryRequest, run_topic_discovery

router = APIRouter()


@router.post("/topic-discovery/run", dependencies=[Depends(require_admin_key)])
def run_topic_discovery_endpoint(request: TopicDiscoveryRequest) -> dict:
    return run_topic_discovery(request).model_dump()


@router.post("/topic-discovery/regenerate")
def regenerate_topic_discovery_endpoint(
    user_id: str = Depends(require_user_id),
) -> dict:
    return run_topic_discovery(
        TopicDiscoveryRequest(
            user_id=user_id,
            force=True,
            persist=True,
            preserve_existing_identity=False,
        )
    ).model_dump()
