import Foundation
import Testing
@testable import SubnotaKit

private func makeMemoStore() throws -> MemoStore {
  let dir = URL(fileURLWithPath: NSTemporaryDirectory())
    .appendingPathComponent(UUID().uuidString, isDirectory: true)
  try FileManager.default.createDirectory(at: dir, withIntermediateDirectories: true)
  let store = try LocalStore(path: dir.appendingPathComponent("test.sqlite3"))
  return MemoStore(store: store, ownerId: "user-1")
}

@Test func createThenLoadRoundTrips() throws {
  let memos = try makeMemoStore()
  let created = try memos.create(content: "첫 메모", category: nil, now: Date(timeIntervalSince1970: 10))

  let loaded = try memos.load(id: created.id)
  #expect(loaded == created)
  #expect(loaded?.content == "첫 메모")
}

/// 데스크탑과 동일한 규칙: 빈 내용도 저장된다. 삭제로 취급하지 않는다.
@Test func emptyContentIsPersisted() throws {
  let memos = try makeMemoStore()
  let created = try memos.create(content: "", category: nil, now: Date(timeIntervalSince1970: 10))

  let loaded = try memos.load(id: created.id)
  #expect(loaded != nil)
  #expect(loaded?.content == "")
}

@Test func saveUpdatesContentAndKeepsCreatedAt() throws {
  let memos = try makeMemoStore()
  var memo = try memos.create(content: "before", category: nil, now: Date(timeIntervalSince1970: 10))
  let originalCreatedAt = memo.createdAt

  memo.content = "after"
  memo.contentUpdatedAt = Date(timeIntervalSince1970: 50)
  try memos.save(memo)

  let loaded = try memos.load(id: memo.id)
  #expect(loaded?.content == "after")
  #expect(loaded?.createdAt == originalCreatedAt)
}

@Test func allIsNewestEditFirst() throws {
  let memos = try makeMemoStore()
  let older = try memos.create(content: "older", category: nil, now: Date(timeIntervalSince1970: 10))
  let newer = try memos.create(content: "newer", category: nil, now: Date(timeIntervalSince1970: 90))

  #expect(try memos.all().map(\.id) == [newer.id, older.id])
}

@Test func purgeRemovesTheMemo() throws {
  let memos = try makeMemoStore()
  let memo = try memos.create(content: "지울 것", category: nil, now: Date(timeIntervalSince1970: 10))

  try memos.purge(id: memo.id)

  #expect(try memos.load(id: memo.id) == nil)
  #expect(try memos.all().isEmpty)
}

/// JSON 라운드트립에서 초 이하 정밀도가 손실되지 않아야 한다. 온초 픽스처(예: Date(timeIntervalSince1970: 10))는
/// 이 손실을 가려버리므로 일부러 밀리초 단위가 있는 타임스탬프를 쓴다. (ISO8601DateFormatter의
/// withFractionalSeconds 는 밀리초 3자리까지만 표현하므로 그 이상의 마이크로초는 애초에 대상이 아니다.)
@Test func subSecondPrecisionSurvivesRoundTrip() throws {
  let memos = try makeMemoStore()
  let preciseNow = Date(timeIntervalSince1970: 1_788_632_906.744)
  let created = try memos.create(content: "정밀 타임스탬프", category: nil, now: preciseNow)

  let loaded = try memos.load(id: created.id)
  #expect(loaded == created)
  #expect(loaded?.createdAt == preciseNow)
  #expect(loaded?.contentUpdatedAt == preciseNow)
}

// MARK: - 동기화 base

private func entry(_ memos: MemoStore, _ id: String) throws -> MemoEntry? {
  try memos.entries().first { $0.memo.id == id }
}

@Test func newMemoHasNoSyncedBase() throws {
  let memos = try makeMemoStore()
  let memo = try memos.create(content: "새 메모", category: nil, now: Date(timeIntervalSince1970: 10))

  let found = try entry(memos, memo.id)
  #expect(found?.syncStatus == "pending")
  #expect(found?.syncedBase == nil)
}

/// base 가 없으면 3-way 병합이 불가능해진다. 로컬 편집이 이걸 지우면 동시 편집이
/// 병합 대신 통째 덮어쓰기가 된다.
@Test func localEditsKeepTheSyncedBase() throws {
  let memos = try makeMemoStore()
  var memo = try memos.create(content: "서버본", category: nil, now: Date(timeIntervalSince1970: 10))
  try memos.markSynced(memo, base: memo)

  memo.content = "고친 것"
  memo.contentUpdatedAt = Date(timeIntervalSince1970: 50)
  try memos.save(memo)

  let found = try entry(memos, memo.id)
  #expect(found?.memo.content == "고친 것")
  #expect(found?.syncStatus == "pending")
  #expect(found?.syncedBase?.content == "서버본")
}

/// 푸시를 미는 사이에 사용자가 더 고쳤으면 그 글자를 덮으면 안 된다.
@Test func markSyncedDoesNotOverwriteNewerLocalEdits() throws {
  let memos = try makeMemoStore()
  let acked = try memos.create(content: "밀던 것", category: nil, now: Date(timeIntervalSince1970: 10))

  var newer = acked
  newer.content = "미는 사이에 더 침"
  newer.contentUpdatedAt = Date(timeIntervalSince1970: 50)
  try memos.save(newer)

  try memos.markSynced(acked, base: acked)

  let found = try entry(memos, acked.id)
  #expect(found?.memo.content == "미는 사이에 더 침")
  // 아직 안 올라간 편집이 남았으므로 다음 동기화에서 다시 밀어야 한다.
  #expect(found?.syncStatus == "pending")
  #expect(found?.syncedBase?.content == "밀던 것")
}

@Test func applyRemoteReplacesContentAndBase() throws {
  let memos = try makeMemoStore()
  let memo = try memos.create(content: "로컬", category: nil, now: Date(timeIntervalSince1970: 10))

  var server = memo
  server.content = "서버가 준 것"
  server.contentUpdatedAt = Date(timeIntervalSince1970: 90)
  try memos.applyRemote(server)

  let found = try entry(memos, memo.id)
  #expect(found?.memo.content == "서버가 준 것")
  #expect(found?.syncStatus == "synced")
  #expect(found?.syncedBase?.content == "서버가 준 것")
}

/// 복구 기록은 목록에도 휴지통에도 안 보인다 — 중복 노트를 만들지 않기 위한 것이다.
@Test func recoveryIsPreservedOutOfSight() throws {
  let memos = try makeMemoStore()
  let memo = try memos.create(content: "이긴 쪽", category: nil, now: Date(timeIntervalSince1970: 10))

  try memos.preserveRecovery(
    memoId: memo.id, content: "진 쪽", source: "server",
    sourceUpdatedAt: Date(timeIntervalSince1970: 20), now: Date(timeIntervalSince1970: 30)
  )

  #expect(try memos.all().map(\.id) == [memo.id])
  #expect(try memos.trashed().isEmpty)
  #expect(try memos.entries().count == 1)
}

@Test func recoveryPayloadMatchesTheDesktopShape() throws {
  let dir = URL(fileURLWithPath: NSTemporaryDirectory())
    .appendingPathComponent(UUID().uuidString, isDirectory: true)
  try FileManager.default.createDirectory(at: dir, withIntermediateDirectories: true)
  let store = try LocalStore(path: dir.appendingPathComponent("test.sqlite3"))
  let memos = MemoStore(store: store, ownerId: "user-1")

  try memos.preserveRecovery(
    memoId: "m1", content: "진 쪽", source: "local",
    sourceUpdatedAt: Date(timeIntervalSince1970: 20), now: Date(timeIntervalSince1970: 30)
  )

  let hash = ContentHash.hash("진 쪽")
  let record = try #require(
    try store.fetch(ownerId: "user-1", type: .memoRecovery, id: "m1:\(hash)")
  )
  let payload = try #require(
    try JSONSerialization.jsonObject(with: Data(record.payloadJSON.utf8)) as? [String: Any]
  )
  #expect(payload["id"] as? String == "m1:\(hash)")
  #expect(payload["memo_id"] as? String == "m1")
  #expect(payload["content"] as? String == "진 쪽")
  #expect(payload["content_hash"] as? String == hash)
  #expect(payload["source"] as? String == "local")
  #expect(payload["source_updated_at"] as? String == "1970-01-01T00:00:20.000Z")
  #expect(payload["created_at"] as? String == "1970-01-01T00:00:30.000Z")
  #expect(payload["updated_at"] as? String == "1970-01-01T00:00:30.000Z")
}

@Test func memosAreScopedToOwner() throws {
  let dir = URL(fileURLWithPath: NSTemporaryDirectory())
    .appendingPathComponent(UUID().uuidString, isDirectory: true)
  try FileManager.default.createDirectory(at: dir, withIntermediateDirectories: true)
  let store = try LocalStore(path: dir.appendingPathComponent("test.sqlite3"))

  let mine = MemoStore(store: store, ownerId: "user-1")
  let theirs = MemoStore(store: store, ownerId: "user-2")
  _ = try mine.create(content: "내 것", category: nil, now: Date(timeIntervalSince1970: 10))

  #expect(try mine.all().count == 1)
  #expect(try theirs.all().isEmpty)
}
