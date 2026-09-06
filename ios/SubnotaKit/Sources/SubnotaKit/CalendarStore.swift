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
  private let timeZone: TimeZone

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
      id: UUID().uuidString, title: title, note: note,
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

  // MARK: - 내부

  private func visibleBlocks() throws -> [CalendarBlock] {
    try entries().filter { $0.syncStatus != Self.pendingDelete }.map(\.block)
  }

  /// 데스크탑 `getBlockStart` — 종일 일정의 날짜는 `start_date` 가 아니라 저장된
  /// `all_day_date` 다. 다른 시간대에서 만든 종일 일정이 하루 밀리지 않는다.
  private func dayKey(_ block: CalendarBlock) -> String {
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
