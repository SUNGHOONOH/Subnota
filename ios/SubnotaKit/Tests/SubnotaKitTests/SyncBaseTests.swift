import Foundation
import Testing

@testable import SubnotaKit

private func makeStore() throws -> MemoStore {
  let dir = URL(fileURLWithPath: NSTemporaryDirectory())
    .appendingPathComponent(UUID().uuidString, isDirectory: true)
  try FileManager.default.createDirectory(at: dir, withIntermediateDirectories: true)
  let store = try LocalStore(path: dir.appendingPathComponent("test.sqlite3"))
  return MemoStore(store: store, ownerId: "user-1")
}

private func entry(_ memos: MemoStore, _ id: String) throws -> MemoEntry? {
  try memos.entries().first { $0.memo.id == id }
}

/// 사용자가 푸시 중에 계속 타이핑하면, 서버가 ack 한 병합본은 화면에서 밀려난다.
/// 그때 base 까지 병합본으로 올려 버리면 **다음 병합이 base == server 가 되어
/// 패치가 하나도 안 나오고**, 다른 기기의 편집이 로컬에서도 서버에서도 사라진다.
/// 데스크탑은 이 상황에서 결과 적용 자체를 포기하고(revision 불일치) base 를
/// 그대로 둔 채 다시 민다. 여기서도 base 는 움직이지 않아야 한다.
@Test func typingDuringAPushDoesNotAdvanceTheMergeBase() throws {
  let memos = try makeStore()
  let start = Date(timeIntervalSince1970: 10)

  // 서버와 일치하는 상태.
  var memo = try memos.create(content: "shared\n", category: nil, now: start)
  try memos.markSynced(memo, base: memo, pushed: memo)

  // 사용자가 고친다 → pending.
  memo.content = "shared\nlocal\n"
  memo.contentUpdatedAt = Date(timeIntervalSince1970: 20)
  try memos.save(memo)

  // 푸시가 나가는 사이에 사용자가 더 친다.
  var stillTyping = memo
  stillTyping.content = "shared\nlocal\nmore\n"
  stillTyping.contentUpdatedAt = Date(timeIntervalSince1970: 30)
  try memos.save(stillTyping)

  // 서버는 다른 기기의 편집과 우리 것을 병합해서 ack 했다.
  var acked = memo
  acked.content = "shared\nDESKTOP\nlocal\n"
  try memos.markSynced(acked, base: acked, pushed: memo)

  let found = try #require(try entry(memos, memo.id))
  // 화면은 사용자가 방금 친 것을 지켜야 한다.
  #expect(found.memo.content == "shared\nlocal\nmore\n")
  #expect(found.syncStatus == "pending")

  // 그리고 base 는 아직 그 기기가 서버로부터 반영하지 못한 지점에 머물러야 한다.
  // base 가 병합본으로 올라가면 아래 병합이 빈 패치가 되어 DESKTOP 이 증발한다.
  let base = try #require(found.syncedBase)
  let merged = MemoMerge.merge(
    base: base.content, local: found.memo.content, server: acked.content
  )
  #expect(merged.ok)
  #expect(merged.text.contains("DESKTOP"), "다른 기기의 편집이 사라졌다: \(merged.text)")
  #expect(merged.text.contains("more"), "방금 친 내용이 사라졌다: \(merged.text)")
}

/// 푸시 중에 아무도 안 쳤으면 ack 된 내용과 base 가 모두 그대로 반영돼야 한다.
@Test func aQuietPushAdoptsTheAckedContentAndBase() throws {
  let memos = try makeStore()
  var memo = try memos.create(
    content: "shared\n", category: nil, now: Date(timeIntervalSince1970: 10)
  )

  memo.content = "shared\nlocal\n"
  memo.contentUpdatedAt = Date(timeIntervalSince1970: 20)
  try memos.save(memo)

  var acked = memo
  acked.content = "shared\nDESKTOP\nlocal\n"
  try memos.markSynced(acked, base: acked, pushed: memo)

  let found = try #require(try entry(memos, memo.id))
  #expect(found.memo.content == "shared\nDESKTOP\nlocal\n")
  #expect(found.syncStatus == "synced")
  #expect(found.syncedBase?.content == "shared\nDESKTOP\nlocal\n")
}
