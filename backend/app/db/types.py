from dataclasses import dataclass
from typing import Any


@dataclass
class MemoRecord:
    id: str
    content: str
    content_hash: str | None
    indexed_content_hash: str | None
    schedule_scanned_hash: str | None
    topic_dirty: bool
    created_at: str | None
    updated_at: str | None
    content_updated_at: str | None

DatabaseRow = dict[str, Any]
