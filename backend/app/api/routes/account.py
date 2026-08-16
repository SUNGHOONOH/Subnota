from fastapi import APIRouter, Depends

from app.api.dependencies.auth import require_user_id
from app.db.account import delete_user_account

router = APIRouter()


@router.delete("/account")
def delete_account_endpoint(user_id: str = Depends(require_user_id)) -> dict[str, str]:
    delete_user_account(user_id)
    return {"status": "deleted"}
