from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException

from app.api.dependencies.auth import require_admin_key, require_user_id
from app.features.inbox.schemas import (
    InboxSessionAnalyzeRequest,
    InboxSessionCreateRequest,
    InboxSessionLikeRequest,
    InboxSummaryIndexRequest,
)
from app.features.inbox.service import (
    analyze_inbox_session,
    create_inbox_session,
    index_inbox_summary_embeddings,
    list_inbox_sessions,
    remove_inbox_session,
    set_inbox_session_liked,
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


@router.patch("/inbox/sessions/{session_id}/liked")
def set_inbox_session_liked_endpoint(
    session_id: str,
    request: InboxSessionLikeRequest,
    user_id: str = Depends(require_user_id),
) -> dict:
    try:
        row = set_inbox_session_liked(user_id, session_id, request.liked)
    except RuntimeError:
        # update_inbox_session raises when no row matched (unknown id or
        # another user's session) — surface it as a 404, not a 500.
        raise HTTPException(status_code=404, detail="Inbox session not found")
    return {"item": row}


@router.delete("/inbox/sessions/{session_id}")
def delete_inbox_session_endpoint(
    session_id: str,
    user_id: str = Depends(require_user_id),
) -> dict:
    # 멱등 삭제 — 이미 없는(또는 다른 사용자의) 세션이어도 성공으로 응답한다.
    deleted = remove_inbox_session(user_id, session_id)
    return {"status": "ok", "deleted": deleted}


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
