import Foundation

/// 데스크탑 `calendar_blocks` 한 행. 컬럼 이름은 `services/supabase/data.ts` 의
/// `select(...)` 에서 그대로 가져왔다.
///
/// Hashable 은 SwiftUI 의 navigationDestination(item:) 이 요구한다 — 지우지 말 것.
public struct CalendarBlock: Codable, Sendable, Equatable, Hashable, Identifiable {
  /// 데스크탑 `App.tsx` 의 빈 제목 대체값.
  public static let defaultTitle = "새 일정"
  /// 데스크탑 `calendarCategories.ts` 의 DEFAULT_CALENDAR_COLOR.
  public static let defaultColor = "#66705A"

  public let id: String
  public var title: String
  public var note: String?
  public var startDate: Date
  /// 종일 일정이면 항상 nil 이다(데스크탑도 `end_date: null` 을 보낸다).
  public var endDate: Date?
  public var allDay: Bool
  /// 종일 일정이 놓인 **로컬 시간대 기준** `YYYY-MM-DD`. 이 값을 모델에 들고 있는
  /// 이유는 데스크탑 `getBlockStart` 가 종일 일정의 날짜를 `start_date` 가 아니라
  /// 이 컬럼에서 읽기 때문이다. 서울에서 만든 종일 일정을 뉴욕에서 열었을 때
  /// `start_date` 로 다시 계산하면 하루 밀린다.
  public var allDayDate: String?
  public var order: Int
  public var color: String
  public var categoryId: String?
  public var isCompleted: Bool
  public var completedAt: Date?
  public var createdAt: Date
  public var updatedAt: Date

  public init(
    id: String,
    title: String,
    note: String? = nil,
    startDate: Date,
    endDate: Date? = nil,
    allDay: Bool = false,
    allDayDate: String? = nil,
    order: Int = 0,
    color: String = CalendarBlock.defaultColor,
    categoryId: String? = nil,
    isCompleted: Bool = false,
    completedAt: Date? = nil,
    createdAt: Date,
    updatedAt: Date
  ) {
    self.id = id
    self.title = title
    self.note = note
    self.startDate = startDate
    self.endDate = endDate
    self.allDay = allDay
    self.allDayDate = allDayDate
    self.order = order
    self.color = color
    self.categoryId = categoryId
    self.isCompleted = isCompleted
    self.completedAt = completedAt
    self.createdAt = createdAt
    self.updatedAt = updatedAt
  }

  /// 필드가 늘면 합성 디코더는 예전 페이로드에서 통째로 실패하고, 그러면 기기에
  /// 저장돼 있던 일정이 전부 사라진다. 없어도 되는 값은 전부 `decodeIfPresent` 다.
  public init(from decoder: Decoder) throws {
    let c = try decoder.container(keyedBy: CodingKeys.self)
    id = try c.decode(String.self, forKey: .id)
    title = try c.decodeIfPresent(String.self, forKey: .title) ?? Self.defaultTitle
    note = try c.decodeIfPresent(String.self, forKey: .note)
    startDate = try c.decode(Date.self, forKey: .startDate)
    endDate = try c.decodeIfPresent(Date.self, forKey: .endDate)
    allDay = try c.decodeIfPresent(Bool.self, forKey: .allDay) ?? false
    allDayDate = try c.decodeIfPresent(String.self, forKey: .allDayDate)
    order = try c.decodeIfPresent(Int.self, forKey: .order) ?? 0
    color = try c.decodeIfPresent(String.self, forKey: .color) ?? Self.defaultColor
    categoryId = try c.decodeIfPresent(String.self, forKey: .categoryId)
    isCompleted = try c.decodeIfPresent(Bool.self, forKey: .isCompleted) ?? false
    completedAt = try c.decodeIfPresent(Date.self, forKey: .completedAt)
    createdAt = try c.decodeIfPresent(Date.self, forKey: .createdAt) ?? startDate
    updatedAt = try c.decodeIfPresent(Date.self, forKey: .updatedAt) ?? startDate
  }
}

/// 데스크탑 `data.ts` 의 `toLocalCalendarDate`. 거기서는 `getFullYear/getMonth/
/// getDate` 라 **로컬 시간대**로 떨어진다. UTC 로 계산하면 한국에서 오전 9시 이전
/// 일정이 전날로 간다.
public enum LocalCalendarDate {
  /// 시간대를 인자로 받는다 — `Calendar.current` 를 쓰면 달력을 불교력으로 바꿔 둔
  /// 기기에서 연도가 2569 로 나온다(`DateParser.deviceCalendar` 와 같은 이유).
  public static func string(from date: Date, timeZone: TimeZone) -> String {
    var calendar = Calendar(identifier: .gregorian)
    calendar.timeZone = timeZone
    let c = calendar.dateComponents([.year, .month, .day], from: date)
    return String(format: "%04d-%02d-%02d", c.year ?? 0, c.month ?? 0, c.day ?? 0)
  }
}
