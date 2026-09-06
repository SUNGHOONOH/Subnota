import Foundation
import Testing

@testable import SubnotaKit

private let seoul = TimeZone(identifier: "Asia/Seoul")!
private let newYork = TimeZone(identifier: "America/New_York")!

private func makeCalendarStore(timeZone: TimeZone = seoul) throws -> CalendarStore {
  let dir = URL(fileURLWithPath: NSTemporaryDirectory())
    .appendingPathComponent(UUID().uuidString, isDirectory: true)
  try FileManager.default.createDirectory(at: dir, withIntermediateDirectories: true)
  let store = try LocalStore(path: dir.appendingPathComponent("test.sqlite3"))
  return CalendarStore(store: store, ownerId: "user-1", timeZone: timeZone)
}

/// 테스트는 `TZ` 환경변수와 무관해야 한다 — 그래서 시각도 UTC 오프셋을 박아 만든다.
private func at(_ iso: String) -> Date {
  guard let date = ServerTimestamp.parse(iso) else {
    fatalError("테스트 픽스처의 시각이 잘못됐다: \(iso)")
  }
  return date
}

// MARK: - 저장 왕복

@Test func calendarCreateThenLoadRoundTrips() throws {
  let calendar = try makeCalendarStore()
  let created = try calendar.create(
    title: "회의", startDate: at("2026-03-01T02:00:00.000Z"),
    endDate: at("2026-03-01T03:00:00.000Z"), now: at("2026-03-01T01:00:00.000Z")
  )

  let loaded = try calendar.load(id: created.id)
  #expect(loaded == created)
}

/// `.iso8601` 기본 전략은 소수점 초를 버린다. 그러면 저장→읽기 한 번마다 시각이
/// 잘려 데스크탑이 쓴 값과 어긋난다.
@Test func keepsFractionalSecondsAcrossASaveLoadRoundTrip() throws {
  let calendar = try makeCalendarStore()
  let start = at("2026-03-01T02:00:00.123Z")
  let created = try calendar.create(title: "정밀도", startDate: start, now: start)

  let loaded = try calendar.load(id: created.id)
  #expect(loaded?.startDate == start)
}

/// 필드가 늘어도 예전 페이로드가 읽혀야 한다. 합성 디코더를 쓰면 여기서 실패하고
/// 기기에 있던 일정이 전부 사라진다.
@Test func decodesAPayloadThatPredatesLaterFields() throws {
  let minimal = #"{"id":"b1","startDate":"2026-03-01T02:00:00.000Z"}"#
  let block = try PayloadCoder.decode(CalendarBlock.self, from: minimal)

  #expect(block.id == "b1")
  #expect(block.title == CalendarBlock.defaultTitle)
  #expect(block.color == CalendarBlock.defaultColor)
  #expect(block.allDay == false)
  #expect(block.order == 0)
  #expect(block.createdAt == at("2026-03-01T02:00:00.000Z"))
}

@Test func emptyTitleFallsBackLikeTheDesktop() throws {
  let calendar = try makeCalendarStore()
  let created = try calendar.create(
    title: "   ", startDate: at("2026-03-01T02:00:00.000Z"),
    now: at("2026-03-01T02:00:00.000Z")
  )

  #expect(created.title == "새 일정")
}

@Test func allDayBlocksDropTheEndDate() throws {
  let calendar = try makeCalendarStore()
  let created = try calendar.create(
    title: "종일", startDate: at("2026-03-01T02:00:00.000Z"),
    endDate: at("2026-03-01T05:00:00.000Z"), allDay: true,
    now: at("2026-03-01T02:00:00.000Z")
  )

  #expect(created.endDate == nil)
}

// MARK: - 종일 일정 경계 (이 Phase 의 함정)

/// UTC 로 계산하면 한국의 오전 9시 이전 일정이 전날로 간다.
/// `2026-03-01T00:30+09:00` 은 UTC 로 `2026-02-28T15:30Z` 다.
@Test func allDayDateUsesTheInjectedTimeZoneNotUTC() throws {
  let beforeNineInSeoul = at("2026-02-28T15:30:00.000Z")

  let inSeoul = try makeCalendarStore(timeZone: seoul).create(
    title: "이른 아침", startDate: beforeNineInSeoul, allDay: true, now: beforeNineInSeoul
  )
  let inNewYork = try makeCalendarStore(timeZone: newYork).create(
    title: "이른 아침", startDate: beforeNineInSeoul, allDay: true, now: beforeNineInSeoul
  )

  #expect(inSeoul.allDayDate == "2026-03-01")
  #expect(inNewYork.allDayDate == "2026-02-28")
}

/// 여러 시간대에서 같은 순간이 어느 날로 떨어지는지 한 번에 못 박는다.
/// `TZ` 를 무엇으로 두고 돌려도 결과가 같아야 한다.
@Test func localCalendarDateMatchesEachTimeZone() {
  let instant = at("2026-02-28T15:30:00.000Z")
  let expected = [
    ("Asia/Seoul", "2026-03-01"),
    ("America/New_York", "2026-02-28"),
    ("UTC", "2026-02-28"),
    // UTC+14. 여기서는 이미 다음 날 새벽이다.
    ("Pacific/Kiritimati", "2026-03-01"),
  ]

  for (identifier, day) in expected {
    let zone = TimeZone(identifier: identifier)!
    #expect(LocalCalendarDate.string(from: instant, timeZone: zone) == day)
  }
}

/// 시각이 있는 일정도 로컬 시간대 기준으로 그 날 목록에 들어가야 한다.
@Test func timedBlocksLandOnTheLocalDay() throws {
  let calendar = try makeCalendarStore(timeZone: seoul)
  let beforeNineInSeoul = at("2026-02-28T15:30:00.000Z")
  let created = try calendar.create(
    title: "새벽 운동", startDate: beforeNineInSeoul, now: beforeNineInSeoul
  )

  #expect(try calendar.blocks(on: at("2026-03-01T05:00:00.000Z")).map(\.id) == [created.id])
  #expect(try calendar.blocks(on: at("2026-02-28T05:00:00.000Z")).isEmpty)
}

/// 다른 시간대에서 만들어 서버에 올라간 종일 일정은 저장된 `all_day_date` 가
/// 정본이다. 여기서 `startDate` 로 다시 계산하면 하루 밀린다 — 데스크탑
/// `getBlockStart` 와 같은 규칙이다.
@Test func allDayBlocksTrustTheStoredDateFromAnotherTimeZone() throws {
  let calendar = try makeCalendarStore(timeZone: newYork)
  let remote = CalendarBlock(
    id: "b-remote", title: "서울에서 만든 종일",
    startDate: at("2026-02-28T15:30:00.000Z"), allDay: true, allDayDate: "2026-03-01",
    createdAt: at("2026-02-28T15:30:00.000Z"), updatedAt: at("2026-02-28T15:30:00.000Z")
  )
  try calendar.applyRemote(remote)

  // 뉴욕 기준으로는 아직 2월 28일이지만, 그 일정은 3월 1일 것이다.
  #expect(try calendar.blocks(on: at("2026-03-01T18:00:00.000Z")).map(\.id) == ["b-remote"])
  #expect(try calendar.blocks(on: at("2026-02-28T18:00:00.000Z")).isEmpty)
}

// MARK: - 기간 조회

@Test func rangeQueryIncludesBothEndsInLocalTime() throws {
  let calendar = try makeCalendarStore(timeZone: seoul)
  let first = try calendar.create(
    title: "1일", startDate: at("2026-02-28T15:30:00.000Z"),
    now: at("2026-02-28T15:30:00.000Z")
  )
  let third = try calendar.create(
    title: "3일", startDate: at("2026-03-03T01:00:00.000Z"),
    now: at("2026-03-03T01:00:00.000Z")
  )
  _ = try calendar.create(
    title: "5일", startDate: at("2026-03-05T01:00:00.000Z"),
    now: at("2026-03-05T01:00:00.000Z")
  )

  let found = try calendar.blocks(
    in: DateInterval(
      start: at("2026-02-28T15:00:00.000Z"), end: at("2026-03-03T14:00:00.000Z")
    )
  )

  #expect(found.map(\.id) == [first.id, third.id])
}

// MARK: - 삭제

@Test func deleteHidesTheBlockButKeepsItForTheServerRoundTrip() throws {
  let calendar = try makeCalendarStore()
  let start = at("2026-03-01T02:00:00.000Z")
  let created = try calendar.create(title: "지울 것", startDate: start, now: start)

  try calendar.delete(id: created.id, now: at("2026-03-01T03:00:00.000Z"))

  #expect(try calendar.blocks(on: start).isEmpty)
  let entry = try calendar.entries().first { $0.block.id == created.id }
  #expect(entry?.syncStatus == CalendarStore.pendingDelete)
}

@Test func purgingACalendarBlockRemovesTheRow() throws {
  let calendar = try makeCalendarStore()
  let start = at("2026-03-01T02:00:00.000Z")
  let created = try calendar.create(title: "지울 것", startDate: start, now: start)

  try calendar.purge(id: created.id)

  let loaded = try calendar.load(id: created.id)
  #expect(loaded == nil)
  #expect(try calendar.entries().isEmpty)
}

// MARK: - 동기화 배관

@Test func savedBlocksArePendingUntilTheServerAcks() throws {
  let calendar = try makeCalendarStore()
  let start = at("2026-03-01T02:00:00.000Z")
  let created = try calendar.create(title: "새 일정", startDate: start, now: start)

  #expect(try calendar.entries().first?.syncStatus == CalendarStore.pending)

  try calendar.markSynced(created, pushed: created)

  #expect(try calendar.entries().first?.syncStatus == CalendarStore.synced)
}

/// 미는 사이에 사용자가 더 고쳤으면 방금 고친 내용을 지킨다. 서버 응답으로 덮으면
/// 그 편집이 화면에서도 서버에서도 사라진다.
@Test func editingDuringAPushKeepsTheLocalVersionPending() throws {
  let calendar = try makeCalendarStore()
  let start = at("2026-03-01T02:00:00.000Z")
  let pushed = try calendar.create(title: "처음", startDate: start, now: start)

  var edited = pushed
  edited.title = "고친 제목"
  let saved = try calendar.save(edited, now: at("2026-03-01T02:30:00.000Z"))

  try calendar.markSynced(pushed, pushed: pushed)

  let loaded = try calendar.load(id: pushed.id)
  #expect(loaded == saved)
  #expect(try calendar.entries().first?.syncStatus == CalendarStore.pending)
}

@Test func applyRemoteMarksTheBlockSynced() throws {
  let calendar = try makeCalendarStore()
  let remote = CalendarBlock(
    id: "b-remote", title: "서버 것", startDate: at("2026-03-01T02:00:00.000Z"),
    createdAt: at("2026-03-01T01:00:00.000Z"), updatedAt: at("2026-03-01T02:00:00.000Z")
  )

  try calendar.applyRemote(remote)

  let loaded = try calendar.load(id: "b-remote")
  #expect(loaded == remote)
  #expect(try calendar.entries().first?.syncStatus == CalendarStore.synced)
}

/// 서버는 uuid 를 소문자로 돌려준다. 대문자 id 로 만들면 pull 이 같은 일정을 못
/// 알아보고 사본을 하나 더 만들어 화면에 두 번 나온다.
@Test func createsLowercasedIdsSoTheServerRoundTripMatches() throws {
  let calendar = try makeCalendarStore()
  let created = try calendar.create(title: "회의", startDate: at("2026-03-01T02:00:00.000Z"))
  #expect(created.id == created.id.lowercased())
}
