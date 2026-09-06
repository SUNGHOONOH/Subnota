import Foundation
import SubnotaKit
import Supabase

/// 데스크탑 `services/supabase/data.ts` 의 `fetchCalendarBlocks` /
/// `upsertCalendarBlock` / `deleteCalendarBlock` 과 같은 계약이다.
///
/// 메모와 달리 낙관적 동시성 RPC 가 없다. 평범한 upsert 이고 삭제는 하드 삭제다 —
/// 충돌은 last-write-wins 로 끝난다.
struct CalendarRemote {
  let client: SupabaseClient
  let userId: String

  private static let columns =
    "id, title, note, start_date, end_date, all_day, all_day_date, time_zone, order, "
    + "color, category_id, is_completed, completed_at, created_at, updated_at"

  func fetchAll() async throws -> [RemoteCalendarBlock] {
    try await client
      .from("calendar_blocks")
      .select(Self.columns)
      .eq("user_id", value: userId)
      .order("start_date", ascending: true)
      .execute()
      .value
  }

  func upsert(_ block: CalendarBlock) async throws -> RemoteCalendarBlock {
    try await client
      .from("calendar_blocks")
      .upsert(Row(block: block, userId: userId), onConflict: "id")
      .select(Self.columns)
      .single()
      .execute()
      .value
  }

  /// 서버도 행을 지운다 — 메모의 2단계 보관과 다르다.
  func delete(id: String) async throws {
    try await client
      .from("calendar_blocks")
      .delete(returning: .minimal)
      .eq("id", value: id)
      .eq("user_id", value: userId)
      .execute()
  }

  /// 보내는 값은 데스크탑 `upsertCalendarBlock` 이 채우는 것과 같다. 제목 대체값과
  /// 종일 일정의 end_date/all_day_date 규칙은 `CalendarStore` 가 저장할 때 이미
  /// 적용했으므로 여기서는 그대로 옮기기만 한다.
  private struct Row: Encodable {
    let id: String
    let userId: String
    let title: String
    let note: String?
    let startDate: String
    let endDate: String?
    let allDay: Bool
    let allDayDate: String?
    /// 데스크탑처럼 **보내기만 하고 읽지는 않는다**(`Intl...resolvedOptions().timeZone`).
    let timeZone: String
    let order: Int
    let color: String
    let categoryId: String?
    let isCompleted: Bool
    let completedAt: String?

    init(block: CalendarBlock, userId: String) {
      id = block.id
      self.userId = userId
      title = block.title
      note = block.note
      startDate = ServerTimestamp.string(from: block.startDate)
      endDate = block.allDay ? nil : block.endDate.map(ServerTimestamp.string(from:))
      allDay = block.allDay
      allDayDate = block.allDay ? block.allDayDate : nil
      timeZone = TimeZone.current.identifier
      order = block.order
      color = block.color
      categoryId = block.categoryId
      isCompleted = block.isCompleted
      completedAt = block.completedAt.map(ServerTimestamp.string(from:))
    }

    enum CodingKeys: String, CodingKey {
      case id
      case userId = "user_id"
      case title
      case note
      case startDate = "start_date"
      case endDate = "end_date"
      case allDay = "all_day"
      case allDayDate = "all_day_date"
      case timeZone = "time_zone"
      case order
      case color
      case categoryId = "category_id"
      case isCompleted = "is_completed"
      case completedAt = "completed_at"
    }

    /// nil 은 키를 빼는 게 아니라 null 을 보내야 한다 — 종일로 바꾼 일정의
    /// `end_date` 가 서버에 옛 값으로 남으면 안 된다.
    func encode(to encoder: Encoder) throws {
      var c = encoder.container(keyedBy: CodingKeys.self)
      try c.encode(id, forKey: .id)
      try c.encode(userId, forKey: .userId)
      try c.encode(title, forKey: .title)
      try c.encode(note, forKey: .note)
      try c.encode(startDate, forKey: .startDate)
      try c.encode(endDate, forKey: .endDate)
      try c.encode(allDay, forKey: .allDay)
      try c.encode(allDayDate, forKey: .allDayDate)
      try c.encode(timeZone, forKey: .timeZone)
      try c.encode(order, forKey: .order)
      try c.encode(color, forKey: .color)
      try c.encode(categoryId, forKey: .categoryId)
      try c.encode(isCompleted, forKey: .isCompleted)
      try c.encode(completedAt, forKey: .completedAt)
    }
  }
}
