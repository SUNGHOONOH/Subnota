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

  public init(
    ownerId: String, type: RecordType, id: String, payloadJSON: String,
    syncStatus: String? = nil, updatedAt: Date = Date(), isArchived: Bool = false
  ) {
    self.ownerId = ownerId
    self.type = type
    self.id = id
    self.payloadJSON = payloadJSON
    self.syncStatus = syncStatus
    self.updatedAt = updatedAt
    self.isArchived = isArchived
  }
}
