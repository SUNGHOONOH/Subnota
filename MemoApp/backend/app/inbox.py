from __future__ import annotations

import json
import re
from typing import Any
from urllib.parse import parse_qs, urlparse

import httpx
from bs4 import BeautifulSoup
from pydantic import BaseModel, Field

from app import constants
from app.config import settings
from app.db import (
    DatabaseRow,
    fetch_inbox_session,
    fetch_inbox_sessions,
    fetch_indexable_inbox_sessions,
    format_vector,
    insert_inbox_session,
    replace_inbox_session_embedding,
    update_inbox_session,
)
from app.hashing import short_hash
from app.topic_discovery import encode_texts

try:
    from google import genai
    from google.genai import types as genai_types
except Exception:  # pragma: no cover - optional runtime dependency
    genai = None
    genai_types = None

try:
    from playwright.sync_api import sync_playwright
except Exception:  # pragma: no cover - optional runtime dependency
    sync_playwright = None


USER_AGENT = (
    "Mozilla/5.0 (compatible; SubnotaBot/0.1; +https://subnota.com)"
)
MAX_EXTRACTED_TEXT_CHARS = 12000
MIN_USEFUL_EXTRACTED_TEXT_CHARS = 500
PLAYWRIGHT_NAVIGATION_TIMEOUT_MS = 15000
PLAYWRIGHT_NETWORK_IDLE_TIMEOUT_MS = 5000
PLAYWRIGHT_RENDER_WAIT_MS = 700
PLAYWRIGHT_SCROLL_STEPS = 2
IMPORTANT_JSON_TEXT_KEYS = {
    "articleBody",
    "caption",
    "description",
    "headline",
    "name",
    "text",
    "transcript",
}
SUMMARY_PROMPT_KO = """
아래 콘텐츠를 한국어로 3단계 요약하세요.

응답은 JSON 객체만 작성하세요. 마크다운 코드블록, 설명 문장, 주석은 금지합니다.

필드:
- one_liner: 카드 UI용 1~2문장. 100자 내외. 이 콘텐츠가 사용자에게 주는 도움/인사이트가 바로 보여야 합니다.
- search_summary: 임베딩/추천 검색용 400~600자 단락 1개. 키워드 밀도를 높이고 원문 핵심 주제, 도구명, 수치, 사례, 맥락을 포함합니다.
- detail_summary: 상세 보기용 6~8개 불릿. 전체 800자 내외. 각 불릿은 "- [주제] 세부 설명" 형식입니다.

규칙:
- 제공된 내용에 없는 사실은 추측하지 않습니다.
- 광고 문구처럼 쓰지 말고, 나중에 다시 읽기 좋은 메모처럼 작성합니다.
- search_summary는 줄바꿈 없는 단락으로 작성합니다.
- detail_summary는 줄바꿈으로 불릿을 구분합니다.
""".strip()


class InboxSessionCreateRequest(BaseModel):
    url: str | None = Field(default=None, max_length=4096)
    title: str | None = Field(default=None, max_length=500)
    raw_shared_text: str | None = Field(default=None, max_length=8000)
    selected_text: str | None = Field(default=None, max_length=8000)
    user_note: str | None = Field(default=None, max_length=4000)


class InboxSessionAnalyzeRequest(BaseModel):
    session_id: str


class InboxSessionListResponse(BaseModel):
    items: list[dict[str, Any]]


class InboxSummaryIndexRequest(BaseModel):
    user_id: str
    limit: int = Field(100, ge=1, le=500)


class InboxSummaryIndexResponse(BaseModel):
    status: str
    user_id: str
    indexed_count: int
    model: str


def create_inbox_session(user_id: str, request: InboxSessionCreateRequest) -> DatabaseRow:
    url = normalize_url(request.url) or extract_first_url(request.raw_shared_text)
    source_type = detect_source_type(url)
    parsed = urlparse(url) if url else None

    row = {
        "source_type": source_type,
        "original_url": url,
        "canonical_url": canonicalize_url(url),
        "domain": parsed.netloc.lower() if parsed else None,
        "title": clean_text(request.title),
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


def fetch_youtube_metadata(url: str | None) -> DatabaseRow:
    if not url:
        return {}

    video_id = extract_youtube_video_id(url)
    if settings.youtube_api_key and video_id:
        with httpx.Client(timeout=10, headers={"User-Agent": USER_AGENT}) as client:
            response = client.get(
                "https://www.googleapis.com/youtube/v3/videos",
                params={
                    "id": video_id,
                    "key": settings.youtube_api_key,
                    "part": "snippet,contentDetails",
                },
            )
            response.raise_for_status()
            items = response.json().get("items") or []
            if items:
                snippet = items[0].get("snippet") or {}
                thumbnails = snippet.get("thumbnails") or {}
                thumbnail = (
                    thumbnails.get("maxres")
                    or thumbnails.get("standard")
                    or thumbnails.get("high")
                    or thumbnails.get("medium")
                    or thumbnails.get("default")
                    or {}
                )
                return {
                    "provider": "youtube_data_api",
                    "video_id": video_id,
                    "title": snippet.get("title"),
                    "description": snippet.get("description"),
                    "thumbnail_url": thumbnail.get("url"),
                    "channel_title": snippet.get("channelTitle"),
                    "published_at": snippet.get("publishedAt"),
                    "duration": (items[0].get("contentDetails") or {}).get("duration"),
                }

    return fetch_youtube_oembed(url, video_id)


def fetch_youtube_oembed(url: str, video_id: str | None) -> DatabaseRow:
    try:
        with httpx.Client(timeout=10, headers={"User-Agent": USER_AGENT}) as client:
            response = client.get("https://www.youtube.com/oembed", params={"url": url, "format": "json"})
            response.raise_for_status()
            data = response.json()
            return {
                "provider": "youtube_oembed",
                "video_id": video_id,
                "title": data.get("title"),
                "description": None,
                "thumbnail_url": data.get("thumbnail_url"),
                "author_name": data.get("author_name"),
                "author_url": data.get("author_url"),
            }
    except Exception:
        return {"provider": "youtube_url", "video_id": video_id}


def fetch_page_metadata(url: str | None) -> DatabaseRow:
    if not url:
        return {}

    with httpx.Client(
        follow_redirects=True,
        timeout=12,
        headers={"User-Agent": USER_AGENT, "Accept": "text/html,application/xhtml+xml"},
    ) as client:
        response = client.get(url)
        response.raise_for_status()
        html = response.text

    metadata = extract_page_metadata_from_html(html, url, "static_html")
    if int(metadata.get("content_length") or 0) >= MIN_USEFUL_EXTRACTED_TEXT_CHARS:
        return metadata

    rendered_html = fetch_rendered_page_html(url)
    if not rendered_html:
        return metadata

    rendered_metadata = extract_page_metadata_from_html(rendered_html, url, "playwright")
    if int(rendered_metadata.get("content_length") or 0) > int(metadata.get("content_length") or 0):
        return rendered_metadata

    return metadata


def extract_page_metadata_from_html(
    html: str,
    url: str,
    default_extraction_method: str,
) -> DatabaseRow:
    soup = BeautifulSoup(html, "html.parser")
    embedded_text = extract_embedded_json_text(soup)
    for tag in soup(["script", "style", "noscript", "svg"]):
        tag.decompose()

    title = meta_content(soup, "og:title") or page_title(soup)
    description = (
        meta_content(soup, "og:description")
        or meta_name_content(soup, "description")
        or meta_content(soup, "twitter:description")
    )
    thumbnail = meta_content(soup, "og:image") or meta_content(soup, "twitter:image")
    canonical = canonical_href(soup) or url
    article_text = extract_article_text(soup)
    extraction_method = default_extraction_method
    extracted = article_text
    if (
        len(article_text) < MIN_USEFUL_EXTRACTED_TEXT_CHARS
        and len(embedded_text) > len(article_text)
    ):
        extracted = embedded_text
        extraction_method = (
            "playwright_embedded_json"
            if default_extraction_method == "playwright"
            else "embedded_json"
        )

    return {
        "provider": "html_fetch",
        "title": title,
        "description": description,
        "thumbnail_url": thumbnail,
        "canonical_url": canonical,
        "extracted_text": extracted[:MAX_EXTRACTED_TEXT_CHARS],
        "content_length": len(extracted),
        "extraction_method": extraction_method,
        "has_embedded_json": bool(embedded_text),
    }


def fetch_rendered_page_html(url: str) -> str | None:
    if sync_playwright is None:
        return None

    browser = None
    playwright = None
    try:
        playwright = sync_playwright().start()
        browser = playwright.chromium.launch(
            headless=True,
            args=["--disable-dev-shm-usage", "--no-sandbox"],
        )
        page = browser.new_page(
            user_agent=USER_AGENT,
            viewport={"width": 1280, "height": 900},
        )
        page.goto(
            url,
            wait_until="domcontentloaded",
            timeout=PLAYWRIGHT_NAVIGATION_TIMEOUT_MS,
        )
        try:
            page.wait_for_load_state("networkidle", timeout=PLAYWRIGHT_NETWORK_IDLE_TIMEOUT_MS)
        except Exception:
            pass

        for _ in range(PLAYWRIGHT_SCROLL_STEPS):
            page.mouse.wheel(0, 1800)
            page.wait_for_timeout(PLAYWRIGHT_RENDER_WAIT_MS)

        return page.content()
    except Exception:
        return None
    finally:
        if browser is not None:
            browser.close()
        if playwright is not None:
            playwright.stop()


def fetch_oembed_or_page_metadata(url: str | None) -> DatabaseRow:
    if not url:
        return {}

    try:
        return fetch_page_metadata(url) | {"provider": "instagram_open_graph"}
    except Exception as exc:
        return {"provider": "instagram_preview", "error": str(exc)[:500]}


def summarize_youtube_url(url: str | None) -> tuple[DatabaseRow | None, str | None]:
    if not settings.gemini_api_key or not url or genai is None or genai_types is None:
        return None, None

    client = genai.Client(api_key=settings.gemini_api_key)
    summary, model = generate_summary_content(
        client=client,
        contents=genai_types.Content(
            parts=[
                genai_types.Part(
                    file_data=genai_types.FileData(file_uri=url)
                ),
                genai_types.Part(text=SUMMARY_PROMPT_KO),
            ]
        ),
        models=constants.URL_CONTENT_SUMMARY_MODELS,
    )
    return parse_summary_payload(summary), model


def summarize_text(
    text: str | None,
    metadata: DatabaseRow,
    min_chars: int = 240,
) -> tuple[DatabaseRow | None, str | None]:
    if not settings.gemini_api_key or not text or genai is None:
        return None, None

    trimmed = text.strip()
    if len(trimmed) < min_chars:
        return None, None

    title = optional_str(metadata.get("title")) or "제목 없음"
    prompt = f"{SUMMARY_PROMPT_KO}\n\n제목: {title}\n\n본문:\n{trimmed[:MAX_EXTRACTED_TEXT_CHARS]}"
    client = genai.Client(api_key=settings.gemini_api_key)
    summary, model = generate_summary_content(
        client=client,
        contents=prompt,
        models=constants.TEXT_SUMMARY_MODELS,
    )
    return parse_summary_payload(summary), model


def generate_summary_content(
    client: Any,
    contents: Any,
    models: tuple[str, ...],
) -> tuple[str | None, str | None]:
    last_error: Exception | None = None
    for model in models:
        try:
            response = client.models.generate_content(model=model, contents=contents)
        except Exception as exc:
            last_error = exc
            continue

        text = optional_str(getattr(response, "text", None))
        if text:
            return text, model

    if last_error:
        raise last_error
    return None, None


def summary_provider_for(model: str | None, kind: str) -> str:
    provider = "gemma" if model == constants.GEMMA_FALLBACK_MODEL else "gemini"
    return f"{provider}_{kind}"


def parse_summary_payload(value: str | None) -> DatabaseRow | None:
    text = optional_str(value)
    if not text:
        return None

    json_text = text.strip().removeprefix("```json").removeprefix("```").strip()
    json_text = json_text.removesuffix("```").strip()
    try:
        payload = json.loads(json_text)
    except json.JSONDecodeError:
        return fallback_summary_payload(text)

    if not isinstance(payload, dict):
        return fallback_summary_payload(text)

    one_liner = limit_chars(clean_text(payload.get("one_liner")), 140)
    search_summary = limit_chars(
        clean_text(payload.get("search_summary")),
        900,
    )
    detail_summary = clean_summary(optional_str(payload.get("detail_summary")))
    if not one_liner and not search_summary and not detail_summary:
        return fallback_summary_payload(text)

    if not one_liner:
        one_liner = limit_chars(search_summary or detail_summary, 140)
    if not search_summary:
        search_summary = clean_text(detail_summary or one_liner)
    if not detail_summary:
        detail_summary = f"- {one_liner}" if one_liner else None

    return {
        "one_liner": one_liner,
        "search_summary": search_summary,
        "detail_summary": detail_summary,
    }


def fallback_summary_payload(value: str | None) -> DatabaseRow | None:
    text = optional_str(value)
    if not text:
        return None

    cleaned = clean_summary(text)
    one_liner = limit_chars(clean_text(cleaned), 140)
    return {
        "one_liner": one_liner,
        "search_summary": clean_text(cleaned),
        "detail_summary": cleaned,
    }


def summary_payload_to_patch(payload: DatabaseRow | None) -> DatabaseRow:
    one_liner = optional_str(payload.get("one_liner")) if payload else None
    search_summary = optional_str(payload.get("search_summary")) if payload else None
    detail_summary = optional_str(payload.get("detail_summary")) if payload else None
    return {
        "summary": one_liner,
        "summary_one_liner": one_liner,
        "summary_search_text": search_summary,
        "summary_detail": detail_summary,
    }


def replace_inbox_summary_embedding(user_id: str, row: DatabaseRow) -> None:
    inbox_session_id = optional_str(row.get("id"))
    if not inbox_session_id:
        return

    summary = optional_str(row.get("summary_search_text")) or optional_str(row.get("summary"))
    status = optional_str(row.get("summary_status"))
    if not summary or status not in {"ready", "partial"}:
        replace_inbox_session_embedding(user_id, inbox_session_id, None)
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


def metadata_to_patch(metadata: DatabaseRow, keep_existing: bool = False) -> DatabaseRow:
    patch: DatabaseRow = {}
    for source, target in [
        ("title", "title"),
        ("description", "description"),
        ("thumbnail_url", "thumbnail_url"),
        ("canonical_url", "canonical_url"),
    ]:
        value = optional_str(metadata.get(source))
        if value:
            patch[target] = value
        elif keep_existing:
            continue
    return patch


def build_metadata_summary_payload(metadata: DatabaseRow) -> DatabaseRow | None:
    title = optional_str(metadata.get("title"))
    description = optional_str(metadata.get("description"))
    lines: list[str] = []
    if title:
        lines.append(f"- [제목] {title}")
    if description:
        lines.append(f"- [설명] {description[:500].strip()}")
    detail = "\n".join(lines) if lines else None

    if title and description:
        return {
            "one_liner": limit_chars(f"{title}: {description}", 140),
            "search_summary": clean_text(f"{title}. {description}"),
            "detail_summary": detail,
        }
    if title:
        return {
            "one_liner": limit_chars(title, 140),
            "search_summary": title,
            "detail_summary": f"- [제목] {title}",
        }
    if description:
        return {
            "one_liner": limit_chars(description, 140),
            "search_summary": clean_text(description),
            "detail_summary": f"- [설명] {description[:500].strip()}",
        }
    return None


def detect_source_type(url: str | None) -> str:
    if not url:
        return "url"

    host = urlparse(url).netloc.lower().removeprefix("www.")
    if host in {"youtube.com", "m.youtube.com", "youtu.be"} or host.endswith(".youtube.com"):
        return "youtube"
    if host == "instagram.com" or host.endswith(".instagram.com"):
        return "instagram"
    return "url"


def extract_youtube_video_id(url: str | None) -> str | None:
    if not url:
        return None
    parsed = urlparse(url)
    host = parsed.netloc.lower().removeprefix("www.")
    if host == "youtu.be":
        return parsed.path.strip("/") or None
    if "youtube.com" in host:
        if parsed.path == "/watch":
            return (parse_qs(parsed.query).get("v") or [None])[0]
        for prefix in ["/shorts/", "/embed/"]:
            if parsed.path.startswith(prefix):
                return parsed.path.removeprefix(prefix).split("/")[0] or None
    return None


def normalize_url(url: str | None) -> str | None:
    if not url:
        return None
    value = url.strip()
    if not value:
        return None
    if not re.match(r"^https?://", value, re.IGNORECASE):
        value = f"https://{value}"
    parsed = urlparse(value)
    if parsed.scheme not in {"http", "https"} or not parsed.netloc:
        return None
    return value


def canonicalize_url(url: str | None) -> str | None:
    if not url:
        return None
    parsed = urlparse(url)
    if not parsed.scheme or not parsed.netloc:
        return url
    return parsed._replace(fragment="").geturl()


def extract_first_url(text: str | None) -> str | None:
    if not text:
        return None
    match = re.search(r"https?://\S+", text)
    return canonicalize_url(match.group(0).rstrip(".,)]}")) if match else None


def clean_text(value: str | None) -> str | None:
    if value is None:
        return None
    cleaned = re.sub(r"\s+", " ", value).strip()
    return cleaned or None


def limit_chars(value: str | None, max_chars: int) -> str | None:
    text = clean_text(value)
    if not text:
        return None
    if len(text) <= max_chars:
        return text
    return text[: max_chars - 1].rstrip() + "…"


def clean_summary(value: str | None) -> str | None:
    if not value:
        return None
    lines = [line.strip() for line in value.splitlines() if line.strip()]
    if not lines:
        return None
    normalized = []
    for line in lines[:8]:
        if re.search(r"(요약입니다|핵심 포인트|다음은)", line):
            continue
        if line.startswith(("-", "•", "*")):
            normalized.append("- " + line.lstrip("-•* ").strip())
        else:
            normalized.append("- " + line)
    return "\n".join(normalized) or None


def optional_str(value: Any) -> str | None:
    if value is None:
        return None
    text = str(value).strip()
    return text or None


def meta_content(soup: BeautifulSoup, property_name: str) -> str | None:
    tag = soup.find("meta", attrs={"property": property_name})
    if not tag:
        tag = soup.find("meta", attrs={"name": property_name})
    return optional_str(tag.get("content")) if tag else None


def meta_name_content(soup: BeautifulSoup, name: str) -> str | None:
    tag = soup.find("meta", attrs={"name": name})
    return optional_str(tag.get("content")) if tag else None


def page_title(soup: BeautifulSoup) -> str | None:
    return optional_str(soup.title.string if soup.title else None)


def canonical_href(soup: BeautifulSoup) -> str | None:
    tag = soup.find("link", attrs={"rel": "canonical"})
    return optional_str(tag.get("href")) if tag else None


def extract_article_text(soup: BeautifulSoup) -> str:
    candidate = soup.find("article") or soup.find("main") or soup.body
    if not candidate:
        return ""
    pieces = [
        clean_text(piece)
        for piece in candidate.stripped_strings
        if clean_text(piece) and len(clean_text(piece) or "") > 1
    ]
    return "\n".join(pieces)


def extract_embedded_json_text(soup: BeautifulSoup) -> str:
    pieces: list[str] = []
    for script in soup.find_all("script"):
        script_id = optional_str(script.get("id"))
        script_type = optional_str(script.get("type"))
        if script_type != "application/ld+json" and script_id != "__NEXT_DATA__":
            continue

        raw = script.string or script.get_text()
        if not raw:
            continue

        try:
            payload = json.loads(raw)
        except json.JSONDecodeError:
            continue

        collect_json_text(payload, pieces)

    deduped: list[str] = []
    seen: set[str] = set()
    for piece in pieces:
        cleaned = clean_text(piece)
        if not cleaned or cleaned in seen:
            continue
        seen.add(cleaned)
        deduped.append(cleaned)
        if sum(len(value) for value in deduped) >= MAX_EXTRACTED_TEXT_CHARS:
            break

    return "\n".join(deduped)


def collect_json_text(value: Any, pieces: list[str], key: str | None = None) -> None:
    if isinstance(value, dict):
        for child_key, child_value in value.items():
            collect_json_text(child_value, pieces, str(child_key))
        return

    if isinstance(value, list):
        for child in value:
            collect_json_text(child, pieces, key)
        return

    if not isinstance(value, str):
        return

    text = clean_text(value)
    if not text:
        return

    if key in IMPORTANT_JSON_TEXT_KEYS or len(text) >= 160:
        pieces.append(text)
