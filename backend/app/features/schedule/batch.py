from datetime import datetime, timezone

from pydantic import BaseModel, Field

from app.db import (
    content_hash_for_memo,
    fetch_memos_needing_schedule_scan,
    mark_memo_schedule_scan_failed,
    replace_schedule_inbox_if_current,
)
from app.features.schedule.parser import extract_schedule_candidates
from app.db.types import MemoRecord


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
            candidates = extract_schedule_candidates(
                memo.id,
                memo.content,
                base_time=memo_schedule_anchor_time(memo),
            )
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
            replaced = replace_schedule_inbox_if_current(
                request.user_id,
                memo.id,
                content_hash,
                memo.content,
                rows,
            )
            if replaced:
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


def memo_schedule_anchor_time(memo: MemoRecord) -> datetime | None:
    value = memo.content_updated_at or memo.created_at
    if not value:
        return None

    try:
        parsed = datetime.fromisoformat(value.replace("Z", "+00:00"))
    except ValueError:
        return None

    if parsed.tzinfo is None:
        return parsed.replace(tzinfo=timezone.utc)
    return parsed
