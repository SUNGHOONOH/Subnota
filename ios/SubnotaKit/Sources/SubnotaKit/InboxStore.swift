import Foundation

/// 링크 목록의 로컬 캐시. 서버가 정본이라 아웃박스가 없다 — 좋아요·삭제·재시도는
/// 백엔드가 성공한 뒤에만 캐시에 반영한다(`ScheduleInboxStore` 와 다른 점이다.
/// 저기는 오프라인 수락을 살려야 해서 아웃박스가 있다).
public final class InboxStore: Sendable {
  private let store: LocalStore
  private let ownerId: String

  public init(store: LocalStore, ownerId: String) {
    self.store = store
    self.ownerId = ownerId
  }

  /// 최신이 위. 공유한 링크가 목록 맨 위에 있어야 한다.
  public func sessions() throws -> [InboxSession] {
    try store.list(ownerId: ownerId, type: .inbox)
      .map { try PayloadCoder.decode(InboxSession.self, from: $0.payloadJSON) }
      .sorted { $0.createdAt > $1.createdAt }
  }

  /// 서버 응답으로 캐시를 통째로 갈아끼운다. 다른 기기에서 지운 항목은 응답에
  /// 없으므로 여기서 같이 사라진다.
  public func replace(with sessions: [InboxSession], now: Date = Date()) throws {
    let keep = Set(sessions.map(\.id))
    for record in try store.list(ownerId: ownerId, type: .inbox) where !keep.contains(record.id) {
      try store.delete(ownerId: ownerId, type: .inbox, id: record.id)
    }
    for session in sessions {
      try upsert(session, now: now)
    }
  }

  /// 한 건만 갱신한다 — 좋아요 토글과 요약 재시도가 쓴다.
  public func upsert(_ session: InboxSession, now: Date = Date()) throws {
    try store.upsert(
      LocalRecord(
        ownerId: ownerId, type: .inbox, id: session.id,
        payloadJSON: try PayloadCoder.encode(session),
        syncStatus: CalendarStore.synced, updatedAt: now
      )
    )
  }

  public func delete(id: String) throws {
    try store.delete(ownerId: ownerId, type: .inbox, id: id)
  }
}
