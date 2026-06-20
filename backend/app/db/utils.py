from datetime import datetime, timezone
from typing import Any

from app.db.types import MemoRecord
from app.shared.hashing import hash_text


def content_hash_for_memo(memo: MemoRecord) -> str:
    return memo.content_hash or hash_text(memo.content)


def format_vector(vector: Any) -> str:
    if isinstance(vector, str):
        return vector

    try:
        values = vector.tolist()
    except AttributeError:
        values = vector

    if values and isinstance(values[0], list):
        values = values[0]

    return "[" + ",".join(str(float(value)) for value in values) + "]"


def optional_str(value: Any) -> str | None:
    if value is None:
        return None
    return str(value)


def utc_now() -> str:
    return datetime.now(timezone.utc).isoformat()
