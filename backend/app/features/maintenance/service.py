import logging

from pydantic import BaseModel, Field

from app.core import constants
from app.db.profiles import (
    fetch_profile_ids,
    fetch_profile_ids_with_dirty_schedule_memos,
    fetch_profile_ids_with_dirty_topics,
)
from app.features.schedule.batch import (
    ScheduleInboxRunRequest,
    ScheduleInboxRunResponse,
    run_schedule_inbox_batch,
)
from app.features.topics.discovery import (
    TopicDiscoveryRequest,
    TopicDiscoveryResponse,
    run_topic_discovery,
)

logger = logging.getLogger(__name__)


class DailyMaintenanceRequest(BaseModel):
    user_id: str
    schedule_limit: int = Field(50, ge=1, le=200)
    force_topic: bool = False


class DailyMaintenanceResponse(BaseModel):
    status: str
    schedule: ScheduleInboxRunResponse
    topic: TopicDiscoveryResponse


class DailyMaintenanceAllRequest(BaseModel):
    schedule_limit: int = Field(50, ge=1, le=200)
    force_topic: bool = False


class DailyMaintenanceAllResponse(BaseModel):
    status: str
    processed_user_count: int
    results: list[DailyMaintenanceResponse]


class DirtyScheduleInboxScanUsersRequest(BaseModel):
    user_limit: int = Field(200, ge=1, le=1000)
    row_scan_limit: int = Field(5000, ge=100, le=50000)
    memo_limit_per_user: int = Field(50, ge=1, le=200)


class DirtyScheduleInboxScanUsersResponse(BaseModel):
    status: str
    selected_user_count: int
    processed_user_count: int
    processed_memo_count: int
    created_or_updated_count: int
    results: list[ScheduleInboxRunResponse]


class DirtyTopicDiscoveryUsersRequest(BaseModel):
    user_limit: int = Field(50, ge=1, le=500)
    row_scan_limit: int = Field(5000, ge=100, le=50000)
    force: bool = False


class DirtyTopicDiscoveryUsersResponse(BaseModel):
    status: str
    selected_user_count: int
    processed_user_count: int
    completed_user_count: int
    skipped_user_count: int
    results: list[TopicDiscoveryResponse]


def run_daily_maintenance(request: DailyMaintenanceRequest) -> DailyMaintenanceResponse:
    schedule = run_schedule_inbox_batch(
        ScheduleInboxRunRequest(user_id=request.user_id, limit=request.schedule_limit)
    )
    topic = run_topic_discovery(
        TopicDiscoveryRequest(
            user_id=request.user_id,
            force=request.force_topic,
            persist=True,
        )
    )

    return DailyMaintenanceResponse(
        status=(
            "partial"
            if schedule.status != "ok" or topic.status == "failed"
            else "ok"
        ),
        schedule=schedule,
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
                force_topic=request.force_topic,
            )
        )
        for user_id in fetch_profile_ids()
    ]

    return DailyMaintenanceAllResponse(
        status="partial" if any(result.status != "ok" for result in results) else "ok",
        processed_user_count=len(results),
        results=results,
    )


def scan_schedule_inbox_for_dirty_users(
    request: DirtyScheduleInboxScanUsersRequest,
) -> DirtyScheduleInboxScanUsersResponse:
    user_ids = fetch_profile_ids_with_dirty_schedule_memos(
        user_limit=request.user_limit,
        row_scan_limit=request.row_scan_limit,
    )
    results = [
        run_schedule_inbox_batch(
            ScheduleInboxRunRequest(
                user_id=user_id,
                limit=request.memo_limit_per_user,
            )
        )
        for user_id in user_ids
    ]

    return DirtyScheduleInboxScanUsersResponse(
        status="ok",
        selected_user_count=len(user_ids),
        processed_user_count=len(results),
        processed_memo_count=sum(result.processed_memo_count for result in results),
        created_or_updated_count=sum(
            result.created_or_updated_count for result in results
        ),
        results=results,
    )


def run_topic_discovery_for_dirty_users(
    request: DirtyTopicDiscoveryUsersRequest,
) -> DirtyTopicDiscoveryUsersResponse:
    user_ids = fetch_profile_ids_with_dirty_topics(
        user_limit=request.user_limit,
        row_scan_limit=request.row_scan_limit,
    )
    results: list[TopicDiscoveryResponse] = []

    for user_id in user_ids:
        try:
            results.append(
                run_topic_discovery(
                    TopicDiscoveryRequest(
                        user_id=user_id,
                        force=request.force,
                        persist=True,
                    )
                )
            )
        except Exception:
            logger.warning(
                "topic discovery failed for user %s",
                user_id,
                exc_info=True,
            )
            results.append(
                TopicDiscoveryResponse(
                    status="failed",
                    user_id=user_id,
                    memo_count=0,
                    cluster_count=0,
                    model=constants.EMBEDDING_MODEL_SIGNATURE,
                    clustering_method=None,
                    clusters=[],
                    message="Topic discovery failed. See backend logs.",
                )
            )

    return DirtyTopicDiscoveryUsersResponse(
        status="partial" if any(result.status == "failed" for result in results) else "ok",
        selected_user_count=len(user_ids),
        processed_user_count=len(results),
        completed_user_count=sum(1 for result in results if result.status == "ok"),
        skipped_user_count=sum(1 for result in results if result.status == "skipped"),
        results=results,
    )
