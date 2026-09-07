import Foundation

/// 데스크탑 `schedule_inbox` 의 한 행. 메모에서 뽑아낸 일정 후보다.
///
/// 서버가 정본이고 로컬에는 `status = 'pending'` 인 것만 캐시한다 — 비행기 모드에서도
/// 목록과 배지가 보여야 하기 때문이다.
public struct ScheduleInboxItem: Codable, Sendable, Equatable, Hashable, Identifiable {
  public let id: String
  public var memoId: String?
  public var title: String
  public var sourceText: String
  /// 감지된 시각.
  public var scheduledAt: Date
  /// 원문에서 찾은 시각 표현. 없으면 시각이 안 정해진 후보다(데스크탑
  /// `hasScheduledTime` = `!all_day && time_text != nil`).
  public var timeText: String?
  public var allDay: Bool
  /// `'auto'` 또는 `'candidate'`. 서버가 안 채웠으면 nil 이다.
  public var confidence: String?
  public var createdAt: Date?

  public init(
    id: String,
    memoId: String? = nil,
    title: String,
    sourceText: String,
    scheduledAt: Date,
    timeText: String? = nil,
    allDay: Bool = false,
    confidence: String? = nil,
    createdAt: Date? = nil
  ) {
    self.id = id
    self.memoId = memoId
    self.title = title
    self.sourceText = sourceText
    self.scheduledAt = scheduledAt
    self.timeText = timeText
    self.allDay = allDay
    self.confidence = confidence
    self.createdAt = createdAt
  }

  /// 데스크탑 `hasScheduledTime`. 시각이 없으면 종일로 놓는다.
  public var hasTime: Bool { !allDay && timeText != nil }
}

/// 서버 `schedule_inbox` 행. 컬럼 이름은 데스크탑 `fetchScheduleInbox` 의
/// `select(...)` 에서 그대로 가져왔다.
public struct RemoteScheduleInboxRow: Sendable, Equatable, Decodable {
  public let id: String
  public let memoId: String?
  public let title: String
  public let sourceText: String
  public let scheduledAt: String?
  public let timeText: String?
  public let allDay: Bool
  public let confidence: String?
  public let status: String?
  public let createdAt: String?

  enum CodingKeys: String, CodingKey {
    case id
    case memoId = "memo_id"
    case title
    case sourceText = "source_text"
    case scheduledAt = "scheduled_at"
    case timeText = "time_text"
    case allDay = "all_day"
    case confidence
    case status
    case createdAt = "created_at"
  }

  /// nullable 컬럼은 전부 흡수한다 — 한 행이 이상하다고 응답 전체가 깨지면
  /// 수집함이 통째로 안 뜬다.
  public init(from decoder: Decoder) throws {
    let c = try decoder.container(keyedBy: CodingKeys.self)
    id = try c.decode(String.self, forKey: .id)
    memoId = try c.decodeIfPresent(String.self, forKey: .memoId)
    title = try c.decodeIfPresent(String.self, forKey: .title) ?? ""
    sourceText = try c.decodeIfPresent(String.self, forKey: .sourceText) ?? ""
    scheduledAt = try c.decodeIfPresent(String.self, forKey: .scheduledAt)
    timeText = try c.decodeIfPresent(String.self, forKey: .timeText)
    allDay = try c.decodeIfPresent(Bool.self, forKey: .allDay) ?? false
    confidence = try c.decodeIfPresent(String.self, forKey: .confidence)
    status = try c.decodeIfPresent(String.self, forKey: .status)
    createdAt = try c.decodeIfPresent(String.self, forKey: .createdAt)
  }

  /// 시각을 읽을 수 없는 행은 버린다. 데스크탑은 그런 행을 목록에 두고 날짜
  /// 선택기로 고치게 하지만, iOS 에는 그 화면이 없어서 들여봐야 수락할 수 없다.
  public func toItem() -> ScheduleInboxItem? {
    guard let raw = scheduledAt, let scheduled = ServerTimestamp.parse(raw) else { return nil }
    return ScheduleInboxItem(
      id: id, memoId: memoId, title: title, sourceText: sourceText, scheduledAt: scheduled,
      timeText: timeText, allDay: allDay, confidence: confidence,
      createdAt: createdAt.flatMap(ServerTimestamp.parse)
    )
  }
}

/// 아직 서버에 못 올린 수락·무시. 이게 없으면 오프라인에서 수락한 항목이 다음
/// 새로고침 때 되살아나서 같은 일정을 두 번 만들게 된다.
public struct ScheduleInboxAction: Codable, Sendable, Equatable {
  public static let accepted = "accepted"
  public static let dismissed = "dismissed"

  public let id: String
  public let status: String

  public init(id: String, status: String) {
    self.id = id
    self.status = status
  }
}

/// 일정 수집함의 로컬 캐시와 아웃박스.
public final class ScheduleInboxStore: Sendable {
  private let store: LocalStore
  private let ownerId: String

  public init(store: LocalStore, ownerId: String) {
    self.store = store
    self.ownerId = ownerId
  }

  /// 서버와 같은 순서 — 감지된 시각 오름차순.
  public func items() throws -> [ScheduleInboxItem] {
    try store.list(ownerId: ownerId, type: .scheduleInbox)
      .map { try PayloadCoder.decode(ScheduleInboxItem.self, from: $0.payloadJSON) }
      .sorted { $0.scheduledAt < $1.scheduledAt }
  }

  /// 서버 응답으로 캐시를 통째로 갈아끼운다. 다른 기기에서 처리한 항목은 응답에
  /// 없으므로 여기서 같이 사라진다.
  ///
  /// **아직 못 올린 수락·무시가 있는 항목은 다시 넣지 않는다.** 서버는 아직
  /// pending 으로 알고 있어서 응답에 그대로 들어 있다 — 그걸 믿고 되살리면
  /// 사용자가 방금 처리한 항목이 목록에 다시 나타난다.
  public func replace(with items: [ScheduleInboxItem], now: Date = Date()) throws {
    let handled = Set(try pendingActions().map(\.id))
    let incoming = items.filter { !handled.contains($0.id) }
    let keep = Set(incoming.map(\.id))

    for record in try store.list(ownerId: ownerId, type: .scheduleInbox)
    where !keep.contains(record.id) {
      try store.delete(ownerId: ownerId, type: .scheduleInbox, id: record.id)
    }
    for item in incoming {
      try store.upsert(
        LocalRecord(
          ownerId: ownerId, type: .scheduleInbox, id: item.id,
          payloadJSON: try PayloadCoder.encode(item),
          syncStatus: CalendarStore.synced, updatedAt: now
        )
      )
    }
  }

  /// 수락 또는 무시. 목록에서 즉시 빼고, 서버에 올릴 일은 아웃박스에 남긴다.
  public func handle(id: String, status: String, now: Date = Date()) throws {
    try store.upsert(
      LocalRecord(
        ownerId: ownerId, type: .scheduleInboxAction, id: id,
        payloadJSON: try PayloadCoder.encode(ScheduleInboxAction(id: id, status: status)),
        syncStatus: CalendarStore.pending, updatedAt: now
      )
    )
    try store.delete(ownerId: ownerId, type: .scheduleInbox, id: id)
  }

  public func pendingActions() throws -> [ScheduleInboxAction] {
    try store.list(ownerId: ownerId, type: .scheduleInboxAction)
      .map { try PayloadCoder.decode(ScheduleInboxAction.self, from: $0.payloadJSON) }
  }

  /// 서버가 받았다. 아웃박스에서 지운다.
  public func clearAction(id: String) throws {
    try store.delete(ownerId: ownerId, type: .scheduleInboxAction, id: id)
  }
}
