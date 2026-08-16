import re
from datetime import datetime, timedelta
from zoneinfo import ZoneInfo

from pydantic import BaseModel

from app.shared.hashing import short_hash
from app.features.memo.chunking import MemoChunk, split_sentences

SEOUL_TZ = ZoneInfo("Asia/Seoul")

DATE_PATTERNS = [
    re.compile(r"(?P<text>(?P<year>\d{2,4})[./-](?P<month>\d{1,2})[./-](?P<day>\d{1,2}))"),
    re.compile(r"(?P<text>(?:(?P<month_prefix>이번\s*달|다음\s*달|다다음\s*달|이번달|다음달|다다음달)\s*(?P<day_only>\d{1,2})\s*일|(?P<month>\d{1,2})\s*월\s*(?P<day>\d{1,2})\s*일))"),
    re.compile(r"(?P<text>(?P<offset_word>하루|이틀|사흘|나흘|(?:\d{1,3})\s*일|(?:\d{1,2})\s*주|(?:\d{1,2})\s*달|(?:\d{1,2})\s*개월)\s*(?:뒤|후|뒤에|후에))"),
    re.compile(r"(?P<text>내일\s*모레|오늘|내일|모레|글피|어제|엊그제|낼모레|낼)"),
    re.compile(r"(?P<text>(?P<week_prefix>이번\s*주|다음\s*주|다다음\s*주|이번주|다음주|다다음주|담주)?\s*(?P<weekday>일요일|월요일|화요일|수요일|목요일|금요일|토요일|일욜|월욜|화욜|수욜|목욜|금욜|토욜|일|월|화|수|목|금|토)(?![가-힣]))"),
    re.compile(r"(?P<text>(?P<weekend_prefix>이번|다음|다다음)\s*주말)")
]

EN_MONTH_RE = (
    r"jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|"
    r"jul(?:y)?|aug(?:ust)?|sep(?:t(?:ember)?)?|oct(?:ober)?|"
    r"nov(?:ember)?|dec(?:ember)?"
)

# These patterns intentionally exclude ambiguous numeric dates such as 6/10.
# A locale/region preference is required before treating those as calendar data.
EN_DATE_PATTERNS = [
    re.compile(
        rf"(?P<text>\b(?P<en_month>{EN_MONTH_RE})\.?\s+"
        r"(?P<en_day>\d{1,2})(?:st|nd|rd|th)?"
        r"(?:,?\s*(?P<en_year>\d{4}))?\b)",
        re.IGNORECASE,
    ),
    re.compile(
        rf"(?P<text>\b(?P<en_day>\d{{1,2}})(?:st|nd|rd|th)?\s+"
        rf"(?P<en_month>{EN_MONTH_RE})\.?"
        r"(?:,?\s*(?P<en_year>\d{4}))?\b)",
        re.IGNORECASE,
    ),
    re.compile(r"(?P<text>\b(?P<en_relative>today|tomorrow|yesterday)\b)", re.IGNORECASE),
    re.compile(
        r"(?P<text>\bin\s+(?P<en_offset_value>\d{1,3}|one|two|three|four|five|"
        r"six|seven|eight|nine|ten|eleven|twelve)\s+(?P<en_offset_unit>days?|weeks?|months?)\b)",
        re.IGNORECASE,
    ),
    re.compile(
        r"(?P<text>\b(?P<en_week_prefix>this|next|coming)\s+"
        r"(?P<en_weekday>monday|tuesday|wednesday|thursday|friday|saturday|sunday)\b)",
        re.IGNORECASE,
    ),
    re.compile(
        r"(?P<text>\b(?P<en_weekend_prefix>this|next|coming)\s+weekend\b)",
        re.IGNORECASE,
    ),
]

TIME_RE = re.compile(
    r"(?P<text>(?:(?P<ampm>오전|오후|아침|점심|저녁|낮|밤|새벽)\s*)?(?P<hour>\d{1,2})\s*시"
    r"(?:\s*(?P<half>반)|\s*(?P<minute>\d{1,2})\s*분?)?|"
    r"(?P<hour24>\d{1,2}):(?P<minute24>\d{2}))"
)

EN_TIME_RE = re.compile(
    r"(?P<text>\b(?P<en_special_time>noon|midnight)\b|"
    r"\b(?P<en_hour>\d{1,2})(?::(?P<en_minute>\d{2}))?\s*"
    r"(?P<en_ampm>a\.?m\.?|p\.?m\.?)\b)",
    re.IGNORECASE,
)

EN_MONTHS = {
    "jan": 1,
    "feb": 2,
    "mar": 3,
    "apr": 4,
    "may": 5,
    "jun": 6,
    "jul": 7,
    "aug": 8,
    "sep": 9,
    "oct": 10,
    "nov": 11,
    "dec": 12,
}
EN_NUMBER_WORDS = {
    "one": 1,
    "two": 2,
    "three": 3,
    "four": 4,
    "five": 5,
    "six": 6,
    "seven": 7,
    "eight": 8,
    "nine": 9,
    "ten": 10,
    "eleven": 11,
    "twelve": 12,
}
EN_WEEKDAYS = {
    "monday": 0,
    "tuesday": 1,
    "wednesday": 2,
    "thursday": 3,
    "friday": 4,
    "saturday": 5,
    "sunday": 6,
}

TITLE_CLEAN_RE = re.compile(r"\s+")


class ScheduleCandidate(BaseModel):
    source_key: str
    source_text_hash: str
    source_text: str
    source_start: int
    source_end: int
    title: str
    scheduled_at: datetime
    time_text: str | None = None
    all_day: bool
    confidence: str


def extract_schedule_candidates(
    memo_id: str,
    content: str,
    base_time: datetime | None = None,
    time_zone: ZoneInfo = SEOUL_TZ,
) -> list[ScheduleCandidate]:
    base = (base_time or datetime.now(time_zone)).astimezone(time_zone)
    chunks = split_sentences(content)

    return [
        candidate
        for chunk in chunks
        for candidate in extract_schedule_candidates_from_chunk(memo_id, chunk, base)
    ]


def extract_schedule_candidates_from_chunk(
    memo_id: str,
    chunk: MemoChunk,
    base_time: datetime,
) -> list[ScheduleCandidate]:
    matches = find_date_matches(chunk.text)
    candidates: list[ScheduleCandidate] = []

    for match in matches:
        scheduled_date = resolve_date(match, base_time)
        if scheduled_date is None:
            continue

        time_match = find_time_match_near(chunk.text, match.start(), match.end())
        scheduled_at, time_text = apply_time(scheduled_date, time_match)
        title = build_title(chunk.text, match, time_match)
        if not title:
            continue

        all_day = time_text is None
        source_text_hash = short_hash(f"{chunk.text}|{scheduled_at.isoformat()}|{time_text or ''}")
        source_key = ":".join(
            [
                memo_id,
                short_hash(chunk.text),
                short_hash(match.group("text")),
                str(int(scheduled_at.timestamp())),
            ]
        )

        candidates.append(
            ScheduleCandidate(
                source_key=source_key,
                source_text_hash=source_text_hash,
                source_text=chunk.text,
                source_start=chunk.start,
                source_end=chunk.end,
                title=title,
                scheduled_at=scheduled_at,
                time_text=time_text,
                all_day=all_day,
                confidence="candidate" if all_day else "auto",
            )
        )

    return dedupe_candidates(candidates)


def find_date_matches(text: str) -> list[re.Match[str]]:
    matches: list[re.Match[str]] = []
    occupied: list[tuple[int, int]] = []

    for pattern in [*DATE_PATTERNS, *EN_DATE_PATTERNS]:
        for match in pattern.finditer(text):
            span = match.span()
            if any(not (span[1] <= start or span[0] >= end) for start, end in occupied):
                continue
            matches.append(match)
            occupied.append(span)

    return sorted(matches, key=lambda item: item.start())


def resolve_date(match: re.Match[str], base_time: datetime) -> datetime | None:
    text = match.group("text")
    start_of_today = base_time.replace(hour=0, minute=0, second=0, microsecond=0)

    # Relative days
    rel_map = {
        "엊그제": -2, "어제": -1, "오늘": 0, "내일": 1, "낼": 1,
        "모레": 2, "내일모레": 2, "내일 모레": 2, "낼모레": 2, "글피": 3
    }
    if text in rel_map:
        return start_of_today + timedelta(days=rel_map[text])

    d = match.groupdict()

    en_relative = d.get("en_relative")
    if en_relative:
        offset = {"yesterday": -1, "today": 0, "tomorrow": 1}[en_relative.lower()]
        return start_of_today + timedelta(days=offset)

    en_offset_value = d.get("en_offset_value")
    if en_offset_value:
        value = en_offset_value.lower()
        count = EN_NUMBER_WORDS.get(value, int(value) if value.isdigit() else 0)
        unit = (d.get("en_offset_unit") or "").lower()
        if unit.startswith("day"):
            return start_of_today + timedelta(days=count)
        if unit.startswith("week"):
            return start_of_today + timedelta(days=count * 7)
        return add_months(start_of_today, count)

    en_weekday = d.get("en_weekday")
    if en_weekday:
        delta = (EN_WEEKDAYS[en_weekday.lower()] - start_of_today.weekday()) % 7
        if (d.get("en_week_prefix") or "").lower() == "next":
            delta += 7
        return start_of_today + timedelta(days=delta)

    if d.get("en_weekend_prefix"):
        delta = (5 - start_of_today.weekday()) % 7
        if (d.get("en_weekend_prefix") or "").lower() == "next":
            delta += 7
        return start_of_today + timedelta(days=delta)

    en_month = d.get("en_month")
    if en_month:
        month = EN_MONTHS[en_month.lower().rstrip(".")[:3]]
        day = int(d["en_day"])
        year = int(d.get("en_year") or base_time.year)
        try:
            candidate = start_of_today.replace(year=year, month=month, day=day)
        except ValueError:
            return None
        if d.get("en_year") is None and candidate < start_of_today:
            candidate = candidate.replace(year=candidate.year + 1)
        return candidate

    # N days later
    offset_word = d.get("offset_word")
    if offset_word:
        val = offset_word.replace(" ", "")
        if val == "하루": n = 1
        elif val == "이틀": n = 2
        elif val == "사흘": n = 3
        elif val == "나흘": n = 4
        elif "주" in val: n = int(re.sub(r"\D", "", val)) * 7
        elif "달" in val or "개월" in val:
            months = int(re.sub(r"\D", "", val))
            return add_months(start_of_today, months)
        else: n = int(re.sub(r"\D", "", val))
        return start_of_today + timedelta(days=n)

    # Month / Day
    month_prefix = d.get("month_prefix")
    day_only = d.get("day_only")
    if month_prefix and day_only:
        p = month_prefix.replace(" ", "")
        months_add = 0
        if p == "다음달": months_add = 1
        elif p == "다다음달": months_add = 2

        m = start_of_today.month - 1 + months_add
        y = start_of_today.year + m // 12
        m = m % 12 + 1
        try:
            return start_of_today.replace(year=y, month=m, day=int(day_only))
        except ValueError:
            return None

    # Weekday
    weekday = d.get("weekday")
    if weekday:
        weekdays = {"일":0,"월":1,"화":2,"수":3,"목":4,"금":5,"토":6}
        wk = weekday[0]
        target_day = weekdays.get(wk)
        if target_day is None: return None

        current_day = (start_of_today.weekday() + 1) % 7
        day_delta = (target_day - current_day + 7) % 7

        week_prefix = d.get("week_prefix") or ""
        wp = week_prefix.replace(" ", "")
        if wp in ("다음주", "담주"):
            day_delta = 7 if day_delta == 0 else day_delta + 7
        elif wp == "다다음주":
            day_delta = 14 if day_delta == 0 else day_delta + 14

        return start_of_today + timedelta(days=day_delta)

    # Weekend
    weekend_prefix = d.get("weekend_prefix")
    if weekend_prefix:
        current_day = (start_of_today.weekday() + 1) % 7
        day_delta = (6 - current_day + 7) % 7
        wp = weekend_prefix.replace(" ", "")
        if wp == "다음": day_delta += 7
        elif wp == "다다음": day_delta += 14
        if day_delta == 0: day_delta = 7
        return start_of_today + timedelta(days=day_delta)

    # Year / Month / Day
    year_text = d.get("year")
    month_text = d.get("month")
    day_text = d.get("day")

    if not month_text or not day_text:
        return None

    year = base_time.year
    if year_text:
        year = int(year_text)
        if year < 100:
            year += 2000

    try:
        candidate = start_of_today.replace(
            year=year,
            month=int(month_text),
            day=int(day_text),
        )
    except ValueError:
        return None

    if not year_text and candidate < start_of_today:
        try:
            candidate = candidate.replace(year=candidate.year + 1)
        except ValueError:
            return None

    return candidate


def find_time_match_near(
    text: str,
    date_start: int,
    date_end: int,
) -> re.Match[str] | None:
    candidates = [(match, 1) for match in TIME_RE.finditer(text)]
    candidates.extend((match, 0) for match in EN_TIME_RE.finditer(text))
    if not candidates:
        return None

    return min(
        candidates,
        key=lambda item: (
            min(abs(item[0].start() - date_end), abs(date_start - item[0].end())),
            item[1],
        ),
    )[0]


def apply_time(
    date: datetime,
    match: re.Match[str] | None,
) -> tuple[datetime, str | None]:
    if match is None:
        return date, None

    d = match.groupdict()
    en_special_time = d.get("en_special_time")
    if en_special_time:
        hour = 12 if en_special_time.lower() == "noon" else 0
        scheduled_at = date.replace(hour=hour, minute=0, second=0, microsecond=0)
        return scheduled_at, f"{hour:02d}:00"

    if d.get("en_hour"):
        hour = int(d["en_hour"])
        minute = int(d.get("en_minute") or 0)
        if not 1 <= hour <= 12 or minute > 59:
            return date, None
        if (d.get("en_ampm") or "").lower().replace(".", "").startswith("p") and hour < 12:
            hour += 12
        elif (d.get("en_ampm") or "").lower().replace(".", "").startswith("a") and hour == 12:
            hour = 0
        scheduled_at = date.replace(hour=hour, minute=minute, second=0, microsecond=0)
        return scheduled_at, f"{hour:02d}:{minute:02d}"

    if d.get("hour24"):
        hour = int(d["hour24"])
        minute = int(d["minute24"])
    else:
        hour = int(d["hour"])
        minute = 30 if d.get("half") else int(d.get("minute") or 0)
        ampm = d.get("ampm")
        if ampm:
            if ampm in ("오후", "저녁", "밤") and hour < 12:
                hour += 12
            elif ampm in ("오전", "아침", "새벽") and hour == 12:
                hour = 0
            elif ampm == "낮" and hour < 8:
                hour += 12
        elif 1 <= hour <= 5:
            hour += 12

    if hour > 23 or minute > 59:
        return date, None

    scheduled_at = date.replace(hour=hour, minute=minute, second=0, microsecond=0)
    return scheduled_at, f"{hour:02d}:{minute:02d}"


def add_months(date: datetime, months: int) -> datetime:
    month_index = date.month - 1 + months
    year = date.year + month_index // 12
    month = month_index % 12 + 1
    try:
        return date.replace(year=year, month=month)
    except ValueError:
        if month in (4, 6, 9, 11):
            day = 30
        elif month == 2:
            day = 29 if year % 4 == 0 and (year % 100 != 0 or year % 400 == 0) else 28
        else:
            day = 31
        return date.replace(year=year, month=month, day=day)


def build_title(
    text: str,
    date_match: re.Match[str],
    time_match: re.Match[str] | None,
) -> str:
    ranges = [date_match.span()]
    if time_match:
        ranges.append(time_match.span())

    remaining = []
    cursor = 0
    for start, end in sorted(ranges):
        remaining.append(text[cursor:start])
        cursor = max(cursor, end)
    remaining.append(text[cursor:])

    title = TITLE_CLEAN_RE.sub(" ", " ".join(remaining)).strip(" -•·\n\t")
    return title or TITLE_CLEAN_RE.sub(" ", text).strip()


def dedupe_candidates(candidates: list[ScheduleCandidate]) -> list[ScheduleCandidate]:
    seen: set[str] = set()
    result: list[ScheduleCandidate] = []

    for candidate in candidates:
        if candidate.source_key in seen:
            continue
        seen.add(candidate.source_key)
        result.append(candidate)

    return result
