from fastapi import APIRouter, BackgroundTasks, Depends

from app.api.dependencies.auth import require_admin_key, require_user_id
from app.features.inbox.schemas import (
    InboxSessionAnalyzeRequest,
    InboxSessionCreateRequest,
    InboxSummaryIndexRequest,
)
from app.features.inbox.service import (
    analyze_inbox_session,
    create_inbox_session,
    index_inbox_summary_embeddings,
    list_inbox_sessions,
)

router = APIRouter()


@router.get("/inbox/sessions")
def list_inbox_sessions_endpoint(
    limit: int = 50,
    user_id: str = Depends(require_user_id),
) -> dict:
    return list_inbox_sessions(user_id, limit).model_dump()


@router.post("/inbox/sessions")
def create_inbox_session_endpoint(
    request: InboxSessionCreateRequest,
    background_tasks: BackgroundTasks,
    user_id: str = Depends(require_user_id),
) -> dict:
    row = create_inbox_session(user_id, request)
    session_id = str(row["id"])
    background_tasks.add_task(analyze_inbox_session, user_id, session_id)
    return {"item": row}


@router.post("/inbox/sessions/analyze")
def analyze_inbox_session_endpoint(
    request: InboxSessionAnalyzeRequest,
    user_id: str = Depends(require_user_id),
) -> dict:
    row = analyze_inbox_session(user_id, request.session_id)
    return {"item": row}


@router.post("/inbox/index-summaries", dependencies=[Depends(require_admin_key)])
def index_inbox_summary_embeddings_endpoint(request: InboxSummaryIndexRequest) -> dict:
    return index_inbox_summary_embeddings(request).model_dump()
