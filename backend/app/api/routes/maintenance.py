from fastapi import APIRouter, Depends

from app.api.dependencies.auth import require_admin_key
from app.features.maintenance.service import (
    DailyMaintenanceAllRequest,
    DailyMaintenanceRequest,
    DirtyScheduleInboxScanUsersRequest,
    DirtyTopicDiscoveryUsersRequest,
    run_daily_maintenance,
    run_daily_maintenance_for_all,
    run_topic_discovery_for_dirty_users,
    scan_schedule_inbox_for_dirty_users,
)

router = APIRouter()


@router.post("/maintenance/daily", dependencies=[Depends(require_admin_key)])
def run_daily_maintenance_endpoint(request: DailyMaintenanceRequest) -> dict:
    return run_daily_maintenance(request).model_dump()


@router.post("/maintenance/daily-all", dependencies=[Depends(require_admin_key)])
def run_daily_maintenance_for_all_endpoint(request: DailyMaintenanceAllRequest) -> dict:
    return run_daily_maintenance_for_all(request).model_dump()


@router.post(
    "/maintenance/schedule-inbox/scan-dirty-users",
    dependencies=[Depends(require_admin_key)],
)
def scan_schedule_inbox_for_dirty_users_endpoint(
    request: DirtyScheduleInboxScanUsersRequest,
) -> dict:
    return scan_schedule_inbox_for_dirty_users(request).model_dump()


@router.post(
    "/maintenance/topic-discovery/run-dirty-users",
    dependencies=[Depends(require_admin_key)],
)
def run_topic_discovery_for_dirty_users_endpoint(
    request: DirtyTopicDiscoveryUsersRequest,
) -> dict:
    return run_topic_discovery_for_dirty_users(request).model_dump()
