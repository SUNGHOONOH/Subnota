import Foundation
import Testing
@testable import SubnotaKit

private func makeStoreAndMemos() throws -> (LocalStore, MemoStore) {
  let dir = URL(fileURLWithPath: NSTemporaryDirectory())
    .appendingPathComponent(UUID().uuidString, isDirectory: true)
  try FileManager.default.createDirectory(at: dir, withIntermediateDirectories: true)
  let store = try LocalStore(path: dir.appendingPathComponent("test.sqlite3"))
  return (store, MemoStore(store: store, ownerId: "user-1"))
}

@Test func trashedMemosLeaveTheMainListButRemain() throws {
  let (_, memos) = try makeStoreAndMemos()
  let memo = try memos.create(content: "지울 것", category: nil, now: Date(timeIntervalSince1970: 10))

  try memos.moveToTrash(id: memo.id, now: Date(timeIntervalSince1970: 20))

  #expect(try memos.all().isEmpty)
  #expect(try memos.trashed().map(\.id) == [memo.id])
  // 내용은 그대로 남아 있어야 되돌릴 수 있다.
  #expect(try memos.load(id: memo.id)?.content == "지울 것")
}

@Test func restoreBringsItBack() throws {
  let (_, memos) = try makeStoreAndMemos()
  let memo = try memos.create(content: "복구", category: nil, now: Date(timeIntervalSince1970: 10))
  try memos.moveToTrash(id: memo.id, now: Date(timeIntervalSince1970: 20))

  try memos.restore(id: memo.id, now: Date(timeIntervalSince1970: 30))

  #expect(try memos.all().map(\.id) == [memo.id])
  #expect(try memos.trashed().isEmpty)
}

@Test func purgeRemovesTheRowEntirely() throws {
  let (_, memos) = try makeStoreAndMemos()
  let memo = try memos.create(content: "영구 삭제", category: nil, now: Date(timeIntervalSince1970: 10))
  try memos.moveToTrash(id: memo.id, now: Date(timeIntervalSince1970: 20))

  try memos.purge(id: memo.id)

  #expect(try memos.load(id: memo.id) == nil)
  #expect(try memos.trashed().isEmpty)
  #expect(try memos.all().isEmpty)
}

/// 휴지통으로 보내는 것은 "수정"이라 동기화 큐에 올라야 한다. 그래야 서버에도
/// is_archived 가 전달되고 다른 기기에서도 목록에서 사라진다.
@Test func movingToTrashMarksTheRecordPending() throws {
  let (store, memos) = try makeStoreAndMemos()
  let memo = try memos.create(content: "x", category: nil, now: Date(timeIntervalSince1970: 10))

  try memos.moveToTrash(id: memo.id, now: Date(timeIntervalSince1970: 20))

  let record = try store.fetch(ownerId: "user-1", type: .memo, id: memo.id)
  #expect(record?.syncStatus == "pending")
  #expect(record?.isArchived == true)
}

@Test func trashedListIsMostRecentlyDeletedFirst() throws {
  let (_, memos) = try makeStoreAndMemos()
  let first = try memos.create(content: "a", category: nil, now: Date(timeIntervalSince1970: 10))
  let second = try memos.create(content: "b", category: nil, now: Date(timeIntervalSince1970: 20))

  try memos.moveToTrash(id: first.id, now: Date(timeIntervalSince1970: 100))
  try memos.moveToTrash(id: second.id, now: Date(timeIntervalSince1970: 200))

  #expect(try memos.trashed().map(\.id) == [second.id, first.id])
}

/// Phase 0+1 이 저장한 페이로드에는 isArchived 키가 없다. 디코딩이 실패하면
/// 기존 메모가 목록에서 통째로 사라진다 — 사용자 눈에는 데이터 유실이다.
@Test func decodesPayloadsWrittenBeforeTheTrashFieldExisted() throws {
  let legacy = #"{"id":"m1","content":"old","createdAt":"2026-09-06T00:00:00.000Z","contentUpdatedAt":"2026-09-06T00:00:00.000Z"}"#
  let memo = try MemoStore.decodeForTesting(legacy)
  #expect(memo.isArchived == false)
  #expect(memo.content == "old")
}
