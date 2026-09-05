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

@Test func deleteRemovesTheMemo() throws {
  let memos = try makeMemoStore()
  let memo = try memos.create(content: "지울 것", category: nil, now: Date(timeIntervalSince1970: 10))

  try memos.delete(id: memo.id)

  #expect(try memos.load(id: memo.id) == nil)
  #expect(try memos.all().isEmpty)
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
