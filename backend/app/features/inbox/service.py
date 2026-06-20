from urllib.parse import urlparse

from app.core import constants
from app.db import (
    DatabaseRow,
    fetch_inbox_session,
    fetch_inbox_sessions,
    fetch_indexable_inbox_sessions,
    insert_inbox_session,
    update_inbox_session,
)
from app.features.inbox.indexing import replace_inbox_summary_embedding
from app.features.inbox.schemas import (
    InboxSessionCreateRequest,
    InboxSessionListResponse,
    InboxSummaryIndexRequest,
    InboxSummaryIndexResponse,
)
from app.features.inbox.summary import (
    build_metadata_summary_payload,
    metadata_to_patch,
    summarize_text,
    summarize_youtube_url,
    summary_payload_to_patch,
    summary_provider_for,
)
from app.features.inbox.utils import (
    canonicalize_url,
    clean_text,
    detect_source_type,
    extract_first_url,
    normalize_url,
    optional_str,
)
from app.features.inbox.webpage import fetch_oembed_or_page_metadata, fetch_page_metadata
from app.features.inbox.youtube import fetch_youtube_metadata


def create_inbox_session(user_id: str, request: InboxSessionCreateRequest) -> DatabaseRow:
    url = normalize_url(request.url) or extract_first_url(request.raw_shared_text)
    source_type = detect_source_type(url)
    parsed = urlparse(url) if url else None

    row = {
        "client_id": clean_text(request.client_id),
        "source_type": source_type,
        "original_url": url,
        "canonical_url": canonicalize_url(url),
        "domain": parsed.netloc.lower() if parsed else None,
        # macOS/web capture sends the page title via raw_shared_text; fall back to
        # it so the user-visible title survives even if metadata fetch later fails.
        "title": clean_text(request.title) or clean_text(request.raw_shared_text),
        "raw_shared_text": clean_text(request.raw_shared_text),
        "selected_text": clean_text(request.selected_text),
        "user_note": clean_text(request.user_note),
        "summary_status": "pending",
        "summary_basis": None,
        "summary_provider": None,
        "summary_one_liner": None,
        "summary_search_text": None,
        "summary_detail": None,
        "metadata": {},
    }
    return insert_inbox_session(user_id, row)


def list_inbox_sessions(user_id: str, limit: int = 50) -> InboxSessionListResponse:
    safe_limit = min(max(limit, 1), 100)
    return InboxSessionListResponse(items=fetch_inbox_sessions(user_id, safe_limit))


def index_inbox_summary_embeddings(
    request: InboxSummaryIndexRequest,
) -> InboxSummaryIndexResponse:
    rows = fetch_indexable_inbox_sessions(request.user_id, request.limit)
    indexed_count = 0
    for row in rows:
        replace_inbox_summary_embedding(request.user_id, row)
        indexed_count += 1

    return InboxSummaryIndexResponse(
        status="ok",
        user_id=request.user_id,
        indexed_count=indexed_count,
        model=constants.EMBEDDING_MODEL,
    )


def analyze_inbox_session(user_id: str, session_id: str) -> DatabaseRow | None:
    row = fetch_inbox_session(user_id, session_id)
    if not row:
        return None

    source_type = str(row.get("source_type") or "url")
    url = optional_str(row.get("canonical_url")) or optional_str(row.get("original_url"))

    try:
        if source_type == "youtube":
            patch = analyze_youtube(url)
        elif source_type == "instagram":
            patch = analyze_instagram(url)
        elif source_type == "url":
            patch = analyze_url(url)
        else:
            patch = {
                "summary_status": "unsupported",
                "summary_basis": "미지원 형식",
                "summary_provider": "subnota",
            }
    except Exception as exc:
        patch = {
            "summary_status": "failed",
            "summary_basis": "분석 실패",
            "summary_provider": "subnota",
            "metadata": {"error": str(exc)[:500]},
        }

    updated = update_inbox_session(user_id, session_id, patch)
    try:
        replace_inbox_summary_embedding(user_id, updated)
    except Exception:
        pass
    return updated


def analyze_youtube(url: str | None) -> DatabaseRow:
    metadata = fetch_youtube_metadata(url)
    summary = None
    summary_model = None
    if url:
        try:
            summary, summary_model = summarize_youtube_url(url)
        except Exception as exc:
            metadata = metadata | {"summary_error": str(exc)[:500]}

    if summary:
        if summary_model:
            metadata = metadata | {"summary_model": summary_model}
        return {
            **metadata_to_patch(metadata, keep_existing=True),
            **summary_payload_to_patch(summary),
            "summary_status": "ready",
            "summary_basis": "영상 기준",
            "summary_provider": summary_provider_for(summary_model, "youtube_url"),
            "metadata": metadata,
        }

    status = "partial" if metadata else "unsupported"
    fallback_summary = build_metadata_summary_payload(metadata)
    return {
        **metadata_to_patch(metadata, keep_existing=True),
        **summary_payload_to_patch(fallback_summary),
        "summary_status": status,
        "summary_basis": "제목/설명 기준" if metadata else "요약 불가",
        "summary_provider": metadata.get("provider", "youtube_metadata") if metadata else "subnota",
        "metadata": metadata,
    }


def analyze_url(url: str | None) -> DatabaseRow:
    page = fetch_page_metadata(url)
    extracted = optional_str(page.get("extracted_text"))
    summary = None
    summary_model = None
    if extracted:
        try:
            summary, summary_model = summarize_text(extracted, page)
        except Exception as exc:
            page = page | {"summary_error": str(exc)[:500]}

    if summary:
        if summary_model:
            page = page | {"summary_model": summary_model}
        return {
            **metadata_to_patch(page, keep_existing=True),
            **summary_payload_to_patch(summary),
            "summary_status": "ready",
            "summary_basis": "본문 기준",
            "summary_provider": summary_provider_for(summary_model, "text"),
            "metadata": page,
        }

    fallback_summary = build_metadata_summary_payload(page)
    return {
        **metadata_to_patch(page, keep_existing=True),
        **summary_payload_to_patch(fallback_summary),
        "summary_status": "partial" if page else "unsupported",
        "summary_basis": "제목/설명 기준" if page else "요약 불가",
        "summary_provider": page.get("provider", "open_graph") if page else "subnota",
        "metadata": page,
    }


def analyze_instagram(url: str | None) -> DatabaseRow:
    page = fetch_oembed_or_page_metadata(url)
    description = optional_str(page.get("description"))
    summary = None
    summary_model = None
    if description:
        try:
            summary, summary_model = summarize_text(description, page, min_chars=80)
        except Exception as exc:
            page = page | {"summary_error": str(exc)[:500]}

    if summary:
        if summary_model:
            page = page | {"summary_model": summary_model}
        return {
            **metadata_to_patch(page, keep_existing=True),
            **summary_payload_to_patch(summary),
            "summary_status": "ready",
            "summary_basis": "미리보기/캡션 기준",
            "summary_provider": summary_provider_for(summary_model, "text"),
            "metadata": page,
        }

    fallback_summary = build_metadata_summary_payload(page)
    return {
        **metadata_to_patch(page, keep_existing=True),
        **summary_payload_to_patch(fallback_summary),
        "summary_status": "partial" if page else "unsupported",
        "summary_basis": "미리보기 기준" if page else "요약 불가",
        "summary_provider": page.get("provider", "instagram_preview") if page else "subnota",
        "metadata": page,
    }
