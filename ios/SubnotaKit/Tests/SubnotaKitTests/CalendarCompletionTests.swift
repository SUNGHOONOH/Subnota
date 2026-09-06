import Foundation
import Testing

@testable import SubnotaKit

private let seoul = TimeZone(identifier: "Asia/Seoul")!
private let newYork = TimeZone(identifier: "America/New_York")!
private let kiritimati = TimeZone(identifier: "Pacific/Kiritimati")!

/// 완료 이벤트는 행 수를 세야 하므로 저장소도 같이 돌려준다.
private func makeStores(
  timeZone: TimeZone = seoul
) throws -> (calendar: CalendarStore, store: LocalStore) {
  let dir = URL(fileURLWithPath: NSTemporaryDirectory())
    .appendingPathComponent(UUID().uuidString, isDirectory: true)
  try FileManager.default.createDirectory(at: dir, withIntermediateDirectories: true)
  let store = try LocalStore(path: dir.appendingPathComponent("test.sqlite3"))
  return (CalendarStore(store: store, ownerId: "user-1", timeZone: timeZone), store)
}

private func at(_ iso: String) -> Date {
  guard let date = ServerTimestamp.parse(iso) else {
    fatalError("테스트 픽스처의 시각이 잘못됐다: \(iso)")
  }
  return date
}

/// 화면의 체크 토글과 같은 순서 — 완료 상태를 먼저 저장하고 이벤트를 기록한다.
@discardableResult
private func complete(
  _ calendar: CalendarStore, _ block: CalendarBlock, now: Date
) throws -> CalendarBlock {
  var next = block
  next.isCompleted = true
  next.completedAt = now
  let saved = try calendar.save(next, now: now)
  try calendar.recordCompletion(of: saved, now: now)
  return saved
}

/// 그 날의 종일 Todo 를 만들고 바로 완료한다.
@discardableResult
private func completeTodo(
  _ calendar: CalendarStore, title: String, start: Date, now: Date
) throws -> CalendarBlock {
  let block = try calendar.create(title: title, startDate: start, allDay: true, now: now)
  return try complete(calendar, block, now: now)
}

// MARK: - 멱등

/// 같은 블록을 두 번 완료해도 이벤트는 하나다. 서버의
/// `onConflict: user_id,calendar_block_id` 를 로컬에서도 같은 키로 지킨다.
@Test func recordsOneActivityEventPerBlockEvenWhenCompletedTwice() throws {
  let (calendar, store) = try makeStores()
  let now = at("2026-03-01T05:00:00.000Z")
  let block = try completeTodo(calendar, title: "할 일", start: now, now: now)

  try calendar.recordCompletion(of: block, now: at("2026-03-01T06:00:00.000Z"))

  let events = try store.list(ownerId: "user-1", type: .activityCompletion)
  #expect(events.count == 1)
}

/// 체크를 껐다 켜도 늘면 안 된다. 끄는 쪽에는 지우는 경로가 아예 없다 —
/// 데스크탑도 완료 이벤트를 되돌리지 않는다.
@Test func keepsASingleActivityEventAcrossAnUncheckAndRecheck() throws {
  let (calendar, store) = try makeStores()
  let now = at("2026-03-01T05:00:00.000Z")
  var block = try completeTodo(calendar, title: "할 일", start: now, now: now)

  block.isCompleted = false
  block.completedAt = nil
  _ = try calendar.save(block, now: at("2026-03-01T06:00:00.000Z"))
  #expect(try store.list(ownerId: "user-1", type: .activityCompletion).count == 1)

  block.isCompleted = true
  block.completedAt = at("2026-03-01T07:00:00.000Z")
  let rechecked = try calendar.save(block, now: at("2026-03-01T07:00:00.000Z"))
  try calendar.recordCompletion(of: rechecked, now: at("2026-03-01T07:00:00.000Z"))

  #expect(try store.list(ownerId: "user-1", type: .activityCompletion).count == 1)
}

/// 이미 올라간 이벤트를 다시 기록해도 페이로드와 sync 상태를 건드리면 안 된다 —
/// 건드리면 같은 행을 서버에 계속 다시 올린다.
@Test func doesNotResurrectASyncedActivityEvent() throws {
  let (calendar, store) = try makeStores()
  let now = at("2026-03-01T05:00:00.000Z")
  let block = try completeTodo(calendar, title: "할 일", start: now, now: now)
  let first = try calendar.pendingActivityCompletions()[0]
  try calendar.markCompletionSynced(.activityCompletion, id: block.id)

  try calendar.recordCompletion(of: block, now: at("2026-03-01T09:00:00.000Z"))

  #expect(try calendar.pendingActivityCompletions().isEmpty)
  let stored = try store.fetch(ownerId: "user-1", type: .activityCompletion, id: block.id)
  #expect(stored?.syncStatus == CalendarStore.synced)
  #expect(try PayloadCoder.decode(ActivityCompletion.self, from: stored!.payloadJSON) == first)
}

// MARK: - 하루 완료

/// 하루가 다 끝나야 daily 가 생긴다. 남은 Todo 가 있으면 아직 아니다.
@Test func recordsNoDailyEventWhileTheDayStillHasAnOpenTodo() throws {
  let (calendar, store) = try makeStores()
  let now = at("2026-03-01T05:00:00.000Z")
  _ = try calendar.create(title: "남은 일", startDate: now, allDay: true, now: now)
  try completeTodo(calendar, title: "끝낸 일", start: now, now: now)

  #expect(try store.list(ownerId: "user-1", type: .dailyCompletion).isEmpty)
}

/// 마지막 하나를 끝내면 daily 가 생긴다. `todo_count` 는 그 날 Todo 총 개수다.
@Test func recordsOneDailyEventWhenTheWholeDayIsDone() throws {
  let (calendar, _) = try makeStores()
  let now = at("2026-03-01T05:00:00.000Z")
  let first = try calendar.create(title: "하나", startDate: now, allDay: true, now: now)
  let second = try calendar.create(title: "둘", startDate: now, allDay: true, now: now)

  try complete(calendar, first, now: now)
  #expect(try calendar.pendingDailyCompletions().isEmpty)
  try complete(calendar, second, now: now)

  let daily = try calendar.pendingDailyCompletions()
  #expect(daily.count == 1)
  #expect(daily[0].todoCount == 2)
  #expect(daily[0].localDate == "2026-03-01")
}

/// 하루 완료를 두 번 트리거해도 daily 는 하나다 — 서버의
/// `onConflict: user_id,local_date` 와 같은 키다.
@Test func recordsOneDailyEventEvenWhenTheDayCompletesTwice() throws {
  let (calendar, store) = try makeStores()
  let now = at("2026-03-01T05:00:00.000Z")
  let block = try completeTodo(calendar, title: "하나", start: now, now: now)

  try calendar.recordCompletion(of: block, now: at("2026-03-01T06:00:00.000Z"))
  try calendar.recordCompletion(of: block, now: at("2026-03-01T07:00:00.000Z"))

  #expect(try store.list(ownerId: "user-1", type: .dailyCompletion).count == 1)
}

/// 나중에 Todo 를 더 만들어도 이미 찍힌 daily 의 개수는 그대로다 — append-only 다.
@Test func keepsTheFirstDailyTodoCountWhenTheDayGrowsLater() throws {
  let (calendar, _) = try makeStores()
  let now = at("2026-03-01T05:00:00.000Z")
  try completeTodo(calendar, title: "하나", start: now, now: now)
  try completeTodo(calendar, title: "둘", start: now, now: now)

  #expect(try calendar.pendingDailyCompletions()[0].todoCount == 1)
}

/// 삭제 대기 중인 일정은 하루 완료 판정에서 빠진다 — 화면에도 이미 안 보인다.
@Test func ignoresPendingDeleteBlocksWhenDecidingTheDayIsDone() throws {
  let (calendar, _) = try makeStores()
  let now = at("2026-03-01T05:00:00.000Z")
  let dropped = try calendar.create(title: "지운 일", startDate: now, allDay: true, now: now)
  try calendar.delete(id: dropped.id, now: now)
  try completeTodo(calendar, title: "끝낸 일", start: now, now: now)

  let daily = try calendar.pendingDailyCompletions()
  #expect(daily.count == 1)
  #expect(daily[0].todoCount == 1)
}

// MARK: - local_date

/// `local_date` 는 로컬 시간대 기준이다. UTC 로 만들면 서울의 오전 9시 이전 완료가
/// 전날로 기록되고 월간 리포트가 틀린 달에 집계한다.
@Test func stampsLocalDateInTheStoreTimeZone() throws {
  // 서울 11:00 / 뉴욕 전날 21:00 / 키리티마티 16:00.
  let start = at("2026-03-01T02:00:00.000Z")
  let expected = [seoul: "2026-03-01", newYork: "2026-02-28", kiritimati: "2026-03-01"]

  for (zone, date) in expected {
    let (calendar, _) = try makeStores(timeZone: zone)
    let block = try calendar.create(title: "아침", startDate: start, now: start)
    try complete(calendar, block, now: start)

    #expect(try calendar.pendingActivityCompletions()[0].localDate == date)
  }
}

/// 종일 일정은 `start_date` 가 아니라 저장된 `all_day_date` 를 쓴다 — 서울에서 만든
/// 종일 일정을 뉴욕에서 완료해도 하루 밀리지 않는다.
@Test func usesTheStoredAllDayDateForLocalDate() throws {
  let (calendar, _) = try makeStores(timeZone: newYork)
  let start = at("2026-03-02T02:00:00.000Z")  // 뉴욕은 아직 3월 1일 21:00.
  // 서버에서 받은 그대로 넣는다 — save() 를 거치면 뉴욕 기준으로 다시 계산된다.
  try calendar.applyRemote(
    CalendarBlock(
      id: "block-1", title: "종일", startDate: start, allDay: true, allDayDate: "2026-03-02",
      isCompleted: true, completedAt: start, createdAt: start, updatedAt: start
    )
  )

  try calendar.recordCompletion(of: calendar.load(id: "block-1")!, now: start)

  #expect(try calendar.pendingActivityCompletions()[0].localDate == "2026-03-02")
  #expect(try calendar.pendingDailyCompletions()[0].localDate == "2026-03-02")
}

// MARK: - 동기화 대기열

/// 올린 뒤에는 대기열에서 빠진다. 페이로드는 그대로 남는다(append-only).
@Test func dropsCompletionsFromTheQueueOnceSynced() throws {
  let (calendar, _) = try makeStores()
  let now = at("2026-03-01T05:00:00.000Z")
  let block = try completeTodo(calendar, title: "하나", start: now, now: now)
  #expect(try calendar.pendingActivityCompletions().count == 1)
  #expect(try calendar.pendingDailyCompletions().count == 1)

  try calendar.markCompletionSynced(.activityCompletion, id: block.id)
  try calendar.markCompletionSynced(.dailyCompletion, id: "2026-03-01")

  #expect(try calendar.pendingActivityCompletions().isEmpty)
  #expect(try calendar.pendingDailyCompletions().isEmpty)
}

/// 서버로 보내는 id 는 소문자 uuid 다 — Postgres 가 소문자로 돌려주므로 대문자로
/// 만들면 다음 pull 이 같은 행을 못 알아본다(캘린더에서 이미 겪은 함정이다).
@Test func mintsLowercaseUuidsForCompletionRows() throws {
  let (calendar, _) = try makeStores()
  let now = at("2026-03-01T05:00:00.000Z")
  try completeTodo(calendar, title: "하나", start: now, now: now)

  let activityId = try calendar.pendingActivityCompletions()[0].id
  #expect(activityId == activityId.lowercased())
  #expect(UUID(uuidString: activityId) != nil)
}
