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
        syncStatus: "pending", updatedAt: memo.contentUpdatedAt
      )
    )
  }

  public func load(id: String) throws -> Memo? {
    guard let record = try store.fetch(ownerId: ownerId, type: .memo, id: id) else { return nil }
    return try Self.decode(record.payloadJSON)
  }

  public func all() throws -> [Memo] {
    try store.list(ownerId: ownerId, type: .memo).map { try Self.decode($0.payloadJSON) }
  }

  public func delete(id: String) throws {
    try store.delete(ownerId: ownerId, type: .memo, id: id)
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
}
