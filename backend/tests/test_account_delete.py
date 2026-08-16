"""Account deletion endpoint checks."""

import sys
from pathlib import Path
from unittest.mock import Mock, patch

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app.api.routes.account import delete_account_endpoint
from app.db.account import delete_user_account


def test_delete_user_account_removes_memos_before_profile_and_auth_user() -> None:
    client = Mock()
    inbox_table = Mock()
    inbox_table.delete.return_value.eq.return_value.execute.return_value = None
    memos_table = Mock()
    memos_table.delete.return_value.eq.return_value.execute.return_value = None
    profiles_table = Mock()
    profiles_table.delete.return_value.eq.return_value.execute.return_value = None
    client.table.side_effect = [inbox_table, memos_table, profiles_table]

    with patch("app.db.account.get_supabase", return_value=client):
        delete_user_account("user-1")

    assert client.table.call_args_list[0].args == ("inbox_sessions",)
    assert client.table.call_args_list[1].args == ("memos",)
    assert client.table.call_args_list[2].args == ("profiles",)
    memos_table.delete.return_value.eq.assert_called_once_with("user_id", "user-1")
    client.auth.admin.delete_user.assert_called_once_with("user-1")


def test_delete_account_endpoint_returns_deleted_status() -> None:
    with patch("app.api.routes.account.delete_user_account") as delete_account:
        assert delete_account_endpoint("user-1") == {"status": "deleted"}
        delete_account.assert_called_once_with("user-1")


if __name__ == "__main__":
    test_delete_user_account_removes_backend_inbox_before_auth_user()
    test_delete_account_endpoint_returns_deleted_status()
    print("ok")
