from app.db.client import get_supabase
from app.db.embeddings import (
    claim_memo_chunk_index_lease,
    fetch_cached_embedding,
    fetch_cached_embeddings,
    fetch_memo_chunk_neighbors,
    fetch_topic_memo_embeddings,
    rebuild_user_memo_chunk_edges,
    release_memo_chunk_index_lease,
    search_similar_chunks,
    search_similar_inbox_embeddings,
    upsert_cached_embedding,
    upsert_cached_embeddings,
    upsert_topic_memo_embeddings,
)
from app.db.inbox import (
    fetch_inbox_session,
    fetch_inbox_sessions,
    fetch_indexable_inbox_sessions,
    insert_inbox_session,
    replace_inbox_session_embedding,
    update_inbox_session,
)
from app.db.memos import (
    fetch_memo_chunk_refs,
    fetch_memos_needing_chunk_index,
    fetch_memos_needing_schedule_scan,
    fetch_user_memos,
    mark_memo_schedule_scan_failed,
    replace_memo_chunks,
)
from app.db.profiles import (
    fetch_profile_ids,
    fetch_profile_ids_with_dirty_chunk_memos,
    fetch_profile_ids_with_dirty_schedule_memos,
    fetch_profile_ids_with_dirty_topics,
)
from app.db.schedule import replace_schedule_inbox_if_current
from app.db.topics import has_topic_dirty_memos, mark_topic_memos_clean, replace_topic_clusters
from app.db.types import DatabaseRow, MemoRecord
from app.db.utils import content_hash_for_memo, format_vector, optional_str, utc_now

__all__ = [
    "DatabaseRow",
    "MemoRecord",
    "claim_memo_chunk_index_lease",
    "content_hash_for_memo",
    "fetch_cached_embedding",
    "fetch_cached_embeddings",
    "fetch_memo_chunk_neighbors",
    "fetch_memo_chunk_refs",
    "fetch_topic_memo_embeddings",
    "fetch_inbox_session",
    "fetch_inbox_sessions",
    "fetch_indexable_inbox_sessions",
    "fetch_memos_needing_chunk_index",
    "fetch_memos_needing_schedule_scan",
    "fetch_profile_ids",
    "fetch_profile_ids_with_dirty_chunk_memos",
    "fetch_profile_ids_with_dirty_schedule_memos",
    "fetch_profile_ids_with_dirty_topics",
    "fetch_user_memos",
    "format_vector",
    "get_supabase",
    "has_topic_dirty_memos",
    "insert_inbox_session",
    "mark_memo_schedule_scan_failed",
    "mark_topic_memos_clean",
    "optional_str",
    "rebuild_user_memo_chunk_edges",
    "release_memo_chunk_index_lease",
    "replace_inbox_session_embedding",
    "replace_memo_chunks",
    "replace_topic_clusters",
    "search_similar_chunks",
    "search_similar_inbox_embeddings",
    "replace_schedule_inbox_if_current",
    "upsert_cached_embedding",
    "upsert_cached_embeddings",
    "upsert_topic_memo_embeddings",
    "update_inbox_session",
    "utc_now",
]
