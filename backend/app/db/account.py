from app.db.client import get_supabase


def delete_user_account(user_id: str) -> None:
    """Delete one user's server-side data and Supabase Auth account.

    Most user-owned public tables cascade from ``profiles``. ``memos`` must be
    removed first because its delete trigger records a tombstone that still
    references the profile. ``inbox_sessions`` is backend-only and is not
    linked to ``profiles``.
    """
    client = get_supabase()

    client.table("inbox_sessions").delete().eq("user_id", user_id).execute()
    client.table("memos").delete().eq("user_id", user_id).execute()
    client.table("profiles").delete().eq("id", user_id).execute()
    client.auth.admin.delete_user(user_id)
