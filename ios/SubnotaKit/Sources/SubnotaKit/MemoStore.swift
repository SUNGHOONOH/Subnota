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

  // Unlike LocalStore.iso8601 in Task 1, JSONEncoder/JSONDecoder are already
  // Sendable on this SDK, so no nonisolated(unsafe) escape hatch is needed here.
  private static let encoder: JSONEncoder = {
    let e = JSONEncoder()
    e.dateEncodingStrategy = .iso8601
    return e
  }()

  private static let decoder: JSONDecoder = {
    let d = JSONDecoder()
    d.dateDecodingStrategy = .iso8601
    return d
  }()

  private static func encode(_ memo: Memo) throws -> String {
    String(decoding: try encoder.encode(memo), as: UTF8.self)
  }

  private static func decode(_ json: String) throws -> Memo {
    try decoder.decode(Memo.self, from: Data(json.utf8))
  }
}
