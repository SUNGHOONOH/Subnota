import Foundation

/// 서버 `calendar_blocks` 행. 컬럼 이름은 데스크탑 `data.ts` 의 `select(...)` 에서
/// 그대로 가져왔다. 하나라도 어긋나면 PostgREST 가 통째로 에러를 낸다.
///
/// 네트워크를 모르는 값 타입이라 SubnotaKit 에 둔다 — 시뮬레이터 없이 디코딩을
/// 테스트할 수 있다(`RemoteMemo` 와 같은 이유).
public struct RemoteCalendarBlock: Sendable, Equatable, Decodable {
  public let id: String
  public let title: String
  public let note: String?
  public let startDate: Date
  public let endDate: Date?
  public let allDay: Bool
  public let allDayDate: String?
  public let order: Int
  public let color: String
  public let categoryId: String?
  public let isCompleted: Bool
  public let completedAt: Date?
  public let createdAt: Date
  public let updatedAt: Date

  enum CodingKeys: String, CodingKey {
    case id
    case title
    case note
    case startDate = "start_date"
    case endDate = "end_date"
    case allDay = "all_day"
    case allDayDate = "all_day_date"
    case order
    case color
    case categoryId = "category_id"
    case isCompleted = "is_completed"
    case completedAt = "completed_at"
    case createdAt = "created_at"
    case updatedAt = "updated_at"
  }

  /// 날짜를 `Date` 가 아니라 문자열로 받아 직접 파싱한다 — 바깥 JSONDecoder 의
  /// dateDecodingStrategy 가 무엇이든 결과가 같다(`RemoteMemo` 와 같은 이유).
  /// nullable 컬럼(`CalendarBlockRow` 참고)은 전부 기본값으로 흡수한다.
  public init(from decoder: Decoder) throws {
    let c = try decoder.container(keyedBy: CodingKeys.self)
    id = try c.decode(String.self, forKey: .id)
    title = try c.decodeIfPresent(String.self, forKey: .title) ?? CalendarBlock.defaultTitle
    note = try c.decodeIfPresent(String.self, forKey: .note)
    allDay = try c.decodeIfPresent(Bool.self, forKey: .allDay) ?? false
    allDayDate = try c.decodeIfPresent(String.self, forKey: .allDayDate)
    order = try c.decodeIfPresent(Int.self, forKey: .order) ?? 0
    color = try c.decodeIfPresent(String.self, forKey: .color) ?? CalendarBlock.defaultColor
    categoryId = try c.decodeIfPresent(String.self, forKey: .categoryId)
    isCompleted = try c.decodeIfPresent(Bool.self, forKey: .isCompleted) ?? false
    startDate = try Self.date(in: c, forKey: .startDate)
    endDate = try Self.optionalDate(in: c, forKey: .endDate)
    completedAt = try Self.optionalDate(in: c, forKey: .completedAt)
    createdAt = try Self.date(in: c, forKey: .createdAt)
    updatedAt = try Self.date(in: c, forKey: .updatedAt)
  }

  /// 서버 행을 로컬 일정으로. **id 는 그대로 쓴다** — 새 id 를 만들면 같은 일정이
  /// 두 개가 된다.
  public func toBlock() -> CalendarBlock {
    CalendarBlock(
      id: id, title: title, note: note, startDate: startDate, endDate: endDate,
      allDay: allDay, allDayDate: allDayDate, order: order, color: color,
      categoryId: categoryId, isCompleted: isCompleted, completedAt: completedAt,
      createdAt: createdAt, updatedAt: updatedAt
    )
  }

  private static func date(
    in c: KeyedDecodingContainer<CodingKeys>, forKey key: CodingKeys
  ) throws -> Date {
    try parse(try c.decode(String.self, forKey: key), forKey: key, in: c)
  }

  private static func optionalDate(
    in c: KeyedDecodingContainer<CodingKeys>, forKey key: CodingKeys
  ) throws -> Date? {
    guard let raw = try c.decodeIfPresent(String.self, forKey: key) else { return nil }
    return try parse(raw, forKey: key, in: c)
  }

  private static func parse(
    _ raw: String, forKey key: CodingKeys, in c: KeyedDecodingContainer<CodingKeys>
  ) throws -> Date {
    guard let date = ServerTimestamp.parse(raw) else {
      throw DecodingError.dataCorruptedError(
        forKey: key, in: c, debugDescription: "Invalid ISO8601 date: \(raw)"
      )
    }
    return date
  }
}
