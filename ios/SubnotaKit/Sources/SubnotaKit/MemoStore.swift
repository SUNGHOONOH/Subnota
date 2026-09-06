import Foundation

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
    try store.upsert(
      LocalRecord(
        ownerId: ownerId, type: .memo, id: memo.id,
        payloadJSON: try Self.encode(memo),
        syncStatus: "pending", updatedAt: memo.contentUpdatedAt,
        // 페이로드의 isArchived 와 행의 is_archived 가 갈리면 나중에 어느 쪽이
        // 진실인지 알 수 없다. 항상 여기서 같이 쓴다.
        isArchived: memo.isArchived
      )
    )
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
