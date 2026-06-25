import json
from typing import Any
from urllib.parse import urljoin

import httpx
from bs4 import BeautifulSoup

from app.db import DatabaseRow
from app.features.inbox.constants import (
    IMPORTANT_JSON_TEXT_KEYS,
    MAX_EXTRACTED_TEXT_CHARS,
    MAX_FETCH_BYTES,
    MAX_FETCH_REDIRECTS,
    MIN_USEFUL_EXTRACTED_TEXT_CHARS,
    PLAYWRIGHT_NAVIGATION_TIMEOUT_MS,
    PLAYWRIGHT_NETWORK_IDLE_TIMEOUT_MS,
    PLAYWRIGHT_RENDER_WAIT_MS,
    PLAYWRIGHT_SCROLL_STEPS,
    USER_AGENT,
)
from app.features.inbox.utils import clean_text, optional_str
from app.shared.url_guard import (
    build_ssrf_safe_client,
    ensure_public_http_url,
    resolve_public_ip_literal,
)

try:
    from playwright.sync_api import sync_playwright
except Exception:  # pragma: no cover - optional runtime dependency
    sync_playwright = None


def fetch_page_metadata(url: str | None) -> DatabaseRow:
    if not url:
        return {}

    html = fetch_static_html(url)
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


def fetch_static_html(url: str) -> str:
    """Fetch HTML, validating every URL (including redirect hops) is public.

    Redirects are followed manually instead of by httpx so each hop can be
    re-checked against the SSRF guard; a hop that points at a private address
    is rejected even if the original URL was public.
    """
    current = ensure_public_http_url(url)
    with build_ssrf_safe_client(
        follow_redirects=False,
        timeout=12,
        headers={"User-Agent": USER_AGENT, "Accept": "text/html,application/xhtml+xml"},
    ) as client:
        for _ in range(MAX_FETCH_REDIRECTS):
            with client.stream("GET", current) as response:
                if response.is_redirect:
                    location = response.headers.get("location")
                    if not location:
                        break
                    current = ensure_public_http_url(urljoin(current, location))
                    continue
                response.raise_for_status()
                return _read_capped_text(response)

    raise ValueError(f"Too many redirects while fetching: {url}")


def _read_capped_text(response: httpx.Response) -> str:
    """Read a streamed response body, aborting if it exceeds MAX_FETCH_BYTES.

    Guards against memory exhaustion from a malicious or runaway URL. The
    Content-Length header (when present) is rejected up front; the streamed
    byte total is enforced regardless, since the header can lie or be absent.
    """
    declared = response.headers.get("content-length")
    if declared is not None and declared.isdigit() and int(declared) > MAX_FETCH_BYTES:
        raise ValueError(f"Response exceeds maximum size: {declared} bytes")
    total = 0
    chunks: list[bytes] = []
    for chunk in response.iter_bytes():
        total += len(chunk)
        if total > MAX_FETCH_BYTES:
            raise ValueError(f"Response exceeds maximum size: over {MAX_FETCH_BYTES} bytes")
        chunks.append(chunk)
    body = b"".join(chunks)
    return body.decode(response.encoding or "utf-8", errors="replace")


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

    try:
        host, _port, host_ip = resolve_public_ip_literal(url)
    except ValueError:
        return None

    browser = None
    playwright = None
    try:
        playwright = sync_playwright().start()
        browser = playwright.chromium.launch(
            headless=True,
            args=[
                "--disable-dev-shm-usage",
                "--no-sandbox",
                # Pin the validated public IP so the browser connects to the same
                # address we checked, closing the DNS-rebinding gap (the route
                # guard below still re-validates redirects/subresources to other
                # hosts). Mirrors the httpx path's connect-time IP pinning.
                f"--host-resolver-rules=MAP {host} {host_ip},EXCLUDE localhost",
            ],
        )
        page = browser.new_page(
            user_agent=USER_AGENT,
            viewport={"width": 1280, "height": 900},
        )
        page.route("**/*", _guard_playwright_route)
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


def _guard_playwright_route(route: Any) -> None:
    request_url = route.request.url
    if request_url.startswith(("http://", "https://")):
        try:
            ensure_public_http_url(request_url)
        except ValueError:
            route.abort()
            return
    route.continue_()


def fetch_oembed_or_page_metadata(url: str | None) -> DatabaseRow:
    if not url:
        return {}

    try:
        return fetch_page_metadata(url) | {"provider": "instagram_open_graph"}
    except Exception as exc:
        return {"provider": "instagram_preview", "error": str(exc)[:500]}


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
