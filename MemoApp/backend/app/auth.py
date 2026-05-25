from fastapi import Header, HTTPException

from app.config import settings
from app.db import get_supabase


def require_user_id(authorization: str | None = Header(default=None)) -> str:
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Missing Supabase bearer token")

    token = authorization.removeprefix("Bearer ").strip()
    if not token:
        raise HTTPException(status_code=401, detail="Missing Supabase bearer token")

    try:
        response = get_supabase().auth.get_user(token)
    except Exception as exc:
        raise HTTPException(status_code=401, detail="Invalid Supabase bearer token") from exc

    user = getattr(response, "user", None)
    user_id = getattr(user, "id", None)
    if not user_id:
        raise HTTPException(status_code=401, detail="Invalid Supabase bearer token")

    return str(user_id)


def require_admin_key(x_backend_admin_key: str | None = Header(default=None)) -> None:
    if not settings.backend_admin_key:
        return

    if x_backend_admin_key != settings.backend_admin_key:
        raise HTTPException(status_code=401, detail="Invalid backend admin key")
