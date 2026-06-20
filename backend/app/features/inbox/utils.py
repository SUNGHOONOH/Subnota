import re
from typing import Any
from urllib.parse import parse_qs, urlparse


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
