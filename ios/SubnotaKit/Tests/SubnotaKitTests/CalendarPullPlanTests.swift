import Foundation
import Testing

@testable import SubnotaKit

private func serverRow(
  id: String, title: String = "서버 것", updatedAt: String = "2026-03-01T04:00:00.000Z"
) throws -> RemoteCalendarBlock {
  let json = """
    {"id":"\(id)","title":"\(title)","start_date":"2026-03-01T02:00:00.000Z",
     "created_at":"2026-02-28T00:00:00.000Z","updated_at":"\(updatedAt)"}
    """
  return try JSONDecoder().decode(RemoteCalendarBlock.self, from: Data(json.utf8))
}

private func localEntry(
  _ row: RemoteCalendarBlock, status: String, title: String? = nil
) -> CalendarEntry {
  var block = row.toBlock()
  if let title { block.title = title }
  return CalendarEntry(block: block, syncStatus: status)
}

/// 아직 안 올라간 로컬 편집을 서버 정본으로 덮으면 그대로 유실이다.
@Test func pullKeepsPendingLocalEdits() throws {
  let row = try serverRow(id: "b1")
  let plan = CalendarPullPlan.make(
    rows: [row], local: [localEntry(row, status: CalendarStore.pending, title: "내가 고친 제목")]
  )

  #expect(plan.apply.isEmpty)
  #expect(plan.purge.isEmpty)
}

/// 오프라인에서 지운 일정을 pull 이 되살리면 안 된다.
@Test func pullDoesNotResurrectABlockDeletedOffline() throws {
  let row = try serverRow(id: "b1")
  let plan = CalendarPullPlan.make(
    rows: [row], local: [localEntry(row, status: CalendarStore.pendingDelete)]
  )

  #expect(plan.apply.isEmpty)
  #expect(plan.purge.isEmpty)
}

@Test func pullAdoptsServerChangesAndNewRows() throws {
  let changed = try serverRow(id: "b1", title: "서버에서 고침")
  let fresh = try serverRow(id: "b2")
  let plan = CalendarPullPlan.make(
    rows: [changed, fresh],
    local: [localEntry(changed, status: CalendarStore.synced, title: "예전 제목")]
  )

  #expect(plan.apply.map(\.id) == ["b1", "b2"])
  #expect(plan.apply.first?.title == "서버에서 고침")
}

/// 안 바뀐 행까지 다시 쓰면 일정 개수만큼 쓰기 트랜잭션이 열린다.
@Test func pullSkipsUnchangedRows() throws {
  let row = try serverRow(id: "b1")
  let plan = CalendarPullPlan.make(
    rows: [row], local: [localEntry(row, status: CalendarStore.synced)]
  )

  #expect(plan.apply.isEmpty)
}

/// 다른 기기가 하드 삭제한 일정은 여기서도 없어져야 한다.
@Test func pullPurgesBlocksTheServerDeleted() throws {
  let gone = try serverRow(id: "b-gone")
  let plan = CalendarPullPlan.make(
    rows: [], local: [localEntry(gone, status: CalendarStore.synced)]
  )

  #expect(plan.purge == ["b-gone"])
}

/// 아직 한 번도 안 올린 일정은 서버 목록에 없는 게 당연하다. 지우면 방금 만든
/// 일정이 사라진다.
@Test func pullKeepsBlocksThatWereNeverPushed() throws {
  let localOnly = try serverRow(id: "b-new")
  let plan = CalendarPullPlan.make(
    rows: [], local: [localEntry(localOnly, status: CalendarStore.pending)]
  )

  #expect(plan.purge.isEmpty)
}
