import Foundation

/// 데스크탑 `desktop/src/lib/dateParser.ts` 의 `parseDates` / `findNearestDateMatch`
/// 를 그대로 옮긴 것. 같은 문장이 두 기기에서 다른 날짜로 읽히면 일정이 엉뚱한
/// 날에 잡히므로, 동작이 갈리면 `date-golden.json` 이 아니라 여기를 고친다.
///
/// 데스크탑은 UI 언어가 `ko` 일 때 `getUiNumericDateOrder('ko') === 'mdy'` 로
/// 고정된다(`uiLanguage.ts:53`). iOS 는 언어 설정이 없으므로 그 조합만 옮겼다.
/// `language === 'en'` 에서만 도는 슬래시 M/D/Y 블록은 옮기지 않았다.
public enum DateMatchKind: String, CaseIterable, Sendable {
  case relative
  case englishDate = "english-date"
  case numericDate = "numeric-date"
  case weekday
  case monthDayKR = "month-day-kr"
  case shortDate = "short-date"
  case nDaysLater = "n-days-later"
  case dayOnly = "day-only"
}

public struct DateMatch: Sendable, Equatable {
  public let text: String
  public let date: Date
  /// UTF-16 코드 유닛 오프셋. JS 문자열 인덱스와 같은 단위다.
  public let index: Int
  /// UTF-16 코드 유닛 길이.
  public let length: Int
  public let kind: DateMatchKind
  /// 시각 표현("3시", "15:30")까지 인식됐는지. allDay 판정은 이 플래그를 쓴다 —
  /// date 가 00:00 이라는 것만으로는 "24:00 → 익일 자정" 일정과 구분할 수 없다.
  public let hasTime: Bool
}

// ── JS 정규식 호환 조각 ──────────────────────────────────────────
//
// ICU(NSRegularExpression)와 JS 는 축약 클래스의 뜻이 다르다. 실측 결과:
//   `\d`  ICU 는 `\p{Nd}` 라 전각 숫자 `２６` 까지 잡는다. JS 는 ASCII 뿐이다.
//   `\b`  ICU 는 한글을 단어 문자로 봐서 "메모in 3 days" 를 못 잡는다. JS 는 잡는다.
//   `\s`  ICU 는 VT(U+000B)와 ZWNBSP(U+FEFF)를 뺀다. JS 는 둘 다 공백이다.
// 그래서 셋 다 JS 정의를 그대로 적어 넣는다.

/// JS `\s` (WhiteSpace + LineTerminator). ICU 의 `[...]` 는 따옴표 없는 공백을
/// 무시하므로 실제 문자가 아니라 `\uXXXX` 이스케이프로 적어야 한다.
private let S =
  "[\\u0009\\u000a\\u000b\\u000c\\u000d\\u0020\\u00a0\\u1680\\u2000-\\u200a"
  + "\\u2028\\u2029\\u202f\\u205f\\u3000\\ufeff]"

/// JS `\b` (단어 문자는 `[0-9A-Za-z_]` 뿐).
private let B =
  "(?:(?<=[0-9A-Za-z_])(?![0-9A-Za-z_])|(?<![0-9A-Za-z_])(?=[0-9A-Za-z_]))"

/// 패턴은 전부 리터럴이라 컴파일 실패는 프로그래머 오류다 — 첫 테스트에서 잡힌다.
private func regex(_ pattern: String, caseInsensitive: Bool = false) -> NSRegularExpression {
  try! NSRegularExpression(
    pattern: pattern,
    options: caseInsensitive ? [.caseInsensitive] : []
  )
}

// ── Regex patterns ──────────────────────────────────────────────

/// Full numeric: YY.MM.DD, YYYY.MM.DD, YY/MM/DD, YYYY-MM-DD
private let numericDateRegex = regex(
  "(?<![0-9])([0-9]{2}|[0-9]{4})[./-]([0-9]{1,2})[./-]([0-9]{1,2})(?![0-9])"
)

/// Relative dates (longer tokens first to avoid partial match).
/// 낼(내일 준말)은 "보낼/끝낼/낼게" 같은 동사 활용형과 겹쳐 오탐이 많아 제외한다.
private let relativeDateRegex = regex("내일\(S)*모레|오늘|내일|모레|글피|어제|엊그제|그저께")

/// N일 후 / N일 뒤. 순우리말 셈(열흘·보름…)과 일주일/이주일도 포함한다.
/// 모두 후/뒤가 붙어야만 매칭되므로 일반 명사와 겹칠 위험이 없다.
private let nDaysLaterRegex = regex(
  "(하루|이틀|사흘|나흘|닷새|엿새|이레|여드레|아흐레|열흘|보름|스무날|일주일|이주일|삼주일|사주일"
    + "|(?:[0-9]{1,3})일|(?:[0-9]{1,2})주|(?:[0-9]{1,2})달|(?:[0-9]{1,2})개월)\(S)*(후|뒤|뒤에|후에)"
)

/// Weekday with optional 이번주/다음주/지난주 prefix. 지난주·저번주는 과거를
/// 가리키므로 buildWeekdayDate 에서 매치를 버린다(미래로 오인 방지).
/// 뒤 조사("월요일까지/화요일에")는 허용하되, 다른 단어에 붙은 경우("월급")는 막는다.
private let weekdayRegex = regex(
  "(?<![가-힣0-9])(이번\(S)*주|다음\(S)*주|다다음\(S)*주|지난\(S)*주|저번\(S)*주"
    + "|이번주|다음주|다다음주|지난주|저번주|담주)?\(S)*"
    + "(일요일|월요일|화요일|수요일|목요일|금요일|토요일|일욜|월욜|화욜|수욜|목욜|금욜|토욜"
    + "|일|월|화|수|목|금|토)"
    + "(?!(?!에|엔|은|는|이|가|을|를|도|만|까|부|께|경|쯤|날|마|밖)[가-힣])"
)

// 주말은 토/일 어느 날인지 특정할 수 없어(모호) 인식하지 않는다.

/// Bare day-of-month: 24일 (월 없이 일자만).
private let bareDayRegex = regex(
  "(?<![0-9])(?<!월\(S)?)([0-9]{1,2})일(?!\(S)*(?:후|뒤|동안|정도|만|가량|째))(?![간째차치만0-9])"
)

/// Korean month-day: N월 N일 or (이번 달|다음 달) N일
private let monthDayKRRegex = regex(
  "(?:(이번\(S)*달|다음\(S)*달|다다음\(S)*달|이번달|다음달|다다음달)\(S)*([0-9]{1,2})일"
    + "|([0-9]{1,2})월\(S)*([0-9]{1,2})일)"
)

/// Year-explicit Korean date: 2025년 7월 20일
private let yearMonthDayKRRegex = regex("([0-9]{4})년\(S)*([0-9]{1,2})월\(S)*([0-9]{1,2})일")

/// Short date without year: 슬래시 형식만 (M/D). 점 형식(3.6)은 소수·버전·수치와
/// 구분이 불가능해 제외한다. 연도 포함 점 형식(26.3.6)은 numericDateRegex 가 잡는다.
private let shortDateRegex = regex("(?<![0-9/])([0-9]{1,2})/([0-9]{1,2})(?![0-9/])")

/// Time expression that may follow a date token. 맨 숫자("내일 100개")를
/// 시각으로 오인하지 않도록 시 / : 표지를 요구한다.
/// "3시간"의 시(時)는 시각이 아니므로 시(?!간)으로 제외한다.
private let timeAfterRegex = regex(
  "^\(S)*(오전|오후|아침|점심|저녁|낮|밤|새벽)?\(S)*([0-9]{1,2})"
    + "(?:시(?!간)(?:\(S)*([0-9]{1,2})(?:\(S)*분)?|\(S)*(반))?|:([0-9]{1,2}))(?![0-9])"
)

private let englishMonthNames: [String: Int] = [
  "jan": 0, "feb": 1, "mar": 2, "apr": 3, "may": 4, "jun": 5,
  "jul": 6, "aug": 7, "sep": 8, "oct": 9, "nov": 10, "dec": 11,
]

private let englishMonth =
  "jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?"
  + "|aug(?:ust)?|sep(?:t(?:ember)?)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?"

private let englishMonthDayRegex = regex(
  "\(B)(\(englishMonth))\\.?\(S)+([0-9]{1,2})(?:st|nd|rd|th)?(?:,?\(S)*([0-9]{4}))?\(B)",
  caseInsensitive: true
)
private let englishDayMonthRegex = regex(
  "\(B)([0-9]{1,2})(?:st|nd|rd|th)?\(S)+(\(englishMonth))\\.?(?:,?\(S)*([0-9]{4}))?\(B)",
  caseInsensitive: true
)
private let englishRelativeDateRegex = regex(
  "\(B)(today|tomorrow|yesterday)\(B)",
  caseInsensitive: true
)
private let englishOffsetRegex = regex(
  "\(B)in\(S)+(one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|[0-9]{1,3})"
    + "\(S)+(days?|weeks?|months?)\(B)",
  caseInsensitive: true
)
private let englishWeekdayRegex = regex(
  "\(B)(this|next|coming)\(S)+(monday|tuesday|wednesday|thursday|friday|saturday|sunday)\(B)",
  caseInsensitive: true
)
private let englishTimeAfterRegex = regex(
  "^\(S)*(?:at\(S)+)?(?:(noon|midnight)|([01]?[0-9])(?::([0-5][0-9]))?\(S)*"
    + "(a\\.?m\\.?|p\\.?m\\.?))\(B)",
  caseInsensitive: true
)
private let englishNumberWords: [String: Int] = [
  "one": 1, "two": 2, "three": 3, "four": 4, "five": 5, "six": 6,
  "seven": 7, "eight": 8, "nine": 9, "ten": 10, "eleven": 11, "twelve": 12,
]
private let englishWeekdays: [String: Int] = [
  "monday": 1, "tuesday": 2, "wednesday": 3, "thursday": 4,
  "friday": 5, "saturday": 6, "sunday": 0,
]

// ── Lookup tables ───────────────────────────────────────────────

private let weekdayIndex: [String: Int] = [
  "일요일": 0, "일욜": 0, "일": 0,
  "월요일": 1, "월욜": 1, "월": 1,
  "화요일": 2, "화욜": 2, "화": 2,
  "수요일": 3, "수욜": 3, "수": 3,
  "목요일": 4, "목욜": 4, "목": 4,
  "금요일": 5, "금욜": 5, "금": 5,
  "토요일": 6, "토욜": 6, "토": 6,
]

private let relativeDays: [String: Int] = [
  "그저께": -2, "엊그제": -2, "어제": -1, "오늘": 0,
  "내일": 1, "모레": 2, "내일모레": 2, "내일 모레": 2, "글피": 3,
]

/// 순우리말 날 셈: "열흘 뒤", "보름 후" 등. 후/뒤와만 결합해 쓰인다.
private let nativeDayCounts: [String: Int] = [
  "하루": 1, "이틀": 2, "사흘": 3, "나흘": 4, "닷새": 5, "엿새": 6,
  "이레": 7, "여드레": 8, "아흐레": 9, "열흘": 10, "보름": 15, "스무날": 20,
  "일주일": 7, "이주일": 14, "삼주일": 21, "사주일": 28,
]

// ── Helpers ─────────────────────────────────────────────────────

private extension NSTextCheckingResult {
  func group(_ index: Int, in text: NSString) -> String? {
    let groupRange = range(at: index)
    return groupRange.location == NSNotFound ? nil : text.substring(with: groupRange)
  }
}

/// JS `\s` 의 코드 포인트 전부. 전부 BMP 라 UTF-16 코드 유닛 하나와 같다 —
/// `MemoChunker` 도 이 집합을 쓴다.
let jsWhitespaceScalars: Set<UInt32> = {
  var values: Set<UInt32> = [
    0x09, 0x0a, 0x0b, 0x0c, 0x0d, 0x20, 0xa0,
    0x1680, 0x2028, 0x2029, 0x202f, 0x205f, 0x3000, 0xfeff,
  ]
  values.formUnion(0x2000...0x200a)
  return values
}()

private extension String {
  /// JS `text.replace(/\s/g, '')`.
  func removingJSWhitespace() -> String {
    String(String.UnicodeScalarView(
      unicodeScalars.filter { !jsWhitespaceScalars.contains($0.value) }
    ))
  }

  /// JS `String.prototype.replace(pattern, '')` — 첫 일치 하나만 지운다.
  func replacingFirstOccurrence(of candidates: [String], with replacement: String) -> String {
    var earliest: Range<String.Index>?
    for candidate in candidates {
      guard let found = range(of: candidate) else { continue }
      if let best = earliest, found.lowerBound >= best.lowerBound { continue }
      earliest = found
    }
    guard let earliest else { return self }
    return replacingCharacters(in: earliest, with: replacement)
  }
}

/// JS `new Date(year, monthIndex, day, hour, minute)` 와 같은 정규화를 한다.
/// 달·일이 범위를 넘으면 `Calendar` 가 넘겨준다(13월 → 이듬해 1월, 2월 30일 → 3월 2일).
/// 두 자리 연도 매핑은 하지 않는다 — `setFullYear` 계열용.
private func makeDate(
  _ calendar: Calendar,
  year: Int,
  monthIndex: Int,
  day: Int,
  hour: Int = 0,
  minute: Int = 0
) -> Date? {
  var components = DateComponents()
  components.year = year
  components.month = monthIndex + 1
  components.day = day
  components.hour = hour
  components.minute = minute
  components.second = 0
  components.nanosecond = 0
  return calendar.date(from: components)
}

/// 위와 같되 JS 생성자의 "연도 0–99 는 1900 년대" 규칙까지 재현한다.
private func makeJSDate(_ calendar: Calendar, year: Int, monthIndex: Int, day: Int) -> Date? {
  makeDate(
    calendar,
    year: (0...99).contains(year) ? 1900 + year : year,
    monthIndex: monthIndex,
    day: day
  )
}

private struct JSCalendar {
  let calendar: Calendar

  func startOfDay(_ date: Date) -> Date { calendar.startOfDay(for: date) }
  func year(_ date: Date) -> Int { calendar.component(.year, from: date) }
  func monthIndex(_ date: Date) -> Int { calendar.component(.month, from: date) - 1 }
  func day(_ date: Date) -> Int { calendar.component(.day, from: date) }
  /// JS `getDay()` 와 같은 0=일요일.
  func weekday(_ date: Date) -> Int { calendar.component(.weekday, from: date) - 1 }

  func addingDays(_ date: Date, _ count: Int) -> Date {
    calendar.date(byAdding: .day, value: count, to: date) ?? date
  }

  /// date-fns `addMonths` 와 같이 말일을 넘기지 않고 자른다(1/31 + 1개월 = 2/28).
  func addingMonths(_ date: Date, _ count: Int) -> Date {
    calendar.date(byAdding: .month, value: count, to: date) ?? date
  }
}

private func buildFullDate(
  _ jsCal: JSCalendar,
  year: String,
  month: String,
  day: String
) -> Date? {
  guard let rawYear = Int(year), let rawMonth = Int(month), let dayOfMonth = Int(day) else {
    return nil
  }
  let fullYear = year.count == 2 ? 2000 + rawYear : rawYear
  let monthIndex = rawMonth - 1
  guard
    let date = makeJSDate(jsCal.calendar, year: fullYear, monthIndex: monthIndex, day: dayOfMonth)
  else { return nil }

  if jsCal.year(date) != fullYear
    || jsCal.monthIndex(date) != monthIndex
    || jsCal.day(date) != dayOfMonth {
    return nil
  }
  return date
}

private func buildMonthDayDate(
  _ jsCal: JSCalendar,
  month: Int,
  day: Int,
  baseDate: Date
) -> Date? {
  let year = jsCal.year(baseDate)
  guard let date = makeDate(jsCal.calendar, year: year, monthIndex: month - 1, day: day) else {
    return nil
  }
  if jsCal.monthIndex(date) != month - 1 || jsCal.day(date) != day { return nil }

  if date < jsCal.startOfDay(baseDate) {
    // 내년으로 넘길 때 2월 29일이 3월 1일로 밀리는 것을 막는다.
    guard
      let nextYear = makeDate(jsCal.calendar, year: year + 1, monthIndex: month - 1, day: day),
      jsCal.monthIndex(nextYear) == month - 1,
      jsCal.day(nextYear) == day
    else { return nil }
    return nextYear
  }
  return date
}

/// 월 없는 단독 일자(24일): 이번 달 N일. 오늘 날짜 이하(당일 포함)면 다음 달로
/// 넘긴다("오늘 마감"은 보통 "오늘"이라 쓰므로 지난 것으로 간주). 대상 달에 그
/// 날이 없으면(2월 30일 등) 무효.
private func buildBareDayDate(_ jsCal: JSCalendar, day: Int, baseDate: Date) -> Date? {
  let base = jsCal.startOfDay(baseDate)
  let monthIndex = jsCal.monthIndex(base) + (day <= jsCal.day(base) ? 1 : 0)
  guard
    let target = makeDate(jsCal.calendar, year: jsCal.year(base), monthIndex: monthIndex, day: day)
  else { return nil }
  return jsCal.day(target) == day ? target : nil
}

private func buildWeekdayDate(
  _ jsCal: JSCalendar,
  weekdayText: String,
  baseDate: Date,
  prefix: String?
) -> Date? {
  let today = jsCal.startOfDay(baseDate)
  guard let targetDay = weekdayIndex[weekdayText] else { return nil }
  let currentDay = jsCal.weekday(today)

  let normalizedPrefix = prefix?.removingJSWhitespace()
  // 과거 방향은 미래 날짜로 오인하지 않도록 인식에서 제외한다.
  if normalizedPrefix == "지난주" || normalizedPrefix == "저번주" { return nil }

  var dayDelta = (targetDay - currentDay + 7) % 7

  if normalizedPrefix == "다음주" || normalizedPrefix == "담주" {
    dayDelta = dayDelta == 0 ? 7 : dayDelta + 7
  } else if normalizedPrefix == "다다음주" {
    dayDelta = dayDelta == 0 ? 14 : dayDelta + 14
  } else if normalizedPrefix == nil, dayDelta == 0 {
    // 접두사 없는 단독 요일이 오늘 요일과 같으면 돌아오는 다음 주로 본다.
    // ("이번 주 수요일"처럼 접두사가 있으면 오늘 그대로.)
    dayDelta = 7
  }

  return jsCal.addingDays(today, dayDelta)
}

private struct ScheduledTime {
  let date: Date
  let length: Int
  let hasTime: Bool
}

private func withParsedTime(
  _ jsCal: JSCalendar,
  text: NSString,
  date: Date,
  matchIndex: Int,
  matchLength: Int
) -> ScheduledTime {
  let remaining = text.substring(from: matchIndex + matchLength) as NSString
  guard
    let timeMatch = timeAfterRegex.firstMatch(
      in: remaining as String,
      range: NSRange(location: 0, length: remaining.length)
    ),
    let hourText = timeMatch.group(2, in: remaining),
    var hour = Int(hourText)
  else {
    return ScheduledTime(date: date, length: matchLength, hasTime: false)
  }

  let isHalf = timeMatch.group(4, in: remaining) == "반"
  let minuteText = timeMatch.group(3, in: remaining) ?? timeMatch.group(5, in: remaining)
  let minute = isHalf ? 30 : (minuteText.flatMap(Int.init) ?? 0)

  if hour > 24 || minute > 59 {
    return ScheduledTime(date: date, length: matchLength, hasTime: false)
  }

  if let ampm = timeMatch.group(1, in: remaining) {
    if ["오후", "저녁", "밤"].contains(ampm), hour < 12 {
      hour += 12
    } else if ["오전", "아침", "새벽"].contains(ampm), hour == 12 {
      hour = 0
    } else if ampm == "낮", hour < 8 {
      hour += 12
    }
  } else if hour >= 1, hour <= 5 {
    hour += 12
  }

  if hour == 24, minute != 0 {
    return ScheduledTime(date: date, length: matchLength, hasTime: false)
  }

  guard
    let scheduled = makeDate(
      jsCal.calendar,
      year: jsCal.year(date),
      monthIndex: jsCal.monthIndex(date),
      day: jsCal.day(date) + (hour == 24 ? 1 : 0),
      hour: hour == 24 ? 0 : hour,
      minute: minute
    )
  else {
    return ScheduledTime(date: date, length: matchLength, hasTime: false)
  }

  return ScheduledTime(
    date: scheduled,
    length: matchLength + timeMatch.range.length,
    hasTime: true
  )
}

private func buildEnglishMonthDayDate(
  _ jsCal: JSCalendar,
  monthText: String,
  dayText: String,
  yearText: String?,
  baseDate: Date
) -> Date? {
  guard
    let month = englishMonthNames[String(monthText.lowercased().prefix(3))],
    let day = Int(dayText)
  else { return nil }
  let year = yearText.flatMap(Int.init) ?? jsCal.year(baseDate)
  guard var date = makeJSDate(jsCal.calendar, year: year, monthIndex: month, day: day) else {
    return nil
  }

  if jsCal.monthIndex(date) != month || jsCal.day(date) != day { return nil }

  if yearText == nil, date < baseDate {
    // JS `setFullYear(getFullYear() + 1)` — 두 자리 연도 규칙은 다시 적용되지 않는다.
    guard
      let nextYear = makeDate(
        jsCal.calendar,
        year: jsCal.year(date) + 1,
        monthIndex: month,
        day: day
      )
    else { return nil }
    date = nextYear
    if jsCal.monthIndex(date) != month || jsCal.day(date) != day { return nil }
  }
  return date
}

private func buildEnglishWeekdayDate(
  _ jsCal: JSCalendar,
  weekday: String,
  prefix: String,
  baseDate: Date
) -> Date? {
  guard let targetDay = englishWeekdays[weekday.lowercased()] else { return nil }
  var delta = (targetDay - jsCal.weekday(baseDate) + 7) % 7
  if prefix.lowercased() == "next" { delta += 7 }
  return jsCal.addingDays(baseDate, delta)
}

private func withParsedEnglishTime(
  _ jsCal: JSCalendar,
  text: NSString,
  date: Date,
  matchIndex: Int,
  matchLength: Int
) -> ScheduledTime {
  let remaining = text.substring(from: matchIndex + matchLength) as NSString
  guard
    let timeMatch = englishTimeAfterRegex.firstMatch(
      in: remaining as String,
      range: NSRange(location: 0, length: remaining.length)
    )
  else {
    return ScheduledTime(date: date, length: matchLength, hasTime: false)
  }

  let special = timeMatch.group(1, in: remaining)?.lowercased()
  var hour: Int
  switch special {
  case "noon": hour = 12
  case "midnight": hour = 0
  default: hour = timeMatch.group(2, in: remaining).flatMap(Int.init) ?? 0
  }
  let minute = special != nil
    ? 0
    : (timeMatch.group(3, in: remaining).flatMap(Int.init) ?? 0)
  let meridiem = timeMatch.group(4, in: remaining)?
    .lowercased()
    .replacingOccurrences(of: ".", with: "")

  if special == nil, let meridiem {
    if meridiem == "pm", hour < 12 { hour += 12 }
    if meridiem == "am", hour == 12 { hour = 0 }
  }
  if hour > 23 || minute > 59 {
    return ScheduledTime(date: date, length: matchLength, hasTime: false)
  }

  guard
    let scheduled = makeDate(
      jsCal.calendar,
      year: jsCal.year(date),
      monthIndex: jsCal.monthIndex(date),
      day: jsCal.day(date),
      hour: hour,
      minute: minute
    )
  else {
    return ScheduledTime(date: date, length: matchLength, hasTime: false)
  }

  return ScheduledTime(
    date: scheduled,
    length: matchLength + timeMatch.range.length,
    hasTime: true
  )
}

// ── Main parser ─────────────────────────────────────────────────

public enum DateParser {
  /// 기기 로컬 시간대 + 그레고리력. `Calendar.current` 를 쓰면 사용자가 달력을
  /// 불교력·일본력으로 바꿔 둔 기기에서 `component(.year)` 가 2569 처럼 나와
  /// 모든 날짜가 버려진다. JS `Date` 는 항상 그레고리력이다.
  public static var deviceCalendar: Calendar {
    var calendar = Calendar(identifier: .gregorian)
    calendar.timeZone = .current
    return calendar
  }

  /// `baseTimestamp` 는 데스크탑과 같이 **기기 로컬 시간대**로 해석한다.
  /// 테스트는 고정 시간대를 담은 `calendar` 를 주입해 픽스처와 맞춘다.
  public static func parseDates(
    _ text: String,
    baseTimestamp: Date = Date(),
    calendar: Calendar? = nil
  ) -> [DateMatch] {
    let calendar = calendar ?? deviceCalendar
    let ns = text as NSString
    let fullRange = NSRange(location: 0, length: ns.length)
    let jsCal = JSCalendar(calendar: calendar)
    let baseDate = jsCal.startOfDay(baseTimestamp)
    var matches: [DateMatch] = []

    func push(_ index: Int, _ kind: DateMatchKind, _ scheduled: ScheduledTime) {
      matches.append(
        DateMatch(
          text: ns.substring(with: NSRange(location: index, length: scheduled.length)),
          date: scheduled.date,
          index: index,
          length: scheduled.length,
          kind: kind,
          hasTime: scheduled.hasTime
        )
      )
    }

    func pushEnglish(_ index: Int, _ length: Int, _ date: Date?) {
      guard let date else { return }
      push(
        index,
        .englishDate,
        withParsedEnglishTime(jsCal, text: ns, date: date, matchIndex: index, matchLength: length)
      )
    }

    func pushKorean(_ index: Int, _ length: Int, _ kind: DateMatchKind, _ date: Date) {
      push(
        index,
        kind,
        withParsedTime(jsCal, text: ns, date: date, matchIndex: index, matchLength: length)
      )
    }

    for m in englishMonthDayRegex.matches(in: text, range: fullRange) {
      pushEnglish(
        m.range.location,
        m.range.length,
        buildEnglishMonthDayDate(
          jsCal,
          monthText: m.group(1, in: ns) ?? "",
          dayText: m.group(2, in: ns) ?? "",
          yearText: m.group(3, in: ns),
          baseDate: baseDate
        )
      )
    }

    for m in englishDayMonthRegex.matches(in: text, range: fullRange) {
      pushEnglish(
        m.range.location,
        m.range.length,
        buildEnglishMonthDayDate(
          jsCal,
          monthText: m.group(2, in: ns) ?? "",
          dayText: m.group(1, in: ns) ?? "",
          yearText: m.group(3, in: ns),
          baseDate: baseDate
        )
      )
    }

    let englishRelativeOffsets = ["today": 0, "tomorrow": 1, "yesterday": -1]
    for m in englishRelativeDateRegex.matches(in: text, range: fullRange) {
      guard
        let word = m.group(1, in: ns)?.lowercased(),
        let offset = englishRelativeOffsets[word]
      else { continue }
      pushEnglish(m.range.location, m.range.length, jsCal.addingDays(baseDate, offset))
    }

    for m in englishOffsetRegex.matches(in: text, range: fullRange) {
      guard let rawCount = m.group(1, in: ns)?.lowercased(), let unit = m.group(2, in: ns)?.lowercased()
      else { continue }
      guard let count = englishNumberWords[rawCount] ?? Int(rawCount) else { continue }
      let date = unit.hasPrefix("month")
        ? jsCal.addingMonths(baseDate, count)
        : jsCal.addingDays(baseDate, count * (unit.hasPrefix("week") ? 7 : 1))
      pushEnglish(m.range.location, m.range.length, date)
    }

    for m in englishWeekdayRegex.matches(in: text, range: fullRange) {
      pushEnglish(
        m.range.location,
        m.range.length,
        buildEnglishWeekdayDate(
          jsCal,
          weekday: m.group(2, in: ns) ?? "",
          prefix: m.group(1, in: ns) ?? "",
          baseDate: baseDate
        )
      )
    }

    // 1. Full numeric dates: 26.03.06, 2026.03.06
    for m in numericDateRegex.matches(in: text, range: fullRange) {
      guard
        let date = buildFullDate(
          jsCal,
          year: m.group(1, in: ns) ?? "",
          month: m.group(2, in: ns) ?? "",
          day: m.group(3, in: ns) ?? ""
        )
      else { continue }
      pushKorean(m.range.location, m.range.length, .numericDate, date)
    }

    // 1-1. Year-explicit Korean dates: 2025년 7월 20일 — 연도가 명시되면 그대로
    // 존중한다. (겹치는 "7월 20일" month-day 매치는 overlap 필터가 걸러낸다.)
    for m in yearMonthDayKRRegex.matches(in: text, range: fullRange) {
      guard
        let date = buildFullDate(
          jsCal,
          year: m.group(1, in: ns) ?? "",
          month: m.group(2, in: ns) ?? "",
          day: m.group(3, in: ns) ?? ""
        )
      else { continue }
      pushKorean(m.range.location, m.range.length, .numericDate, date)
    }

    // 2. Korean month-day: 3월 6일, 이번 달 15일, 다음 달 1일
    for m in monthDayKRRegex.matches(in: text, range: fullRange) {
      var date: Date?

      if let prefix = m.group(1, in: ns) {
        // 이번 달 / 다음 달 N일
        guard let day = m.group(2, in: ns).flatMap(Int.init) else { continue }
        let normalizedPrefix = prefix.removingJSWhitespace()
        var targetMonth = baseDate
        if normalizedPrefix == "다음달" {
          targetMonth = jsCal.addingMonths(baseDate, 1)
        } else if normalizedPrefix == "다다음달" {
          targetMonth = jsCal.addingMonths(baseDate, 2)
        }
        date = makeDate(
          jsCal.calendar,
          year: jsCal.year(targetMonth),
          monthIndex: jsCal.monthIndex(targetMonth),
          day: day
        )
        if let built = date, jsCal.day(built) != day { date = nil }
      } else {
        // N월 N일
        guard
          let month = m.group(3, in: ns).flatMap(Int.init),
          let day = m.group(4, in: ns).flatMap(Int.init)
        else { continue }
        date = buildMonthDayDate(jsCal, month: month, day: day, baseDate: baseDate)
      }

      guard let date else { continue }
      pushKorean(m.range.location, m.range.length, .monthDayKR, date)
    }

    // 3. Relative dates: 오늘, 내일, 모레, 글피, 내일모레
    for m in relativeDateRegex.matches(in: text, range: fullRange) {
      let token = ns.substring(with: m.range)
      guard let delta = relativeDays[token] ?? relativeDays[token.removingJSWhitespace()]
      else { continue }
      pushKorean(m.range.location, m.range.length, .relative, jsCal.addingDays(baseDate, delta))
    }

    // 4. N일 후 / N일 뒤
    for m in nDaysLaterRegex.matches(in: text, range: fullRange) {
      guard let value = m.group(1, in: ns) else { continue }
      let targetDate: Date

      if value.hasSuffix("달") || value.hasSuffix("개월") {
        guard let months = Int(value.replacingFirstOccurrence(of: ["개월", "달"], with: ""))
        else { continue }
        targetDate = jsCal.addingMonths(baseDate, months)
      } else {
        let count: Int?
        if let native = nativeDayCounts[value] {
          count = native
        } else if value.hasSuffix("주") {
          count = Int(value.replacingFirstOccurrence(of: ["주"], with: "")).map { $0 * 7 }
        } else {
          count = Int(value.replacingFirstOccurrence(of: ["일"], with: ""))
        }
        guard let count, count <= 365 else { continue }
        targetDate = jsCal.addingDays(baseDate, count)
      }

      pushKorean(m.range.location, m.range.length, .nDaysLater, targetDate)
    }

    // 5. Weekday: 월요일, 이번 주 금, 다음 주 월
    for m in weekdayRegex.matches(in: text, range: fullRange) {
      let prefix = m.group(1, in: ns)
      guard let weekdayText = m.group(2, in: ns) else { continue }
      // 접두사 없는 한 글자("일 시작", "금 시세")는 요일보다 일반 명사일
      // 가능성이 높아 제외한다. "다음주 월", "월요일", "월욜"은 그대로 인식.
      if prefix == nil, weekdayText.count == 1 { continue }
      guard
        let date = buildWeekdayDate(
          jsCal,
          weekdayText: weekdayText,
          baseDate: baseDate,
          prefix: prefix
        )
      else { continue }
      pushKorean(m.range.location, m.range.length, .weekday, date)
    }

    // 6. Slash dates. 데스크탑의 `language === 'en'` 전용 M/D/Y 블록은 iOS 가
    // 언어 설정을 갖지 않으므로 옮기지 않았다. ko 는 항상 M/D 로 읽는다.
    for m in shortDateRegex.matches(in: text, range: fullRange) {
      guard
        let month = m.group(1, in: ns).flatMap(Int.init),
        let day = m.group(2, in: ns).flatMap(Int.init),
        month >= 1, month <= 12, day >= 1, day <= 31,
        let date = buildMonthDayDate(jsCal, month: month, day: day, baseDate: baseDate)
      else { continue }
      pushKorean(m.range.location, m.range.length, .shortDate, date)
    }

    // 7. Bare day-of-month: 24일 (월 없이). month-day/n-days-later 와 겹치면
    // overlap 필터가 정리하므로 뒤에 둔다.
    for m in bareDayRegex.matches(in: text, range: fullRange) {
      guard
        let day = m.group(1, in: ns).flatMap(Int.init),
        day >= 1, day <= 31,
        let date = buildBareDayDate(jsCal, day: day, baseDate: baseDate)
      else { continue }
      pushKorean(m.range.location, m.range.length, .dayOnly, date)
    }

    // Sort by position and remove overlaps. JS `Array.prototype.sort` 는 안정
    // 정렬이고 `Array.sort()` 는 아니다 — 같은 index 의 매치가 둘이면 순서가
    // 뒤집혀 다른 쪽이 살아남는다. 삽입 순서를 타이브레이커로 쓴다.
    let sorted = matches.enumerated()
      .sorted {
        $0.element.index == $1.element.index
          ? $0.offset < $1.offset
          : $0.element.index < $1.element.index
      }
      .map(\.element)

    // JS 는 **직전 원소**(살아남았는지와 무관)와 비교한다. 마지막으로 살린
    // 매치와 비교하면 결과가 달라진다.
    return sorted.enumerated().filter { pair in
      guard pair.offset > 0 else { return true }
      let previous = sorted[pair.offset - 1]
      return pair.element.index >= previous.index + previous.length
    }.map(\.element)
  }

  /// `cursorIndex` 는 UTF-16 코드 유닛 오프셋이다. 거리가 같으면 앞선 매치가
  /// 이긴다(JS reduce 가 `<` 로만 교체하기 때문).
  public static func findNearestDateMatch(
    _ matches: [DateMatch],
    cursorIndex: Int
  ) -> DateMatch? {
    func distance(to match: DateMatch) -> Int {
      let end = match.index + match.length
      if cursorIndex >= match.index, cursorIndex <= end { return 0 }
      return min(abs(cursorIndex - match.index), abs(cursorIndex - end))
    }

    var nearest: DateMatch?
    for match in matches {
      guard let current = nearest else {
        nearest = match
        continue
      }
      if distance(to: match) < distance(to: current) { nearest = match }
    }
    return nearest
  }
}
