import Foundation

/// 데스크탑 `local-database.ts`의 RECORD_TYPES와 rawValue가 일치해야 한다.
/// 값이 어긋나면 같은 Supabase 계정에서 기기 간 데이터가 갈린다.
public enum RecordType: String, Sendable, CaseIterable {
  case memo
  case calendar
  case inbox
  case activityCompletion = "activity_completion"
  case dailyCompletion = "daily_completion"
  case memoRecovery = "memo_recovery"
  case scheduleInbox = "schedule_inbox"
  case scheduleInboxAction = "schedule_inbox_action"
}

public struct LocalRecord: Sendable, Equatable {
  public let ownerId: String
  public let type: RecordType
  public let id: String
  public var payloadJSON: String
  public var syncStatus: String?
  public var updatedAt: Date
  public var isArchived: Bool
  /// 마지막으로 서버가 ack 한 페이로드 — 3-way 병합의 base. nil 이면 아직 안 올라갔다.
  /// 로컬 편집은 `payloadJSON` 만 바꾸고 이 값은 그대로 둬야 병합이 가능하다.
  public var syncedPayloadJSON: String?

  public init(
    ownerId: String, type: RecordType, id: String, payloadJSON: String,
    syncStatus: String? = nil, updatedAt: Date = Date(), isArchived: Bool = false,
    // 기존 호출부가 깨지지 않도록 기본값을 준다.
    syncedPayloadJSON: String? = nil
  ) {
    self.ownerId = ownerId
    self.type = type
    self.id = id
    self.payloadJSON = payloadJSON
    self.syncStatus = syncStatus
    self.updatedAt = updatedAt
    self.isArchived = isArchived
    self.syncedPayloadJSON = syncedPayloadJSON
  }
}
