"""Runnable check for owner-scoped Inbox client-id deletion."""

import sys
from pathlib import Path
from types import SimpleNamespace

from fastapi.testclient import TestClient

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app.db import inbox
from app.main import app


class DeleteQuery:
    def __init__(self) -> None:
        self.filters: list[tuple[str, str]] = []

    def delete(self) -> "DeleteQuery":
        return self

    def eq(self, column: str, value: str) -> "DeleteQuery":
        self.filters.append((column, value))
        return self

    def execute(self) -> SimpleNamespace:
        return SimpleNamespace(data=[{"id": "server-row"}])


class Client:
    def __init__(self) -> None:
        self.query = DeleteQuery()

    def table(self, name: str) -> DeleteQuery:
        assert name == "inbox_sessions"
        return self.query


def test_delete_by_client_id_is_scoped_to_authenticated_owner() -> None:
    client = Client()
    original = inbox.get_supabase
    try:
        inbox.get_supabase = lambda: client
        assert inbox.delete_inbox_session_by_client_id("owner-a", "client-a") is True
        assert client.query.filters == [
            ("user_id", "owner-a"),
            ("client_id", "client-a"),
        ]
    finally:
        inbox.get_supabase = original


def test_cors_allows_inbox_delete() -> None:
    response = TestClient(app).options(
        "/inbox/sessions/by-client-id/client-a",
        headers={
            "Access-Control-Request-Method": "DELETE",
            "Origin": "https://subnota.com",
        },
    )

    assert response.status_code == 200
    assert response.headers["access-control-allow-methods"].find("DELETE") >= 0


if __name__ == "__main__":
    test_delete_by_client_id_is_scoped_to_authenticated_owner()
    print("ok")
