from pydantic import BaseModel, Field

from app.db import fetch_profile_ids
from app.memo_indexing import MemoChunkIndexRequest, MemoChunkIndexResponse, index_dirty_memo_chunks
from app.schedule_batch import (
    ScheduleInboxRunRequest,
    ScheduleInboxRunResponse,
    run_schedule_inbox_batch,
)
from app.topic_discovery import TopicDiscoveryRequest, TopicDiscoveryResponse, run_topic_discovery


class DailyMaintenanceRequest(BaseModel):
    user_id: str
    schedule_limit: int = Field(50, ge=1, le=200)
    chunk_index_limit: int = Field(50, ge=1, le=200)
    force_topic: bool = False


class DailyMaintenanceResponse(BaseModel):
    status: str
    schedule: ScheduleInboxRunResponse
    chunk_index: MemoChunkIndexResponse
    topic: TopicDiscoveryResponse


class DailyMaintenanceAllRequest(BaseModel):
    schedule_limit: int = Field(50, ge=1, le=200)
    chunk_index_limit: int = Field(50, ge=1, le=200)
    force_topic: bool = False


class DailyMaintenanceAllResponse(BaseModel):
    status: str
    processed_user_count: int
    results: list[DailyMaintenanceResponse]


def run_daily_maintenance(request: DailyMaintenanceRequest) -> DailyMaintenanceResponse:
    schedule = run_schedule_inbox_batch(
        ScheduleInboxRunRequest(user_id=request.user_id, limit=request.schedule_limit)
    )
    chunk_index = index_dirty_memo_chunks(
        MemoChunkIndexRequest(user_id=request.user_id, limit=request.chunk_index_limit)
    )
    topic = run_topic_discovery(
        TopicDiscoveryRequest(
            user_id=request.user_id,
            force=request.force_topic,
            persist=True,
        )
    )

    return DailyMaintenanceResponse(
        status="ok",
        schedule=schedule,
        chunk_index=chunk_index,
        topic=topic,
    )


def run_daily_maintenance_for_all(
    request: DailyMaintenanceAllRequest,
) -> DailyMaintenanceAllResponse:
    results = [
        run_daily_maintenance(
            DailyMaintenanceRequest(
                user_id=user_id,
                schedule_limit=request.schedule_limit,
                chunk_index_limit=request.chunk_index_limit,
                force_topic=request.force_topic,
            )
        )
        for user_id in fetch_profile_ids()
    ]

    return DailyMaintenanceAllResponse(
        status="ok",
        processed_user_count=len(results),
        results=results,
    )
