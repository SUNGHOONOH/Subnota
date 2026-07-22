"""Runnable check for inbox keyword extraction. `python tests/test_inbox_keywords.py`."""

from app.features.inbox.summary import (
    clean_keywords,
    parse_summary_payload,
    summary_payload_to_patch,
)


def test_clean_keywords_dedupes_caps_and_drops_blanks() -> None:
    raw = ["AI", "ai", "  ", "", "RAG", "임베딩", "벡터검색", "튜닝", "추가초과"]
    assert clean_keywords(raw) == ["AI", "RAG", "임베딩", "벡터검색", "튜닝", "추가초과"]
    # malformed input degrades to [] rather than raising
    assert clean_keywords(None) == []
    assert clean_keywords("not a list") == []


def test_parse_summary_payload_extracts_keywords() -> None:
    payload = parse_summary_payload(
        '{"one_liner":"한 줄","search_summary":"검색용 요약","detail_summary":"- [a] b",'
        '"keywords":["키워드1","키워드2"]}'
    )
    assert payload is not None
    assert payload["keywords"] == ["키워드1", "키워드2"]


def test_patch_keywords_empty_when_absent() -> None:
    # Fallback payloads carry no "keywords" -> patch writes [] (no badges, no error).
    patch = summary_payload_to_patch({"one_liner": "x"})
    assert patch["keywords"] == []
    assert summary_payload_to_patch(None)["keywords"] == []


if __name__ == "__main__":
    test_clean_keywords_dedupes_caps_and_drops_blanks()
    test_parse_summary_payload_extracts_keywords()
    test_patch_keywords_empty_when_absent()
    print("ok")
