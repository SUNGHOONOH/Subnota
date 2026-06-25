from dataclasses import dataclass
from typing import cast

from app.db.client import get_supabase
from app.db.types import DatabaseRow


@dataclass(frozen=True)
class RateLimitDecision:
    allowed: bool
    retry_after_seconds: int


def consume_network_rate_limit(user_id: str, request_limit: int) -> RateLimitDecision:
    response = get_supabase().rpc(
        "consume_network_rate_limit",
        {
            "p_request_limit": request_limit,
            "p_user_id": user_id,
            "p_window_seconds": 60,
        },
    ).execute()
    rows = cast(list[DatabaseRow], response.data or [])
    if not rows:
        raise RuntimeError("Network rate limit did not return a decision")
    row = rows[0]
    return RateLimitDecision(
        allowed=bool(row.get("allowed")),
        retry_after_seconds=max(1, int(row.get("retry_after_seconds") or 1)),
    )


def prune_chunk_embedding_cache(max_age_days: int, max_rows_per_user: int) -> int:
    response = get_supabase().rpc(
        "prune_chunk_embedding_cache",
        {
            "p_max_age_days": max_age_days,
            "p_max_rows_per_user": max_rows_per_user,
        },
    ).execute()
    return int(response.data or 0)
