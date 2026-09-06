import Foundation
import GRDB
import Testing
@testable import SubnotaKit

private func makeTempPath() throws -> URL {
  let dir = URL(fileURLWithPath: NSTemporaryDirectory())
    .appendingPathComponent(UUID().uuidString, isDirectory: true)
  try FileManager.default.createDirectory(at: dir, withIntermediateDirectories: true)
  return dir.appendingPathComponent("test.sqlite3")
}

private func makeStore() throws -> LocalStore {
  try LocalStore(path: try makeTempPath())
}

private func makeRecord(
  id: String = "r1",
  owner: String = "user-1",
  payload: String = #"{"content":"hello"}"#,
  updatedAt: Date = Date(timeIntervalSince1970: 1_000)
) -> LocalRecord {
  LocalRecord(
    ownerId: owner, type: .memo, id: id, payloadJSON: payload,
    syncStatus: "pending", updatedAt: updatedAt, isArchived: false
  )
}

@Test func upsertThenFetchRoundTrips() throws {
  let store = try makeStore()
  let record = makeRecord()
  try store.upsert(record)

  let loaded = try store.fetch(ownerId: "user-1", type: .memo, id: "r1")
  #expect(loaded == record)
}

@Test func upsertReplacesOnSamePrimaryKey() throws {
  let store = try makeStore()
  try store.upsert(makeRecord(payload: #"{"content":"first"}"#))
  try store.upsert(makeRecord(payload: #"{"content":"second"}"#))

  let loaded = try store.fetch(ownerId: "user-1", type: .memo, id: "r1")
  #expect(loaded?.payloadJSON == #"{"content":"second"}"#)
  #expect(try store.list(ownerId: "user-1", type: .memo).count == 1)
}

@Test func listIsNewestFirstAndScopedToOwnerAndType() throws {
  let store = try makeStore()
  try store.upsert(makeRecord(id: "old", updatedAt: Date(timeIntervalSince1970: 100)))
  try store.upsert(makeRecord(id: "new", updatedAt: Date(timeIntervalSince1970: 900)))
  try store.upsert(makeRecord(id: "other-owner", owner: "user-2"))

  let ids = try store.list(ownerId: "user-1", type: .memo).map(\.id)
  #expect(ids == ["new", "old"])
  #expect(try store.list(ownerId: "user-1", type: .calendar).isEmpty)
}

@Test func deleteRemovesOnlyThatRecord() throws {
  let store = try makeStore()
  try store.upsert(makeRecord(id: "a"))
  try store.upsert(makeRecord(id: "b"))

  try store.delete(ownerId: "user-1", type: .memo, id: "a")

  #expect(try store.fetch(ownerId: "user-1", type: .memo, id: "a") == nil)
  #expect(try store.fetch(ownerId: "user-1", type: .memo, id: "b") != nil)
}

@Test func syncedPayloadRoundTripsAndDefaultsToNil() throws {
  let store = try makeStore()
  try store.upsert(makeRecord(id: "no-base"))
  #expect(try store.fetch(ownerId: "user-1", type: .memo, id: "no-base")?.syncedPayloadJSON == nil)

  var withBase = makeRecord(id: "with-base")
  withBase.syncedPayloadJSON = #"{"content":"acked"}"#
  try store.upsert(withBase)

  #expect(try store.fetch(ownerId: "user-1", type: .memo, id: "with-base") == withBase)
  #expect(try store.list(ownerId: "user-1", type: .memo)
    .first { $0.id == "with-base" }?.syncedPayloadJSON == #"{"content":"acked"}"#)
}

/// Phase 0+1 이 만든 기기의 DB 에는 synced_payload_json 컬럼이 없다.
/// CREATE TABLE IF NOT EXISTS 는 기존 테이블을 고치지 않으므로, 이 마이그레이션이
/// 빠지면 앱이 켜지자마자 모든 읽기·쓰기가 깨진다.
@Test func opensADatabaseCreatedBeforeTheSyncedPayloadColumn() throws {
  let path = try makeTempPath()
  let legacy = try DatabaseQueue(path: path.path)
  try legacy.write { db in
    try db.execute(sql: """
      CREATE TABLE local_records (
        owner_id TEXT NOT NULL,
        record_type TEXT NOT NULL,
        record_id TEXT NOT NULL,
        payload_json TEXT NOT NULL,
        sync_status TEXT,
        updated_at TEXT NOT NULL,
        is_archived INTEGER NOT NULL DEFAULT 0,
        PRIMARY KEY (owner_id, record_type, record_id)
      )
      """)
    try db.execute(sql: """
      INSERT INTO local_records
        (owner_id, record_type, record_id, payload_json, sync_status, updated_at, is_archived)
      VALUES ('user-1', 'memo', 'legacy', '{"content":"old"}', 'pending',
              '1970-01-01T00:16:40.000Z', 0)
      """)
  }
  try legacy.close()

  let store = try LocalStore(path: path)

  // 옛 행이 그대로 살아 있고, 컬럼은 NULL 로 채워진다.
  let loaded = try store.fetch(ownerId: "user-1", type: .memo, id: "legacy")
  #expect(loaded?.payloadJSON == #"{"content":"old"}"#)
  #expect(loaded?.syncedPayloadJSON == nil)

  // 새 컬럼에 쓰고 읽는 것도 된다.
  var updated = try #require(loaded)
  updated.syncedPayloadJSON = #"{"content":"acked"}"#
  try store.upsert(updated)
  #expect(try store.fetch(ownerId: "user-1", type: .memo, id: "legacy")?.syncedPayloadJSON
    == #"{"content":"acked"}"#)
}

@Test func recordTypeRawValuesMatchDesktop() {
  #expect(RecordType.activityCompletion.rawValue == "activity_completion")
  #expect(RecordType.dailyCompletion.rawValue == "daily_completion")
  #expect(RecordType.memoRecovery.rawValue == "memo_recovery")
  #expect(RecordType.scheduleInbox.rawValue == "schedule_inbox")
  #expect(RecordType.scheduleInboxAction.rawValue == "schedule_inbox_action")
}
