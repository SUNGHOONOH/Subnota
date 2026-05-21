import re
from datetime import datetime, timedelta
from zoneinfo import ZoneInfo

from pydantic import BaseModel

from app.hashing import short_hash
from app.memo_chunking import MemoChunk, split_sentences

SEOUL_TZ = ZoneInfo("Asia/Seoul")

DATE_PATTERNS = [
    re.compile(r"(?P<text>(?P<year>\d{2,4})[./-](?P<month>\d{1,2})[./-](?P<day>\d{1,2}))"),
    re.compile(r"(?P<text>(?:(?P<month_prefix>이번\s*달|다음\s*달|다다음\s*달|이번달|다음달|다다음달)\s*(?P<day_only>\d{1,2})\s*일|(?P<month>\d{1,2})\s*월\s*(?P<day>\d{1,2})\s*일))"),
    re.compile(r"(?P<text>(?P<offset_word>하루|이틀|사흘|나흘|(?:\d{1,3})\s*일|(?:\d{1,2})\s*주|(?:\d{1,2})\s*달|(?:\d{1,2})\s*개월)\s*(?:뒤|후|뒤에|후에))"),
    re.compile(r"(?P<text>내일\s*모레|오늘|내일|모레|글피|어제|엊그제|낼모레|낼)"),
    re.compile(r"(?P<text>(?P<week_prefix>이번\s*주|다음\s*주|다다음\s*주|이번주|다음주|다다음주|담주)?\s*(?P<weekday>일요일|월요일|화요일|수요일|목요일|금요일|토요일|일욜|월욜|화욜|수욜|목욜|금욜|토욜|일|월|화|수|목|금|토)(?![가-힣]))"),
    re.compile(r"(?P<text>(?P<weekend_prefix>이번|다음|다다음)\s*주말)")
]

TIME_RE = re.compile(
    r"(?P<text>(?:(?P<ampm>오전|오후|아침|점심|저녁|낮|밤|새벽)\s*)?(?P<hour>\d{1,2})\s*시"
    r"(?:\s*(?P<half>반)|\s*(?P<minute>\d{1,2})\s*분?)?|"
    r"(?P<hour24>\d{1,2}):(?P<minute24>\d{2}))"
)

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
) -> list[ScheduleCandidate]:
    base = (base_time or datetime.now(SEOUL_TZ)).astimezone(SEOUL_TZ)
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

    for pattern in DATE_PATTERNS:
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
            m = start_of_today.month - 1 + months
            y = start_of_today.year + m // 12
            m = m % 12 + 1
            try:
                return start_of_today.replace(year=y, month=m)
            except ValueError:
                if m in (4, 6, 9, 11): day = 30
                elif m == 2: day = 29 if y % 4 == 0 and (y % 100 != 0 or y % 400 == 0) else 28
                else: day = 31
                return start_of_today.replace(year=y, month=m, day=day)
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
        candidate = datetime(
            year,
            int(month_text),
            int(day_text),
            tzinfo=SEOUL_TZ,
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
    candidates = list(TIME_RE.finditer(text))
    if not candidates:
        return None

    return min(
        candidates,
        key=lambda item: min(abs(item.start() - date_end), abs(date_start - item.end())),
    )


def apply_time(
    date: datetime,
    match: re.Match[str] | None,
) -> tuple[datetime, str | None]:
    if match is None:
        return date, None

    d = match.groupdict()
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

    if hour > 23 or minute > 59:
        return date, None

    scheduled_at = date.replace(hour=hour, minute=minute, second=0, microsecond=0)
    return scheduled_at, f"{hour:02d}:{minute:02d}"


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
