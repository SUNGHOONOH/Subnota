from fastapi import Depends, FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.auth import require_admin_key, require_user_id
from app.config import settings
from app.maintenance import (
    DailyMaintenanceAllRequest,
    DailyMaintenanceRequest,
    run_daily_maintenance,
    run_daily_maintenance_for_all,
)
from app.memo_indexing import MemoChunkIndexRequest, index_dirty_memo_chunks
from app.memo_chunking import MemoChunkRequest, split_memo_chunks
from app.network_search import NetworkSearchRequest, search_network_chunks
from app.schedule_batch import ScheduleInboxRunRequest, run_schedule_inbox_batch
from app.topic_discovery import TopicDiscoveryRequest, run_topic_discovery

app = FastAPI(
    title="MemoApp Backend",
    version="0.1.0",
    debug=settings.backend_env == "development",
)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_headers=["Authorization", "Content-Type"],
    allow_methods=["GET", "POST", "OPTIONS"],
    allow_origins=[
        origin.strip()
        for origin in settings.cors_allow_origins.split(",")
        if origin.strip()
    ],
)


@app.get("/health")
def health_check() -> dict[str, str]:
    return {"status": "ok"}


@app.post("/topic-discovery/run", dependencies=[Depends(require_admin_key)])
def run_topic_discovery_endpoint(request: TopicDiscoveryRequest) -> dict:
    return run_topic_discovery(request).model_dump()


@app.post("/memo-chunks/split")
def split_memo_chunks_endpoint(request: MemoChunkRequest) -> dict:
    return split_memo_chunks(request).model_dump()


@app.post("/memo-chunks/index-dirty", dependencies=[Depends(require_admin_key)])
def index_dirty_memo_chunks_endpoint(request: MemoChunkIndexRequest) -> dict:
    return index_dirty_memo_chunks(request).model_dump()


@app.post("/network/search")
def search_network_chunks_endpoint(
    request: NetworkSearchRequest,
    user_id: str = Depends(require_user_id),
) -> dict:
    return search_network_chunks(request.model_copy(update={"user_id": user_id})).model_dump()


@app.post("/schedule-inbox/run", dependencies=[Depends(require_admin_key)])
def run_schedule_inbox_endpoint(request: ScheduleInboxRunRequest) -> dict:
    return run_schedule_inbox_batch(request).model_dump()


@app.post("/maintenance/daily", dependencies=[Depends(require_admin_key)])
def run_daily_maintenance_endpoint(request: DailyMaintenanceRequest) -> dict:
    return run_daily_maintenance(request).model_dump()


@app.post("/maintenance/daily-all", dependencies=[Depends(require_admin_key)])
def run_daily_maintenance_for_all_endpoint(request: DailyMaintenanceAllRequest) -> dict:
    return run_daily_maintenance_for_all(request).model_dump()
