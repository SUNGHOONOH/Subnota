import Foundation
import GRDB

public enum LocalStoreError: Error {
  case unknownRecordType(String)
}

/// 데스크탑과 같은 범용 단일 테이블. 새 종류의 레코드는 RecordType만 늘리면 되고
/// 스키마 마이그레이션이 필요 없다.
public final class LocalStore: Sendable {
  private let dbQueue: DatabaseQueue

  public init(path: URL) throws {
    var config = Configuration()
    // 위젯 확장과 본 앱이 같은 파일을 열기 때문에 WAL이 필요하다.
    config.prepareDatabase { db in
      try db.execute(sql: "PRAGMA journal_mode = WAL")
      try db.execute(sql: "PRAGMA synchronous = NORMAL")
    }
    dbQueue = try DatabaseQueue(path: path.path, configuration: config)
    try migrate()
  }

  private func migrate() throws {
    try dbQueue.write { db in
      try db.execute(sql: """
        CREATE TABLE IF NOT EXISTS local_records (
          owner_id TEXT NOT NULL,
          record_type TEXT NOT NULL,
          record_id TEXT NOT NULL,
          payload_json TEXT NOT NULL,
          sync_status TEXT,
          updated_at TEXT NOT NULL,
          is_archived INTEGER NOT NULL DEFAULT 0,
          synced_payload_json TEXT,
          PRIMARY KEY (owner_id, record_type, record_id)
        )
        """)
      try db.execute(sql: """
        CREATE INDEX IF NOT EXISTS idx_local_records_owner_type_updated
          ON local_records (owner_id, record_type, updated_at DESC)
        """)
      // Phase 0+1 기기에는 이 컬럼이 없는 테이블이 이미 있다. CREATE TABLE IF NOT
      // EXISTS 는 기존 테이블을 고치지 않으므로, 없을 때만 따로 더한다.
      let columns = try db.columns(in: "local_records").map(\.name)
      if !columns.contains("synced_payload_json") {
        try db.execute(sql: "ALTER TABLE local_records ADD COLUMN synced_payload_json TEXT")
      }
    }
  }

  public func upsert(_ record: LocalRecord) throws {
    try dbQueue.write { db in
      try db.execute(sql: """
        INSERT INTO local_records
          (owner_id, record_type, record_id, payload_json, sync_status, updated_at,
           is_archived, synced_payload_json)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT (owner_id, record_type, record_id) DO UPDATE SET
          payload_json        = excluded.payload_json,
          sync_status         = excluded.sync_status,
          updated_at          = excluded.updated_at,
          is_archived         = excluded.is_archived,
          synced_payload_json = excluded.synced_payload_json
        """, arguments: [
          record.ownerId, record.type.rawValue, record.id, record.payloadJSON,
          record.syncStatus, Self.iso8601.string(from: record.updatedAt),
          record.isArchived ? 1 : 0, record.syncedPayloadJSON
        ])
    }
  }

  public func fetch(ownerId: String, type: RecordType, id: String) throws -> LocalRecord? {
    try dbQueue.read { db in
      let row = try Row.fetchOne(db, sql: """
        SELECT * FROM local_records
        WHERE owner_id = ? AND record_type = ? AND record_id = ?
        """, arguments: [ownerId, type.rawValue, id])
      return try row.map(Self.decode)
    }
  }

  public func list(ownerId: String, type: RecordType) throws -> [LocalRecord] {
    try dbQueue.read { db in
      let rows = try Row.fetchAll(db, sql: """
        SELECT * FROM local_records
        WHERE owner_id = ? AND record_type = ?
        ORDER BY updated_at DESC
        """, arguments: [ownerId, type.rawValue])
      return try rows.map(Self.decode)
    }
  }

  public func delete(ownerId: String, type: RecordType, id: String) throws {
    try dbQueue.write { db in
      try db.execute(sql: """
        DELETE FROM local_records
        WHERE owner_id = ? AND record_type = ? AND record_id = ?
        """, arguments: [ownerId, type.rawValue, id])
    }
  }

  /// 그 owner 의 모든 레코드를 지운다 — 계정 삭제와 계정 전환용.
  /// `RecordType` 을 순회하지 않는 것이 요점이다. 종류가 늘어도 이 문장은 그대로 전부
  /// 지운다. 특히 `memo_recovery` 에는 병합에서 밀려난 메모 본문이 남아 있어서, 한
  /// 종류라도 새면 다음으로 로그인한 계정이 남의 메모를 보게 된다.
  public func clearOwner(_ ownerId: String) throws {
    try dbQueue.write { db in
      try db.execute(sql: "DELETE FROM local_records WHERE owner_id = ?", arguments: [ownerId])
    }
  }

  // ISO8601DateFormatter is only read (string/date) after setup here, never mutated
  // again, so concurrent use is safe even though the type predates Sendable.
  private nonisolated(unsafe) static let iso8601: ISO8601DateFormatter = {
    let f = ISO8601DateFormatter()
    f.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
    return f
  }()

  private static func decode(_ row: Row) throws -> LocalRecord {
    let raw: String = row["record_type"]
    guard let type = RecordType(rawValue: raw) else {
      throw LocalStoreError.unknownRecordType(raw)
    }
    let stamp: String = row["updated_at"]
    let archived: Int = row["is_archived"]
    return LocalRecord(
      ownerId: row["owner_id"],
      type: type,
      id: row["record_id"],
      payloadJSON: row["payload_json"],
      syncStatus: row["sync_status"],
      updatedAt: iso8601.date(from: stamp) ?? .distantPast,
      isArchived: archived != 0,
      syncedPayloadJSON: row["synced_payload_json"]
    )
  }
}
