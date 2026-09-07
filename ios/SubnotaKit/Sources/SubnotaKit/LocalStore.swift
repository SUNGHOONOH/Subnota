import Foundation
import GRDB
import SQLite3

public enum LocalStoreError: Error {
  case unknownRecordType(String)
}

/// 앱이 백그라운드로 갈 때 잠금을 놓게 만드는 스위치. 앱 타겟이 GRDB 를 직접
/// import 하지 않아도 되게 여기서 감싼다. 왜 필요한지는 `LocalStore.init` 의 ③.
public enum LocalStoreSuspension {
  public static func suspend() {
    NotificationCenter.default.post(name: Database.suspendNotification, object: nil)
  }

  public static func resume() {
    NotificationCenter.default.post(name: Database.resumeNotification, object: nil)
  }
}

/// 데스크탑과 같은 범용 단일 테이블. 새 종류의 레코드는 RecordType만 늘리면 되고
/// 스키마 마이그레이션이 필요 없다.
public final class LocalStore: Sendable {
  private let dbQueue: DatabaseQueue

  /// 앱·Share Extension·위젯 확장이 **같은 파일을 동시에** 연다. 아래 설정은
  /// 추측이 아니라 GRDB 의 `Documentation.docc/DatabaseSharing.md`("Sharing a
  /// Database") 를 그대로 따른 것이다. 다음 사람이 같은 조사를 반복하지 않도록
  /// 어느 절이 근거인지 항목마다 적어 둔다.
  public init(path: URL) throws {
    var config = Configuration()

    // ① WAL — "Use the WAL mode".
    // 문서는 `DatabasePool` 을 권하면서 "`DatabaseQueue` 를 `journalMode = .wal`
    // 로 써도 된다"고 같이 적어 두었다. 우리 쓰기는 짧고 드물어 동시 읽기가
    // 필요 없고, 큐를 유지하면 앱 전체가 기대는 직렬 쓰기 가정을 안 건드린다.
    // `PRAGMA journal_mode` 를 직접 쓰지 않는 이유: 이 설정을 쓰면 GRDB 가 WAL 에
    // 딸린 부수 설정까지 같이 맞춰 준다.
    config.journalMode = .wal

    // ② busy timeout — "How to limit the SQLITE_BUSY error".
    // 기본값은 `.immediateError` 라 다른 프로세스가 쓰는 동안이면 곧바로
    // SQLITE_BUSY 를 던진다. 위젯에서 Todo 를 체크하는 순간 앱이 동기화 중이면
    // 그대로 실패한다는 뜻이다. 기다리게 한다.
    config.busyMode = .timeout(5)

    // ③ suspension notifications — "How to limit the 0xDEAD10CC exception".
    // 잠금을 쥔 채 프로세스가 정지되면 OS 가 앱을 죽인다. 이 플래그만으로는
    // 아무 일도 안 일어나고, 앱이 백그라운드로 갈 때 `LocalStoreSuspension.suspend()`
    // 를 불러 줘야 한다(`SubnotaApp`). 대가로 SQLITE_INTERRUPT/ABORT 가 올 수
    // 있는데, 호출부는 이미 모든 저장을 `try` 로 감싸고 안내를 낸다.
    config.observesSuspensionNotifications = true

    config.prepareDatabase { db in
      try db.execute(sql: "PRAGMA synchronous = NORMAL")
      // ④ persistent WAL — "The Specific Case of Read-Only Connections".
      // `-wal`/`-shm` 은 마지막 연결이 닫힐 때 지워질 수 있고, 지워지면 읽기
      // 전용 연결이 아예 열리지 않는다. 위젯은 앱이 죽어 있을 때 읽으므로 이게
      // 정확히 우리 경우다. 이 플래그가 두 파일을 남긴다.
      if db.configuration.readonly == false {
        var flag: CInt = 1
        let code = withUnsafeMutablePointer(to: &flag) { flagP in
          sqlite3_file_control(db.sqliteConnection, nil, SQLITE_FCNTL_PERSIST_WAL, flagP)
        }
        guard code == SQLITE_OK else {
          throw DatabaseError(resultCode: ResultCode(rawValue: code))
        }
      }
    }

    // 문서는 연결 생성을 `NSFileCoordinator` 로 감싸라고도 한다. 여기서는 안
    // 한다: 그건 두 프로세스가 파일을 **처음 만들** 때의 경쟁을 막는 장치인데,
    // 우리 확장들은 앱이 이미 만들어 둔 파일을 열 뿐이고 스키마 변경도 ②의
    // busy timeout 아래 IMMEDIATE 트랜잭션 하나로 직렬화된다. 확장이 빈 컨테이너에
    // 먼저 들어가 DB 를 만드는 경로가 생기면 그때 다시 보라.
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
