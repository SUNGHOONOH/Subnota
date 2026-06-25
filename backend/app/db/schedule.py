from app.db.client import get_supabase
from app.db.types import DatabaseRow


def replace_schedule_inbox_if_current(
    user_id: str,
    memo_id: str,
    content_hash: str,
    expected_content: str,
    items: list[DatabaseRow],
) -> bool:
    """Atomically replace a memo's pending schedule suggestions and mark it
    scanned, but only while the memo's content still matches what was scanned.

    Wraps the replace_schedule_inbox_if_current RPC (one transaction). Returns
    False when the memo changed mid-scan, leaving it dirty for the next run —
    crucially without clobbering content_hash, unlike the old two-step flow.
    """
    client = get_supabase()
    response = client.rpc(
        "replace_schedule_inbox_if_current",
        {
            "p_content_hash": content_hash,
            "p_expected_content": expected_content,
            "p_items": items,
            "p_memo_id": memo_id,
            "p_user_id": user_id,
        },
    ).execute()
    return bool(response.data)
