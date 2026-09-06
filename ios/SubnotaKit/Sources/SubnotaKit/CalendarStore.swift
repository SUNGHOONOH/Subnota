import Foundation

/// 일정 하나와 동기화에 필요한 곁다리 정보. `MemoEntry` 와 달리 병합 base 가 없다 —
/// 캘린더는 3-way 병합을 하지 않는다(데스크탑도 안 한다. last-write-wins).
public struct CalendarEntry: Sendable, Equatable {
  public let block: CalendarBlock
  public let syncStatus: String?

  public init(block: CalendarBlock, syncStatus: String?) {
    self.block = block
    self.syncStatus = syncStatus
  }
}

/// 데스크탑 `activity_completions` 한 행. 블록을 처음 완료했을 때 한 번 생기고
/// 절대 지워지지 않는다 — 체크를 꺼도 남는다.
public struct ActivityCompletion: Codable, Sendable, Equatable {
  public let id: String
  public let calendarBlockId: String
  public let completedAt: Date
  /// **로컬 시간대 기준** `YYYY-MM-DD`.
  public let localDate: String
}

/// 데스크탑 `daily_completions` 한 행. 그 날 Todo 를 전부 끝낸 순간 한 번 생긴다.
public struct DailyCompletion: Codable, Sendable, Equatable {
  public let id: String
  public let localDate: String
  public let completedAt: Date
  /// 하루가 끝난 그 시점의 Todo 총 개수. 나중에 일정이 늘어도 바뀌지 않는다.
  public let todoCount: Int
}

/// 로컬 일정 저장소. `MemoStore` 와 같은 배관이지만 계약이 다르다:
/// 저장은 평범한 upsert, 삭제는 하드 삭제, 충돌 해결은 없다.
public final class CalendarStore: Sendable {
  /// 삭제를 아직 서버에 못 올린 상태. 데스크탑 `local_sync_status` 와 같은 문자열이다.
  public static let pendingDelete = "pending_delete"
  public static let pending = "pending"
  public static let synced = "synced"

  private let store: LocalStore
  private let ownerId: String
  /// 종일 일정의 날짜 경계를 정하는 시간대. 기기 시간대가 기본이고 테스트가 주입한다.
  /// 화면도 같은 시간대로 날짜 키를 만들어야 격자와 저장소가 어긋나지 않는다.
  public let timeZone: TimeZone

  public init(store: LocalStore, ownerId: String, timeZone: TimeZone = .current) {
    self.store = store
    self.ownerId = ownerId
    self.timeZone = timeZone
  }

  public func create(
    title: String,
    startDate: Date,
    endDate: Date? = nil,
    allDay: Bool = false,
    note: String? = nil,
    color: String = CalendarBlock.defaultColor,
    categoryId: String? = nil,
    order: Int = 0,
    now: Date = Date()
  ) throws -> CalendarBlock {
    let block = CalendarBlock(
      // Postgres 는 uuid 를 소문자로 돌려준다. 대문자로 만들면 pull 이 같은 일정을
      // 못 알아보고 로컬에 소문자 사본을 하나 더 만든다 — 화면에 두 번 보인다.
      id: UUID().uuidString.lowercased(), title: title, note: note,
      startDate: startDate, endDate: endDate, allDay: allDay,
      order: order, color: color, categoryId: categoryId,
      createdAt: now, updatedAt: now
    )
    return try save(block, now: now)
  }

  /// 정규화까지 마친 결과를 돌려준다 — 호출자가 저장한 것과 화면에 보이는 것이
  /// 갈리지 않게. 정규화 규칙은 데스크탑 `saveCalendarBlock` 그대로다.
  @discardableResult
  public func save(_ block: CalendarBlock, now: Date = Date()) throws -> CalendarBlock {
    let normalized = normalize(block, now: now)
    try write(normalized, status: Self.pending)
    return normalized
  }

  public func load(id: String) throws -> CalendarBlock? {
    guard let record = try store.fetch(ownerId: ownerId, type: .calendar, id: id) else {
      return nil
    }
    return try PayloadCoder.decode(CalendarBlock.self, from: record.payloadJSON)
  }

  /// 삭제는 서버에서도 하드 삭제다. 오프라인에서도 즉시 사라져야 하므로 행을 바로
  /// 지우지 않고 `pending_delete` 로 표시만 한다 — 그래야 동기화가 서버에서도
  /// 지울 수 있다. 목록에서는 이미 안 보인다.
  public func delete(id: String, now: Date = Date()) throws {
    guard var block = try load(id: id) else { return }
    block.updatedAt = now
    try write(block, status: Self.pendingDelete, archived: true)
  }

  /// 행 자체를 지운다 — 서버 삭제까지 끝났을 때만 부른다.
  public func purge(id: String) throws {
    try store.delete(ownerId: ownerId, type: .calendar, id: id)
  }

  // MARK: - 조회

  /// 그 날(로컬 시간대)의 일정. 시작 시각 순서다.
  /// 삭제 대기 중인 것은 빼고 보여준다.
  public func blocks(on date: Date) throws -> [CalendarBlock] {
    let key = LocalCalendarDate.string(from: date, timeZone: timeZone)
    return try visibleBlocks().filter { dayKey($0) == key }.sorted { $0.startDate < $1.startDate }
  }

  /// 기간 안의 일정. 양 끝 날짜를 **포함**한다 — 월 그리드는 보이는 첫 날과 마지막
  /// 날을 그대로 넘긴다.
  public func blocks(in interval: DateInterval) throws -> [CalendarBlock] {
    let from = LocalCalendarDate.string(from: interval.start, timeZone: timeZone)
    let to = LocalCalendarDate.string(from: interval.end, timeZone: timeZone)
    // YYYY-MM-DD 는 사전순 비교가 곧 날짜순 비교다.
    return try visibleBlocks()
      .filter { dayKey($0) >= from && dayKey($0) <= to }
      .sorted { $0.startDate < $1.startDate }
  }

  // MARK: - 동기화

  /// 동기화가 보는 전체 목록 — 삭제 대기도 들어 있다.
  public func entries() throws -> [CalendarEntry] {
    try store.list(ownerId: ownerId, type: .calendar).map {
      CalendarEntry(
        block: try PayloadCoder.decode(CalendarBlock.self, from: $0.payloadJSON),
        syncStatus: $0.syncStatus
      )
    }
  }

  /// 서버가 푸시를 받아들였다. `pushed` 는 푸시가 나갈 때의 로컬 스냅샷이다 —
  /// 그 사이에 사용자가 더 고쳤으면 방금 고친 내용을 지키고 `pending` 으로 둔다.
  /// 여기서 서버 응답을 덮어쓰면 미는 동안의 편집이 통째로 사라진다.
  public func markSynced(_ acked: CalendarBlock, pushed: CalendarBlock) throws {
    guard let current = try load(id: acked.id), current == pushed else { return }
    try write(acked, status: Self.synced)
  }

  /// pull 이 서버 정본으로 갈아끼운다. `pending`·`pending_delete` 레코드는 호출자가
  /// 걸러야 한다 — 아직 안 올라간 로컬 편집을 여기서 덮으면 그대로 유실이다.
  public func applyRemote(_ block: CalendarBlock) throws {
    try write(block, status: Self.synced)
  }

  // MARK: - 완료 이벤트

  /// Todo 를 체크했을 때 부른다. 데스크탑 `recordGrowthOnComplete` 와 같은 규칙이다:
  /// 블록을 처음 완료하면 `activity`, 그 날 Todo 를 전부 끝냈으면 `daily` 를 남긴다.
  ///
  /// **append-only 이고 멱등이다.** 로컬 레코드 키를 서버의 유일키(activity 는
  /// 블록 id, daily 는 날짜)와 똑같이 잡아서, 몇 번을 불러도 행이 늘지 않는다.
  /// 되돌리는 경로는 없다 — 체크를 꺼도 이벤트는 남는다(데스크탑도 그렇다).
  ///
  /// 호출 전에 블록이 완료 상태로 저장돼 있어야 한다. 하루 완료 판정은 저장소를
  /// 다시 읽어서 하기 때문이다.
  public func recordCompletion(of block: CalendarBlock, now: Date = Date()) throws {
    let localDate = dayKey(block)

    if try store.fetch(ownerId: ownerId, type: .activityCompletion, id: block.id) == nil {
      try writeCompletion(
        .activityCompletion, id: block.id, now: now,
        payload: ActivityCompletion(
          id: Self.newId(), calendarBlockId: block.id, completedAt: now, localDate: localDate
        )
      )
    }

    // 데스크탑 `isDayComplete` — 하나라도 있고 전부 완료여야 한다.
    let dayBlocks = try visibleBlocks().filter { dayKey($0) == localDate }
    guard !dayBlocks.isEmpty, dayBlocks.allSatisfy(\.isCompleted) else { return }
    guard try store.fetch(ownerId: ownerId, type: .dailyCompletion, id: localDate) == nil else {
      return
    }
    try writeCompletion(
      .dailyCompletion, id: localDate, now: now,
      payload: DailyCompletion(
        id: Self.newId(), localDate: localDate, completedAt: now, todoCount: dayBlocks.count
      )
    )
  }

  /// 아직 서버에 못 올린 완료 이벤트. 오프라인에서 쌓였다가 동기화 때 나간다.
  public func pendingActivityCompletions() throws -> [ActivityCompletion] {
    try pendingCompletions(.activityCompletion)
  }

  public func pendingDailyCompletions() throws -> [DailyCompletion] {
    try pendingCompletions(.dailyCompletion)
  }

  /// 서버가 받았다. 페이로드는 그대로 두고 상태만 바꾼다 — 이벤트는 불변이다.
  /// `id` 는 로컬 키다: activity 는 블록 id, daily 는 `local_date`.
  public func markCompletionSynced(_ type: RecordType, id: String) throws {
    guard var record = try store.fetch(ownerId: ownerId, type: type, id: id) else { return }
    record.syncStatus = Self.synced
    try store.upsert(record)
  }

  private func pendingCompletions<T: Decodable>(_ type: RecordType) throws -> [T] {
    try store.list(ownerId: ownerId, type: type)
      .filter { $0.syncStatus != Self.synced }
      .map { try PayloadCoder.decode(T.self, from: $0.payloadJSON) }
  }

  private func writeCompletion<T: Encodable>(
    _ type: RecordType, id: String, now: Date, payload: T
  ) throws {
    try store.upsert(
      LocalRecord(
        ownerId: ownerId, type: type, id: id,
        payloadJSON: try PayloadCoder.encode(payload),
        syncStatus: Self.pending, updatedAt: now
      )
    )
  }

  // MARK: - 내부

  /// Postgres 는 uuid 를 소문자로 돌려준다 — 대문자로 만들면 다음 pull 이 같은 행을
  /// 못 알아본다(일정 id 에서 이미 겪은 함정이다).
  private static func newId() -> String { UUID().uuidString.lowercased() }

  private func visibleBlocks() throws -> [CalendarBlock] {
    try entries().filter { $0.syncStatus != Self.pendingDelete }.map(\.block)
  }

  /// 데스크탑 `getBlockStart` — 종일 일정의 날짜는 `start_date` 가 아니라 저장된
  /// `all_day_date` 다. 다른 시간대에서 만든 종일 일정이 하루 밀리지 않는다.
  /// 월 격자가 날짜별로 묶을 때도 이 규칙을 그대로 써야 한다 — 그래서 public 이다.
  public func dayKey(_ block: CalendarBlock) -> String {
    if block.allDay, let allDayDate = block.allDayDate { return allDayDate }
    return LocalCalendarDate.string(from: block.startDate, timeZone: timeZone)
  }

  private func normalize(_ block: CalendarBlock, now: Date) -> CalendarBlock {
    var next = block
    let title = block.title.trimmingCharacters(in: .whitespacesAndNewlines)
    next.title = title.isEmpty ? CalendarBlock.defaultTitle : title
    // 종일이면 끝 시각이 없고, 아니면 종일 날짜가 없다. 데스크탑과 같은 규칙이다.
    next.endDate = block.allDay ? nil : block.endDate
    next.allDayDate = block.allDay
      ? LocalCalendarDate.string(from: block.startDate, timeZone: timeZone)
      : nil
    next.updatedAt = now
    return next
  }

  private func write(_ block: CalendarBlock, status: String, archived: Bool = false) throws {
    try store.upsert(
      LocalRecord(
        ownerId: ownerId, type: .calendar, id: block.id,
        payloadJSON: try PayloadCoder.encode(block),
        syncStatus: status, updatedAt: block.updatedAt, isArchived: archived
      )
    )
  }
}
