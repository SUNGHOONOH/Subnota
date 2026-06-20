from fastapi import APIRouter, Depends

from app.api.dependencies.auth import require_admin_key
from app.features.schedule.batch import ScheduleInboxRunRequest, run_schedule_inbox_batch

router = APIRouter()


@router.post("/schedule-inbox/run", dependencies=[Depends(require_admin_key)])
def run_schedule_inbox_endpoint(request: ScheduleInboxRunRequest) -> dict:
    return run_schedule_inbox_batch(request).model_dump()
