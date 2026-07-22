"""Runnable check for admin auth. `python tests/test_admin_auth.py`."""

import sys
from pathlib import Path

from fastapi import HTTPException

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app.api.dependencies import auth


def raises_status(status_code: int, fn) -> None:
    try:
        fn()
    except HTTPException as exc:
        assert exc.status_code == status_code
        return
    raise AssertionError(f"expected HTTPException {status_code}")


def test_admin_key_fails_closed_without_key() -> None:
    original = (
        auth.settings.backend_admin_key,
        auth.settings.backend_env,
        auth.settings.allow_local_admin_bypass,
    )
    try:
        auth.settings.backend_admin_key = ""
        auth.settings.backend_env = "development"
        auth.settings.allow_local_admin_bypass = False
        raises_status(503, auth.require_admin_key)

        auth.settings.allow_local_admin_bypass = True
        auth.require_admin_key()
    finally:
        (
            auth.settings.backend_admin_key,
            auth.settings.backend_env,
            auth.settings.allow_local_admin_bypass,
        ) = original


def test_admin_key_requires_matching_header() -> None:
    original = auth.settings.backend_admin_key
    try:
        auth.settings.backend_admin_key = "secret"
        raises_status(401, auth.require_admin_key)
        raises_status(401, lambda: auth.require_admin_key("wrong"))
        auth.require_admin_key("secret")
    finally:
        auth.settings.backend_admin_key = original


if __name__ == "__main__":
    test_admin_key_fails_closed_without_key()
    test_admin_key_requires_matching_header()
    print("ok")
