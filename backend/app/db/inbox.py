from datetime import datetime, timezone
from typing import cast

from app.core import constants
from app.db.client import get_supabase
from app.db.types import DatabaseRow
from app.db.utils import optional_str


def insert_inbox_session(user_id: str, row: DatabaseRow) -> DatabaseRow:
    client = get_supabase()
    client_id = optional_str(row.get("client_id"))
    if client_id:
        existing = (
            client.table("inbox_sessions")
            .select("*")
            .eq("user_id", user_id)
            .eq("client_id", client_id)
            .limit(1)
            .execute()
        )
        existing_rows = cast(list[DatabaseRow], existing.data or [])
        if existing_rows:
            return existing_rows[0]

    canonical_url = optional_str(row.get("canonical_url"))
    if canonical_url:
        existing = (
            client.table("inbox_sessions")
            .select("*")
            .eq("user_id", user_id)
            .eq("canonical_url", canonical_url)
            .order("updated_at", desc=True)
            .limit(1)
            .execute()
        )
        existing_rows = cast(list[DatabaseRow], existing.data or [])
        if existing_rows:
            existing_row = existing_rows[0]
            patch: DatabaseRow = {
                "updated_at": datetime.now(timezone.utc).isoformat(),
            }
            for key in ("client_id", "raw_shared_text", "selected_text", "user_note"):
                value = optional_str(row.get(key))
                if value:
                    patch[key] = value
            if optional_str(row.get("title")) and not optional_str(existing_row.get("title")):
                patch["title"] = row["title"]
            return update_inbox_session(user_id, str(existing_row["id"]), patch)

    response = (
        client.table("inbox_sessions")
        # user_id last so a caller-supplied row can never override the
        # authenticated user.
        .insert({**row, "user_id": user_id})
        .execute()
    )
    rows = cast(list[DatabaseRow], response.data or [])
    if not rows:
        raise RuntimeError("Failed to insert inbox session")
    return rows[0]


def fetch_inbox_session(user_id: str, session_id: str) -> DatabaseRow | None:
    client = get_supabase()
    response = (
        client.table("inbox_sessions")
        .select("*")
        .eq("user_id", user_id)
        .eq("id", session_id)
        .limit(1)
        .execute()
    )
    rows = cast(list[DatabaseRow], response.data or [])
    return rows[0] if rows else None


def update_inbox_session(user_id: str, session_id: str, patch: DatabaseRow) -> DatabaseRow:
    client = get_supabase()
    response = (
        client.table("inbox_sessions")
        .update(patch)
        .eq("user_id", user_id)
        .eq("id", session_id)
        .execute()
    )
    rows = cast(list[DatabaseRow], response.data or [])
    if not rows:
        raise RuntimeError("Failed to update inbox session")
    return rows[0]


def replace_inbox_session_embedding(
    user_id: str,
    inbox_session_id: str,
    row: DatabaseRow | None,
) -> None:
    client = get_supabase()
    client.table("inbox_session_embeddings").delete().eq(
        "inbox_session_id", inbox_session_id
    ).execute()

    if not row:
        return

    client.table("inbox_session_embeddings").insert(
        {
            # Spread the caller row first, then pin the authoritative columns so
            # they can never be overridden by the row payload.
            **row,
            "user_id": user_id,
            "inbox_session_id": inbox_session_id,
            "embedding_model": constants.EMBEDDING_MODEL,
        }
    ).execute()


def fetch_inbox_sessions(user_id: str, limit: int = 50) -> list[DatabaseRow]:
    client = get_supabase()
    response = (
        client.table("inbox_sessions")
        .select("*")
        .eq("user_id", user_id)
        .order("updated_at", desc=True)
        .limit(limit)
        .execute()
    )
    return cast(list[DatabaseRow], response.data or [])


def fetch_indexable_inbox_sessions(user_id: str, limit: int = 100) -> list[DatabaseRow]:
    client = get_supabase()
    response = (
        client.table("inbox_sessions")
        .select("*")
        .eq("user_id", user_id)
        .in_("summary_status", ["ready", "partial"])
        .order("updated_at", desc=True)
        .limit(limit)
        .execute()
    )
    rows = cast(list[DatabaseRow], response.data or [])
    return [row for row in rows if optional_str(row.get("summary"))]
