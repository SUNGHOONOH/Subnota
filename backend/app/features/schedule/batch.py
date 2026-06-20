from pydantic import BaseModel, Field

from app.db import (
    content_hash_for_memo,
    fetch_memos_needing_schedule_scan,
    mark_memo_schedule_scan_failed,
    mark_memo_schedule_scanned,
    upsert_schedule_inbox_items,
)
from app.features.schedule.parser import extract_schedule_candidates


class ScheduleInboxRunRequest(BaseModel):
    user_id: str
    limit: int = Field(50, ge=1, le=200)


class ScheduleInboxRunResponse(BaseModel):
    status: str
    user_id: str
    processed_memo_count: int
    created_or_updated_count: int


def run_schedule_inbox_batch(
    request: ScheduleInboxRunRequest,
) -> ScheduleInboxRunResponse:
    memos = fetch_memos_needing_schedule_scan(request.user_id, request.limit)
    suggestion_count = 0

    for memo in memos:
        content_hash = content_hash_for_memo(memo)
        try:
            candidates = extract_schedule_candidates(memo.id, memo.content)
            rows = [
                {
                    "source_key": candidate.source_key,
                    "source_text_hash": candidate.source_text_hash,
                    "source_text": candidate.source_text,
                    "source_start": candidate.source_start,
                    "source_end": candidate.source_end,
                    "title": candidate.title,
                    "scheduled_at": candidate.scheduled_at.isoformat(),
                    "time_text": candidate.time_text,
                    "all_day": candidate.all_day,
                    "confidence": candidate.confidence,
                }
                for candidate in candidates
            ]
            upsert_schedule_inbox_items(request.user_id, memo.id, rows)
            mark_memo_schedule_scanned(memo.id, content_hash)
            suggestion_count += len(rows)
        except Exception:
            mark_memo_schedule_scan_failed(memo.id)
            raise

    return ScheduleInboxRunResponse(
        status="ok",
        user_id=request.user_id,
        processed_memo_count=len(memos),
        created_or_updated_count=suggestion_count,
    )
