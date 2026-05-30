from fastapi import BackgroundTasks, Depends, FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.auth import require_admin_key, require_user_id
from app.config import settings
from app.inbox import (
    InboxSessionAnalyzeRequest,
    InboxSessionCreateRequest,
    InboxSummaryIndexRequest,
    analyze_inbox_session,
    create_inbox_session,
    index_inbox_summary_embeddings,
    list_inbox_sessions,
)
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
    title="Subnota Backend",
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


@app.get("/inbox/sessions")
def list_inbox_sessions_endpoint(
    limit: int = 50,
    user_id: str = Depends(require_user_id),
) -> dict:
    return list_inbox_sessions(user_id, limit).model_dump()


@app.post("/inbox/sessions")
def create_inbox_session_endpoint(
    request: InboxSessionCreateRequest,
    background_tasks: BackgroundTasks,
    user_id: str = Depends(require_user_id),
) -> dict:
    row = create_inbox_session(user_id, request)
    session_id = str(row["id"])
    background_tasks.add_task(analyze_inbox_session, user_id, session_id)
    return {"item": row}


@app.post("/inbox/sessions/analyze")
def analyze_inbox_session_endpoint(
    request: InboxSessionAnalyzeRequest,
    user_id: str = Depends(require_user_id),
) -> dict:
    row = analyze_inbox_session(user_id, request.session_id)
    return {"item": row}


@app.post("/inbox/index-summaries", dependencies=[Depends(require_admin_key)])
def index_inbox_summary_embeddings_endpoint(request: InboxSummaryIndexRequest) -> dict:
    return index_inbox_summary_embeddings(request).model_dump()


@app.post("/schedule-inbox/run", dependencies=[Depends(require_admin_key)])
def run_schedule_inbox_endpoint(request: ScheduleInboxRunRequest) -> dict:
    return run_schedule_inbox_batch(request).model_dump()


@app.post("/maintenance/daily", dependencies=[Depends(require_admin_key)])
def run_daily_maintenance_endpoint(request: DailyMaintenanceRequest) -> dict:
    return run_daily_maintenance(request).model_dump()


@app.post("/maintenance/daily-all", dependencies=[Depends(require_admin_key)])
def run_daily_maintenance_for_all_endpoint(request: DailyMaintenanceAllRequest) -> dict:
    return run_daily_maintenance_for_all(request).model_dump()
