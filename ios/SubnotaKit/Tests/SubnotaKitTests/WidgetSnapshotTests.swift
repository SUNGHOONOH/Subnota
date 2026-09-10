import Foundation
import Testing

@testable import SubnotaKit

private let seoul = TimeZone(identifier: "Asia/Seoul")!

private func makeStores() throws -> (MemoStore, CalendarStore) {
  let dir = URL(fileURLWithPath: NSTemporaryDirectory())
    .appendingPathComponent(UUID().uuidString, isDirectory: true)
  try FileManager.default.createDirectory(at: dir, withIntermediateDirectories: true)
  let local = try LocalStore(path: dir.appendingPathComponent("test.sqlite3"))
  return (
    MemoStore(store: local, ownerId: "user-1"),
    CalendarStore(store: local, ownerId: "user-1", timeZone: seoul)
  )
}

/// 앱 그룹 컨테이너는 테스트 프로세스에 없다. 저장/로드 규칙만 따로 확인한다.
private func scratchDefaults() -> UserDefaults {
  let defaults = UserDefaults(suiteName: "widget-snapshot-test-\(UUID().uuidString)")!
  return defaults
}

private func at(_ iso: String) -> Date {
  guard let date = ServerTimestamp.parse(iso) else {
    fatalError("테스트 픽스처의 시각이 잘못됐다: \(iso)")
  }
  return date
}

// MARK: - 왕복

@Test func widgetSnapshotRoundTripsThroughUserDefaults() {
  let defaults = scratchDefaults()
  let snapshot = WidgetSnapshot(
    ownerId: "user-1",
    todos: [
      .init(id: "a", title: "장보기", isCompleted: false),
      .init(id: "b", title: "회의", isCompleted: true),
    ],
    latestMemoTitle: "지난 주 회고"
  )

  snapshot.save(to: defaults)

  #expect(WidgetSnapshot.load(from: defaults) == snapshot)
}

@Test func widgetSnapshotIsNilWhenNothingWasEverSaved() {
  #expect(WidgetSnapshot.load(from: scratchDefaults()) == nil)
}

@Test func widgetSnapshotWithNoTodosRoundTrips() {
  let defaults = scratchDefaults()
  let empty = WidgetSnapshot(ownerId: "user-1", todos: [], latestMemoTitle: nil)

  empty.save(to: defaults)

  let loaded = WidgetSnapshot.load(from: defaults)
  #expect(loaded == empty)
  #expect(loaded?.todos.isEmpty == true)
  #expect(loaded?.latestMemoTitle == nil)
}

// MARK: - 잠금화면에 새는 것을 막는 규칙

@Test func widgetSnapshotKeepsOnlyTheFirstLine() {
  let snapshot = WidgetSnapshot(
    ownerId: "user-1",
    todos: [.init(id: "a", title: "제목\n비밀 본문", isCompleted: false)],
    latestMemoTitle: "메모 제목\n계좌번호 110-123-456789"
  )

  #expect(snapshot.todos[0].title == "제목")
  #expect(snapshot.latestMemoTitle == "메모 제목")
}

@Test func widgetSnapshotTruncatesALongTitle() {
  let long = String(repeating: "가", count: WidgetSnapshot.titleLimit + 20)
  let snapshot = WidgetSnapshot(ownerId: "user-1", todos: [], latestMemoTitle: long)

  #expect(snapshot.latestMemoTitle?.count == WidgetSnapshot.titleLimit + 1)  // + "…"
  #expect(snapshot.latestMemoTitle?.hasSuffix("…") == true)
}

@Test func widgetSnapshotKeepsAtMostTwoTodos() {
  let snapshot = WidgetSnapshot(
    ownerId: "user-1",
    todos: (1...5).map { .init(id: "\($0)", title: "할 일 \($0)", isCompleted: false) },
    latestMemoTitle: nil
  )

  #expect(snapshot.todos.count == WidgetSnapshot.maxTodos)
  #expect(snapshot.todos.map(\.id) == ["1", "2"])
}

// MARK: - 저장소에서 뽑기

@Test func captureTakesTodaysBlocksAndTheLatestMemo() throws {
  let (memos, calendar) = try makeStores()
  let now = at("2026-03-01T02:00:00.000Z")  // 서울 3/1 11:00
  _ = try calendar.create(
    title: "오늘 할 일", startDate: now, allDay: true, now: now)
  _ = try calendar.create(
    title: "내일 할 일", startDate: at("2026-03-02T02:00:00.000Z"), allDay: true, now: now)
  _ = try memos.create(content: "오래된 메모\n본문", category: nil, now: at("2026-02-01T00:00:00.000Z"))
  let recent = try memos.create(
    content: "최근 메모\n본문", category: nil, now: at("2026-02-20T00:00:00.000Z"))

  let snapshot = try WidgetSnapshot.capture(
    memos: memos, calendar: calendar, ownerId: "user-1", now: now)

  #expect(snapshot.ownerId == "user-1")
  #expect(snapshot.todos.map(\.title) == ["오늘 할 일"])
  #expect(snapshot.latestMemoTitle == "최근 메모")
  #expect(snapshot.latestMemoId == recent.id)
}

/// 이전 버전이 캐시해 둔 스냅샷에는 `latestMemoId` 가 없다. 업데이트 직후 위젯이
/// 그걸 못 읽으면 다음 갱신까지 "잠금을 해제하면 표시됩니다"로 떨어진다.
@Test func snapshotCachedBeforeMemoIdStillLoads() {
  let defaults = scratchDefaults()
  let old = #"{"ownerId":"user-1","todos":[],"latestMemoTitle":"옛 메모"}"#
  defaults.set(Data(old.utf8), forKey: WidgetSnapshot.defaultsKey)

  let loaded = WidgetSnapshot.load(from: defaults)
  #expect(loaded?.latestMemoTitle == "옛 메모")
  #expect(loaded?.latestMemoId == nil)
}

@Test func capturePutsUnfinishedTodosFirst() throws {
  let (memos, calendar) = try makeStores()
  let now = at("2026-03-01T02:00:00.000Z")
  var done = try calendar.create(title: "끝난 것", startDate: now, allDay: true, now: now)
  done.isCompleted = true
  _ = try calendar.save(done, now: now)
  // 시작 시각이 뒤라 정렬만으로는 두 번째에 온다.
  _ = try calendar.create(
    title: "남은 것", startDate: now.addingTimeInterval(3600), allDay: false, now: now)

  let snapshot = try WidgetSnapshot.capture(
    memos: memos, calendar: calendar, ownerId: "user-1", now: now)

  #expect(snapshot.todos.map(\.title) == ["남은 것", "끝난 것"])
  #expect(snapshot.todos.map(\.isCompleted) == [false, true])
}
