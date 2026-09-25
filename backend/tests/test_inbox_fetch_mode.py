"""Runnable check for inbox fetch modes. `python tests/test_inbox_fetch_mode.py`."""

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app.features.inbox import service, webpage


def test_page_metadata_uses_static_html_fetch() -> None:
    original_static = webpage.fetch_static_html
    try:
        webpage.fetch_static_html = lambda _url: (
            "<html><head><title>Short page</title></head><body>tiny</body></html>"
        )
        metadata = webpage.fetch_page_metadata("https://example.com")
        assert metadata["title"] == "Short page"
        assert metadata["extraction_method"] == "static_html"
    finally:
        webpage.fetch_static_html = original_static


def test_failed_fetch_degrades_to_link_only_partial() -> None:
    original_fetch = service.fetch_page_metadata
    try:
        service.fetch_page_metadata = lambda _url: (_ for _ in ()).throw(RuntimeError("blocked"))
        patch = service.analyze_url("https://medium.com/")
        assert patch["summary_status"] == "partial"
        assert patch["summary_basis"] == "링크만 저장됨"
        assert patch["canonical_url"] == "https://medium.com/"
        assert patch["metadata"]["provider"] == "html_fetch_failed"
    finally:
        service.fetch_page_metadata = original_fetch


if __name__ == "__main__":
    test_page_metadata_uses_static_html_fetch()
    test_failed_fetch_degrades_to_link_only_partial()
    print("ok")
