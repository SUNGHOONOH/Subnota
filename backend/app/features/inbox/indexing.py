from app.core import constants
from app.db.inbox import replace_inbox_session_embedding
from app.db.topics import mark_user_topics_dirty
from app.db.types import DatabaseRow
from app.db.utils import format_vector
from app.features.inbox.utils import optional_str
from app.features.topics.discovery import encode_texts
from app.shared.hashing import short_hash


def replace_inbox_summary_embedding(user_id: str, row: DatabaseRow) -> None:
    inbox_session_id = optional_str(row.get("id"))
    if not inbox_session_id:
        return

    summary = optional_str(row.get("summary_search_text")) or optional_str(row.get("summary"))
    status = optional_str(row.get("summary_status"))
    if not summary or status not in {"ready", "partial"}:
        replace_inbox_session_embedding(user_id, inbox_session_id, None)
        mark_user_topics_dirty(user_id)
        return

    embedding = encode_texts([summary])[0]
    replace_inbox_session_embedding(
        user_id,
        inbox_session_id,
        {
            "source_type": optional_str(row.get("source_type")) or "url",
            "source_label": source_label_for(optional_str(row.get("source_type"))),
            "title": optional_str(row.get("title")),
            "source_url": optional_str(row.get("canonical_url"))
            or optional_str(row.get("original_url")),
            "thumbnail_url": optional_str(row.get("thumbnail_url")),
            "chunk_text": summary,
            "summary_hash": short_hash(summary),
            "embedding": format_vector(embedding),
        },
    )
    mark_user_topics_dirty(user_id)


def source_label_for(source_type: str | None) -> str:
    if source_type == "youtube":
        return "YouTube"
    if source_type == "instagram":
        return "Instagram"
    if source_type == "url":
        return "웹페이지"
    if source_type == "image":
        return "이미지"
    return "수집함"
