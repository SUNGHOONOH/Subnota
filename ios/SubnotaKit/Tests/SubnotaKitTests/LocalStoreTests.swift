import Foundation
import Testing
@testable import SubnotaKit

private func makeStore() throws -> LocalStore {
  let dir = URL(fileURLWithPath: NSTemporaryDirectory())
    .appendingPathComponent(UUID().uuidString, isDirectory: true)
  try FileManager.default.createDirectory(at: dir, withIntermediateDirectories: true)
  return try LocalStore(path: dir.appendingPathComponent("test.sqlite3"))
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

@Test func recordTypeRawValuesMatchDesktop() {
  #expect(RecordType.activityCompletion.rawValue == "activity_completion")
  #expect(RecordType.dailyCompletion.rawValue == "daily_completion")
  #expect(RecordType.memoRecovery.rawValue == "memo_recovery")
  #expect(RecordType.scheduleInbox.rawValue == "schedule_inbox")
  #expect(RecordType.scheduleInboxAction.rawValue == "schedule_inbox_action")
}
