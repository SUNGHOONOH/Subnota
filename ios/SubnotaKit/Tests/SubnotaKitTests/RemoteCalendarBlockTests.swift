import Foundation
import Testing

@testable import SubnotaKit

private func decodeRow(_ json: String) throws -> RemoteCalendarBlock {
  try JSONDecoder().decode(RemoteCalendarBlock.self, from: Data(json.utf8))
}

@Test func decodesCalendarSnakeCaseServerColumns() throws {
  let row = try decodeRow(
    """
    {"id":"b1","title":"회의","note":"메모","start_date":"2026-03-01T02:00:00.000Z",
     "end_date":"2026-03-01T03:00:00.000Z","all_day":false,"all_day_date":null,
     "time_zone":"Asia/Seoul","order":2,"color":"#2E8FE5","category_id":"c1",
     "is_completed":true,"completed_at":"2026-03-01T04:00:00.000Z",
     "created_at":"2026-02-28T00:00:00.000Z","updated_at":"2026-03-01T04:00:00.000Z"}
    """
  )

  #expect(row.title == "회의")
  #expect(row.order == 2)
  #expect(row.categoryId == "c1")
  #expect(row.isCompleted)
  #expect(row.endDate == ServerTimestamp.parse("2026-03-01T03:00:00.000Z"))
  #expect(row.toBlock().id == "b1")
}

/// `CalendarBlockRow` 의 컬럼은 대부분 nullable 이다. 하나가 null 이라고 목록
/// 전체가 디코딩 실패로 사라지면 안 된다.
@Test func toleratesNullableCalendarColumns() throws {
  let row = try decodeRow(
    """
    {"id":"b2","title":"제목만","note":null,"start_date":"2026-03-01T02:00:00.000Z",
     "end_date":null,"all_day":null,"all_day_date":null,"order":null,"color":null,
     "category_id":null,"is_completed":null,"completed_at":null,
     "created_at":"2026-02-28T00:00:00.000Z","updated_at":"2026-03-01T04:00:00.000Z"}
    """
  )

  #expect(row.allDay == false)
  #expect(row.order == 0)
  #expect(row.color == CalendarBlock.defaultColor)
  #expect(row.completedAt == nil)
}

/// Postgres 는 `+00:00` 오프셋과 마이크로초를 함께 보낸다. 데스크탑이 쓴 값은
/// `toISOString()` 이라 밀리초 + `Z` 다. 둘 다 읽혀야 한다.
@Test func decodesPostgresTimestampFormats() throws {
  let row = try decodeRow(
    """
    {"id":"b3","title":"시각","start_date":"2026-03-01T02:00:00.123456+00:00",
     "created_at":"2026-02-28T00:00:00+00:00","updated_at":"2026-03-01T04:00:00.000Z"}
    """
  )

  #expect(row.startDate == ServerTimestamp.parse("2026-03-01T02:00:00.123Z"))
  #expect(row.createdAt == ServerTimestamp.parse("2026-02-28T00:00:00.000Z"))
}

/// 서울에서 만든 종일 일정을 뉴욕 기기가 받아도 날짜가 밀리지 않는다 —
/// `all_day_date` 를 그대로 들고 온다.
@Test func keepsTheServerAllDayDate() throws {
  let row = try decodeRow(
    """
    {"id":"b4","title":"종일","start_date":"2026-02-28T15:30:00.000Z","all_day":true,
     "all_day_date":"2026-03-01","created_at":"2026-02-28T15:30:00.000Z",
     "updated_at":"2026-02-28T15:30:00.000Z"}
    """
  )

  #expect(row.toBlock().allDayDate == "2026-03-01")
}
