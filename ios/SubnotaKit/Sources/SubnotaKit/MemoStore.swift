import Foundation

/// 메모 하나와 동기화에 필요한 곁다리 정보. 동기화 코드는 이것만 보면 된다 —
/// `LocalRecord` 자체를 밖으로 내보내지 않는다.
public struct MemoEntry: Sendable, Equatable {
  public let memo: Memo
  public let syncStatus: String?
  /// 마지막으로 서버가 ack 한 내용. nil 이면 서버에 아직 없다 → 병합할 base 가 없다.
  public let syncedBase: Memo?

  public init(memo: Memo, syncStatus: String?, syncedBase: Memo?) {
    self.memo = memo
    self.syncStatus = syncStatus
    self.syncedBase = syncedBase
  }
}

public final class MemoStore: Sendable {
  private let store: LocalStore
  private let ownerId: String

  public init(store: LocalStore, ownerId: String) {
    self.store = store
    self.ownerId = ownerId
  }

  public func create(content: String, category: String?, now: Date = Date()) throws -> Memo {
    let memo = Memo(
      id: UUID().uuidString, content: content, category: category,
      createdAt: now, contentUpdatedAt: now
    )
    try save(memo)
    return memo
  }

  public func save(_ memo: Memo) throws {
    // 로컬 편집은 base 를 건드리지 않는다. 여기서 흘리면 3-way 병합이 불가능해지고
    // 다음 푸시가 서버 변경을 통째로 덮어쓴다.
    let base = try store.fetch(ownerId: ownerId, type: .memo, id: memo.id)?.syncedPayloadJSON
    try write(memo, baseJSON: base, status: "pending")
  }

  public func load(id: String) throws -> Memo? {
    guard let record = try store.fetch(ownerId: ownerId, type: .memo, id: id) else { return nil }
    return try Self.decode(record.payloadJSON)
  }

  /// 목록. 휴지통에 있는 것은 빼고 최근 수정순(LocalStore.list 의 updated_at DESC).
  public func all() throws -> [Memo] {
    try allMemos().filter { !$0.isArchived }
  }

  /// 휴지통. moveToTrash 가 contentUpdatedAt = now 로 갱신하므로 같은 정렬이
  /// 그대로 "최근 삭제순"이 된다.
  public func trashed() throws -> [Memo] {
    try allMemos().filter(\.isArchived)
  }

  public func moveToTrash(id: String, now: Date) throws {
    try setArchived(id: id, to: true, now: now)
  }

  public func restore(id: String, now: Date) throws {
    try setArchived(id: id, to: false, now: now)
  }

  /// 행 자체를 지운다 — 휴지통 비우기. 되돌릴 수 없다.
  public func purge(id: String) throws {
    try store.delete(ownerId: ownerId, type: .memo, id: id)
  }

  // MARK: - 동기화

  /// 동기화가 보는 전체 목록 — 휴지통 것도 들어 있다.
  public func entries() throws -> [MemoEntry] {
    try store.list(ownerId: ownerId, type: .memo).map {
      MemoEntry(
        memo: try Self.decode($0.payloadJSON),
        syncStatus: $0.syncStatus,
        syncedBase: try $0.syncedPayloadJSON.map(Self.decode)
      )
    }
  }

  /// 서버가 푸시를 받아들였다. `base` 는 **서버가 실제로 갖고 있는 내용**이다 —
  /// 안 올린 내용을 base 로 삼으면 다음 푸시가 서버 원문을 잘못 병합한다.
  ///
  /// 미는 사이에 사용자가 더 고쳤으면 내용은 건드리지 않고 base 만 갱신한다.
  /// 안 그러면 방금 친 글자가 조용히 사라진다.
  public func markSynced(_ acked: Memo, base: Memo?) throws {
    let baseJSON = try base.map(Self.encode)
    if let current = try load(id: acked.id), current.contentUpdatedAt > acked.contentUpdatedAt {
      try write(current, baseJSON: baseJSON, status: "pending")
    } else {
      try write(acked, baseJSON: baseJSON, status: "synced")
    }
  }

  /// pull 이 서버 정본으로 갈아끼운다. `pending` 레코드는 호출자가 걸러야 한다 —
  /// 아직 안 올라간 로컬 편집을 여기서 덮으면 그대로 유실이다.
  public func applyRemote(_ memo: Memo) throws {
    try write(memo, baseJSON: try Self.encode(memo), status: "synced")
  }

  /// 병합으로 못 푼 충돌에서 밀려난 쪽을 숨은 복구 기록으로 남긴다. 목록에는
  /// 안 보이므로 중복 노트가 생기지 않는다. 데스크탑
  /// `preserveLocalMemoRecovery` 와 같은 페이로드다.
  public func preserveRecovery(
    memoId: String, content: String, source: String,
    sourceUpdatedAt: Date?, now: Date = Date()
  ) throws {
    let contentHash = ContentHash.hash(content)
    let stamp = Self.iso8601.string(from: now)
    let payload = RecoveryPayload(
      content: content,
      contentHash: contentHash,
      createdAt: stamp,
      // 데스크탑과 같은 결정적 id — 같은 내용을 두 번 남겨도 행이 늘지 않는다.
      id: "\(memoId):\(contentHash)",
      memoId: memoId,
      source: source,
      sourceUpdatedAt: sourceUpdatedAt.map(Self.iso8601.string(from:)),
      updatedAt: stamp
    )
    try store.upsert(
      LocalRecord(
        ownerId: ownerId, type: .memoRecovery, id: payload.id,
        payloadJSON: String(decoding: try Self.recoveryEncoder.encode(payload), as: UTF8.self),
        syncStatus: "local", updatedAt: now
      )
    )
  }

  private func write(_ memo: Memo, baseJSON: String?, status: String) throws {
    try store.upsert(
      LocalRecord(
        ownerId: ownerId, type: .memo, id: memo.id,
        payloadJSON: try Self.encode(memo),
        syncStatus: status, updatedAt: memo.contentUpdatedAt,
        // 페이로드의 isArchived 와 행의 is_archived 가 갈리면 나중에 어느 쪽이
        // 진실인지 알 수 없다. 항상 여기서 같이 쓴다.
        isArchived: memo.isArchived,
        syncedPayloadJSON: baseJSON
      )
    )
  }

  /// 데스크탑 `LocalMemoRecovery` 와 같은 snake_case 키를 낸다.
  private struct RecoveryPayload: Encodable {
    let content: String
    let contentHash: String
    let createdAt: String
    let id: String
    let memoId: String
    let source: String
    let sourceUpdatedAt: String?
    let updatedAt: String
  }

  private static let recoveryEncoder: JSONEncoder = {
    let e = JSONEncoder()
    e.keyEncodingStrategy = .convertToSnakeCase
    return e
  }()

  private func allMemos() throws -> [Memo] {
    try store.list(ownerId: ownerId, type: .memo).map { try Self.decode($0.payloadJSON) }
  }

  private func setArchived(id: String, to archived: Bool, now: Date) throws {
    guard var memo = try load(id: id) else { return }
    memo.isArchived = archived
    memo.contentUpdatedAt = now
    // save 가 syncStatus = "pending" 을 붙인다 — 서버에도 is_archived 가 전달된다.
    try save(memo)
  }

  // JSONEncoder/JSONDecoder are already Sendable on this SDK (unlike
  // LocalStore.iso8601 in Task 1), so no nonisolated(unsafe) escape hatch is
  // needed for them. But the plain `.iso8601` strategy drops fractional
  // seconds, silently truncating createdAt/contentUpdatedAt on every
  // save→load round-trip. Mirror LocalStore's ISO8601DateFormatter
  // (.withInternetDateTime + .withFractionalSeconds) via a custom strategy so
  // JSON payload precision matches the SQL updated_at column and the
  // Electron app's toISOString() output.
  //
  // ISO8601DateFormatter itself predates Sendable, but it is only read
  // (string/date) after setup here, never mutated again, so concurrent use
  // is safe despite nonisolated(unsafe).
  private nonisolated(unsafe) static let iso8601: ISO8601DateFormatter = {
    let f = ISO8601DateFormatter()
    f.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
    return f
  }()

  private static let encoder: JSONEncoder = {
    let e = JSONEncoder()
    e.dateEncodingStrategy = .custom { date, encoder in
      var container = encoder.singleValueContainer()
      try container.encode(iso8601.string(from: date))
    }
    return e
  }()

  private static let decoder: JSONDecoder = {
    let d = JSONDecoder()
    d.dateDecodingStrategy = .custom { decoder in
      let container = try decoder.singleValueContainer()
      let raw = try container.decode(String.self)
      guard let date = iso8601.date(from: raw) else {
        throw DecodingError.dataCorruptedError(
          in: container, debugDescription: "Invalid ISO8601 date: \(raw)"
        )
      }
      return date
    }
    return d
  }()

  private static func encode(_ memo: Memo) throws -> String {
    String(decoding: try encoder.encode(memo), as: UTF8.self)
  }

  private static func decode(_ json: String) throws -> Memo {
    try decoder.decode(Memo.self, from: Data(json.utf8))
  }

  /// 테스트에서 저장된 페이로드 형식을 직접 검증하기 위한 통로. 프로덕션 API 아님.
  static func decodeForTesting(_ json: String) throws -> Memo { try decode(json) }
}
