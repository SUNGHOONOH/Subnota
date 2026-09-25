import Foundation

/// pull 이 서버 목록을 로컬에 어떻게 반영할지 정하는 **순수 계산**. 네트워크 계층에
/// 두면 이 판단을 테스트할 수 없는데, 여기서 틀리면 오프라인 편집이 조용히
/// 사라지거나 지운 일정이 되살아난다.
public struct CalendarPullPlan: Sendable, Equatable {
  /// 서버 정본으로 갈아끼울 것.
  public let apply: [CalendarBlock]
  /// 서버에서 사라졌으니 로컬에서도 없앨 것.
  public let purge: [String]

  public static func make(
    rows: [RemoteCalendarBlock], local: [CalendarEntry]
  ) -> CalendarPullPlan {
    let byId = Dictionary(local.map { ($0.block.id, $0) }, uniquingKeysWith: { first, _ in first })

    let apply = rows.compactMap { row -> CalendarBlock? in
      let known = byId[row.id]
      // 아직 안 올라간 로컬 편집·삭제는 덮지 않는다. 덮으면 오프라인 편집이
      // 유실되고 지운 일정이 되살아난다. (메모와 같은 규칙이다.)
      if let status = known?.syncStatus, status != CalendarStore.synced { return nil }
      let incoming = row.toBlock()
      // 안 바뀐 행까지 다시 쓰면 일정 수만큼 쓰기 트랜잭션이 열린다.
      guard known?.block != incoming else { return nil }
      return incoming
    }

    // 서버가 하드 삭제한 일정은 로컬에서도 없앤다. 아직 안 올린 것(pending)은
    // 애초에 서버 목록에 없으므로 여기서 지우면 안 된다.
    let serverIds = Set(rows.map(\.id))
    let purge = local
      .filter { $0.syncStatus == CalendarStore.synced && !serverIds.contains($0.block.id) }
      .map(\.block.id)

    return CalendarPullPlan(apply: apply, purge: purge)
  }
}
