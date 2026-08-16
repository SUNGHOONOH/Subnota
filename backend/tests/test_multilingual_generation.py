from app.db.types import MemoRecord
from app.features.inbox.summary import (
    build_metadata_summary_payload,
    summary_prompt_for_content,
)
from app.features.language import detect_content_language
from app.features.topics.discovery import (
    build_keyword_label,
    build_topic_label_prompt,
    clean_topic_label,
)


def memo(content: str) -> MemoRecord:
    return MemoRecord(
        id="memo-1",
        content=content,
        content_hash=None,
        indexed_content_hash=None,
        schedule_scanned_hash=None,
        topic_dirty=True,
        created_at=None,
        updated_at=None,
        content_updated_at=None,
    )


def test_content_language_keeps_mixed_notes_on_the_existing_korean_path() -> None:
    assert detect_content_language("This is an English note.") == "en"
    assert detect_content_language("한국어 note") == "ko"
    assert detect_content_language("1234") == "ko"


def test_summary_prompt_follows_content_language() -> None:
    english = summary_prompt_for_content("This is a sufficiently clear English article.")
    korean = summary_prompt_for_content("한국어로 작성된 메모입니다.")

    assert "Summarize the content below in English" in english
    assert "아래 콘텐츠를 한국어로" in korean


def test_english_metadata_fallback_uses_english_detail_labels() -> None:
    payload = build_metadata_summary_payload(
        {"title": "A practical guide", "description": "An English description."}
    )

    assert payload is not None
    assert payload["detail_summary"] == (
        "- [Title] A practical guide\n- [Description] An English description."
    )


def test_topic_prompt_and_fallback_label_follow_english_content() -> None:
    prompt = build_topic_label_prompt(
        ["calendar", "schedule"],
        [memo("Plan the weekly calendar and schedule the review.")],
    )

    assert "Use a short, intuitive folder-like noun phrase in English" in prompt
    assert build_keyword_label([], "en") == "Miscellaneous notes"
    assert clean_topic_label("Notes", "en") is None


def test_mixed_topic_prompt_keeps_korean_output_for_stability() -> None:
    prompt = build_topic_label_prompt(
        ["캘린더", "calendar"],
        [memo("캘린더를 정리하고 the weekly schedule을 확인한다.")],
    )

    assert "2~8자 한국어 명사" in prompt
