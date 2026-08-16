from datetime import datetime
from zoneinfo import ZoneInfo

from app.features.schedule.parser import SEOUL_TZ, extract_schedule_candidates


BASE_TIME = datetime(2026, 8, 12, 9, 0, tzinfo=SEOUL_TZ)  # Wednesday


def only_candidate(text: str):
    candidates = extract_schedule_candidates("memo", text, BASE_TIME)
    assert len(candidates) == 1
    return candidates[0]


def test_extracts_clear_english_date_expressions() -> None:
    cases = [
        ("Project review tomorrow at noon", datetime(2026, 8, 13, 12, 0, tzinfo=SEOUL_TZ)),
        ("Plan next Friday at 3:30 PM", datetime(2026, 8, 21, 15, 30, tzinfo=SEOUL_TZ)),
        ("Coffee in two days at 9 AM", datetime(2026, 8, 14, 9, 0, tzinfo=SEOUL_TZ)),
        ("Ship the release on August 20", datetime(2026, 8, 20, 0, 0, tzinfo=SEOUL_TZ)),
        ("Review 20 Aug 2026 at midnight", datetime(2026, 8, 20, 0, 0, tzinfo=SEOUL_TZ)),
    ]

    for text, expected in cases:
        candidate = only_candidate(text)
        assert candidate.scheduled_at == expected
        assert candidate.all_day is (expected.hour == 0 and "midnight" not in text.lower())


def test_keeps_korean_and_rejects_ambiguous_english_numeric_dates() -> None:
    korean = only_candidate("내일 오후 3시 회의")
    assert korean.scheduled_at == datetime(2026, 8, 13, 15, 0, tzinfo=SEOUL_TZ)

    assert extract_schedule_candidates("memo", "Review 6/10 with API v1.2", BASE_TIME) == []


def test_uses_the_profile_time_zone_for_extracted_times() -> None:
    new_york = ZoneInfo("America/New_York")
    base = datetime(2026, 8, 12, 9, 0, tzinfo=new_york)

    candidates = extract_schedule_candidates(
        "memo",
        "Project review tomorrow at 3 PM",
        base,
        time_zone=new_york,
    )

    assert candidates[0].scheduled_at == datetime(2026, 8, 13, 15, 0, tzinfo=new_york)
