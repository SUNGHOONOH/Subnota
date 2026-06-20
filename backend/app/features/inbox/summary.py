import json
from typing import Any

from app.core import constants as model_constants
from app.core.config import settings
from app.db import DatabaseRow
from app.features.inbox.constants import MAX_EXTRACTED_TEXT_CHARS, SUMMARY_PROMPT_KO
from app.features.inbox.utils import clean_summary, clean_text, limit_chars, optional_str

try:
    from google import genai
    from google.genai import types as genai_types
except Exception:  # pragma: no cover - optional runtime dependency
    genai = None
    genai_types = None


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
        models=model_constants.URL_CONTENT_SUMMARY_MODELS,
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
        models=model_constants.TEXT_SUMMARY_MODELS,
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
    provider = "gemma" if model == model_constants.GEMMA_FALLBACK_MODEL else "gemini"
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
