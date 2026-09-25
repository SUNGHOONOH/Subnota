import Foundation
import Testing

@testable import SubnotaKit

private func makeStore() throws -> ScheduleInboxStore {
  let dir = URL(fileURLWithPath: NSTemporaryDirectory())
    .appendingPathComponent(UUID().uuidString, isDirectory: true)
  try FileManager.default.createDirectory(at: dir, withIntermediateDirectories: true)
  return ScheduleInboxStore(
    store: try LocalStore(path: dir.appendingPathComponent("test.sqlite3")), ownerId: "user-1"
  )
}

private func item(_ id: String, at iso: String) -> ScheduleInboxItem {
  guard let date = ServerTimestamp.parse(iso) else {
    fatalError("테스트 픽스처의 시각이 잘못됐다: \(iso)")
  }
  return ScheduleInboxItem(
    id: id, memoId: "memo-1", title: "제목 \(id)", sourceText: "원문 \(id)",
    scheduledAt: date, timeText: "3시", allDay: false, confidence: "auto"
  )
}

@Test func listsInboxItemsByScheduledTime() throws {
  let store = try makeStore()
  try store.replace(with: [
    item("b", at: "2026-09-09T01:00:00.000Z"),
    item("a", at: "2026-09-08T01:00:00.000Z"),
  ])

  #expect(try store.items().map(\.id) == ["a", "b"])
}

/// 서버 응답이 정본이다 — 다른 기기가 처리한 항목은 응답에 없고, 여기서도 사라진다.
@Test func dropsItemsMissingFromTheServerAnswer() throws {
  let store = try makeStore()
  try store.replace(with: [item("a", at: "2026-09-08T01:00:00.000Z")])
  try store.replace(with: [item("b", at: "2026-09-09T01:00:00.000Z")])

  #expect(try store.items().map(\.id) == ["b"])
}

@Test func queuesAnActionAndHidesTheItemImmediately() throws {
  let store = try makeStore()
  try store.replace(with: [item("a", at: "2026-09-08T01:00:00.000Z")])

  try store.handle(id: "a", status: ScheduleInboxAction.accepted)

  #expect(try store.items().isEmpty)
  #expect(try store.pendingActions() == [ScheduleInboxAction(id: "a", status: "accepted")])
}

/// 오프라인에서 수락한 항목은 서버가 아직 pending 으로 알고 있어 다음 응답에 그대로
/// 들어 있다. 되살리면 사용자가 같은 일정을 두 번 만들게 된다.
@Test func doesNotResurrectAnItemWithAPendingAction() throws {
  let store = try makeStore()
  let pending = item("a", at: "2026-09-08T01:00:00.000Z")
  try store.replace(with: [pending])
  try store.handle(id: "a", status: ScheduleInboxAction.dismissed)

  try store.replace(with: [pending, item("b", at: "2026-09-09T01:00:00.000Z")])

  #expect(try store.items().map(\.id) == ["b"])
}

// MARK: - 서버 행 디코딩

/// nullable 컬럼이 전부 null 이어도 한 행이 응답을 통째로 깨뜨리면 안 된다.
@Test func decodesAServerRowWithNullColumns() throws {
  let json = """
    [
      {"id": "1", "memo_id": "m1", "title": "회의", "source_text": "내일 3시 회의",
       "scheduled_at": "2026-09-08T06:00:00+00:00", "time_text": "3시", "all_day": false,
       "confidence": "auto", "status": "pending", "created_at": "2026-09-07T00:00:00+00:00"},
      {"id": "2", "memo_id": "m2", "title": "메모", "source_text": "언젠가",
       "scheduled_at": null, "time_text": null, "all_day": null, "confidence": null,
       "status": "pending", "created_at": null}
    ]
    """
  let rows = try JSONDecoder().decode(
    [RemoteScheduleInboxRow].self, from: Data(json.utf8)
  )

  #expect(rows.count == 2)
  let items = rows.compactMap { $0.toItem() }
  // 시각을 못 읽는 행은 목록에 들이지 않는다 — iOS 에는 날짜 선택기가 없다.
  #expect(items.map(\.id) == ["1"])
  #expect(items[0].hasTime)
  #expect(items[0].confidence == "auto")
}

/// 서버가 받은 뒤에는 아웃박스가 비고, 그 항목은 서버 응답에서도 빠진다.
@Test func forgetsAnActionOnceTheServerTookIt() throws {
  let store = try makeStore()
  try store.replace(with: [item("a", at: "2026-09-08T01:00:00.000Z")])
  try store.handle(id: "a", status: ScheduleInboxAction.accepted)

  try store.clearAction(id: "a")

  #expect(try store.pendingActions().isEmpty)
}
