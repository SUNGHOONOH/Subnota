import Foundation
import Network
import SubnotaKit

/// 데스크탑 `services/supabase/memoSync.ts` 를 옮긴 것. 순서가 계약이다 —
/// 어긋나면 두 클라이언트가 서로의 편집을 덮어쓰거나 중복 노트를 만든다.
@MainActor
@Observable
final class SyncService {
  private(set) var isSyncing = false
  /// 마지막 동기화가 남긴 안내. 실패해도 로컬 편집은 그대로 남는다.
  var lastError: String?
  /// 낙관적으로 시작한다 — NWPathMonitor 의 첫 콜백이 오기 전에 동기화를 막지 않는다.
  private(set) var isOnline = true

  private let memos: MemoStore
  private let remote: MemoRemote
  private let calendar: CalendarStore
  private let calendarRemote: CalendarRemote
  private let monitor = NWPathMonitor()

  init(memos: MemoStore, calendar: CalendarStore, userId: String) {
    self.memos = memos
    self.calendar = calendar
    remote = MemoRemote(client: SupabaseClientProvider.shared, userId: userId)
    calendarRemote = CalendarRemote(client: SupabaseClientProvider.shared, userId: userId)
    monitor.pathUpdateHandler = { [weak self] path in
      let online = path.status == .satisfied
      Task { @MainActor in self?.isOnline = online }
    }
    monitor.start(queue: .global(qos: .utility))
  }

  deinit { monitor.cancel() }

  func syncNow() async {
    guard !isSyncing else { return }
    guard isOnline else {
      lastError = "오프라인입니다. 연결되면 다시 동기화합니다."
      return
    }
    isSyncing = true
    lastError = nil
    defer { isSyncing = false }

    await push()
    do {
      try await pull()
    } catch {
      log(error)
      lastError = "서버에서 메모를 받아오지 못했습니다."
    }

    // 캘린더는 메모와 독립이다. 메모 쪽이 실패해도 일정은 올라가야 한다.
    await pushCalendar()
    await pushCompletions()
    do {
      try await pullCalendar()
    } catch {
      log(error)
      lastError = "서버에서 일정을 받아오지 못했습니다."
    }
  }

  /// 휴지통 비우기. 서버에서 지워진 것만 로컬에서도 지운다 — 로컬만 지우면
  /// 사용자가 없앤 줄 아는 내용이 서버에 계속 남는다.
  func emptyTrash() async {
    guard isOnline else {
      lastError = "오프라인입니다. 연결된 뒤에 비울 수 있습니다."
      return
    }
    isSyncing = true
    lastError = nil
    defer { isSyncing = false }

    for memo in (try? memos.trashed()) ?? [] {
      do {
        try await remote.purge(id: memo.id)
        try memos.purge(id: memo.id)
      } catch {
        log(error)
        // 못 지운 메모는 휴지통에 남는다. 다음에 다시 시도할 수 있다.
        lastError = "일부 메모를 영구 삭제하지 못했습니다."
      }
    }
  }

  // MARK: - 푸시

  private func push() async {
    let entries: [MemoEntry]
    do {
      entries = try memos.entries()
    } catch {
      // 조용히 아무것도 안 올리는 게 이 Phase 가 막으려는 실패다. 반드시 보인다.
      log(error)
      lastError = "로컬 메모를 읽지 못했습니다."
      return
    }

    for entry in entries where entry.syncStatus == "pending" {
      do {
        try await push(entry)
      } catch {
        log(error)
        // 레코드는 pending 으로 남아 다음 동기화에서 다시 시도된다. 한 메모가
        // 막혔다고 나머지와 pull 까지 세우지 않는다.
        lastError = "일부 메모를 올리지 못했습니다."
      }
    }
  }

  private func push(_ entry: MemoEntry) async throws {
    let memo = entry.memo

    // 휴지통 이동은 내용 upsert 가 아니다 — 서버 is_archived 만 바꾸는 게
    // 데스크탑 계약이다. 내용을 안 올렸으니 base 의 내용도 그대로 둔다.
    if memo.isArchived {
      try await remote.setArchived(id: memo.id, true)
      try memos.markSynced(memo, base: archivedBase(entry), pushed: entry.memo)
      return
    }

    // 되돌리기. upsert RPC 가 is_archived 를 건드리지 않으므로 여기서 풀어야 한다.
    if entry.syncedBase?.isArchived == true {
      try await remote.setArchived(id: memo.id, false)
    }

    guard let canonical = try await pushMerging(entry) else {
      // 다른 기기가 영구 삭제했다. 서버 묘비가 있으니 되살리지 않는다.
      try memos.purge(id: memo.id)
      return
    }
    try memos.markSynced(canonical, base: canonical, pushed: entry.memo)
  }

  /// `memoSync.ts` 의 `pushMemoMerging`. nil 은 `status == 'deleted'` 다.
  private func pushMerging(_ entry: MemoEntry) async throws -> Memo? {
    let memo = entry.memo
    let baseContent = entry.syncedBase?.content
    let first = try await remote.upsert(memo, baseHash: baseContent.map(ContentHash.hash))
    if first.status == .deleted { return nil }
    if first.status != .conflict { return memo }

    var server = try await fetchOne(memo.id)
    if let baseContent {
      for _ in 0..<2 {
        let merged = MemoMerge.merge(
          base: baseContent, local: memo.content, server: server.content
        )
        guard merged.ok else { break }

        var retryMemo = memo
        retryMemo.content = merged.text
        let retry = try await remote.upsert(retryMemo, baseHash: server.contentHash)
        if retry.status == .deleted { return nil }
        if retry.status != .conflict { return retryMemo }
        server = try await fetchOne(memo.id)
      }
    }

    return try await resolveUnmergeableConflict(memo, server: server)
  }

  /// `memoSync.ts` 의 `resolveUnmergeableConflict`. 진 쪽을 숨은 복구 기록으로
  /// 남기고 최신본을 **원래 memo id** 로 남긴다 — 중복 노트를 만들지 않는다.
  private func resolveUnmergeableConflict(
    _ memo: Memo, server: RemoteMemo
  ) async throws -> Memo? {
    guard memo.contentUpdatedAt >= server.contentUpdatedAt else {
      try memos.preserveRecovery(
        memoId: memo.id, content: memo.content,
        source: "local", sourceUpdatedAt: memo.contentUpdatedAt
      )
      return adopt(server)
    }

    // 로컬이 최신이다. 서버본을 먼저 보관하고 방금 읽은 해시로 한 번 더 민다.
    try memos.preserveRecovery(
      memoId: memo.id, content: server.content,
      source: "server", sourceUpdatedAt: server.contentUpdatedAt
    )
    let retry = try await remote.upsert(memo, baseHash: server.contentHash)
    if retry.status == .deleted { return nil }
    if retry.status == .conflict {
      // 푸는 사이에 서버가 또 움직였다. UI 를 되돌리거나 노트를 하나 더 만드는
      // 대신 다음 동기화로 미룬다.
      throw SyncError.conflictMovedAgain
    }
    return memo
  }

  // MARK: - 풀

  private func pull() async throws {
    let rows = try await remote.fetchAll()
    let local = try memos.entries()
    let byId = Dictionary(local.map { ($0.memo.id, $0) }, uniquingKeysWith: { first, _ in first })

    for row in rows {
      let known = byId[row.id]
      // pending 은 아직 안 올라간 로컬 편집이다. 덮으면 그대로 유실이다.
      guard known?.syncStatus != "pending" else { continue }
      let incoming = adopt(row)
      // 안 바뀐 행까지 다시 쓰면 메모 수만큼 쓰기 트랜잭션이 열린다.
      guard known?.memo != incoming || known?.syncStatus != "synced" else { continue }
      try memos.applyRemote(incoming)
    }

    // 결정 B: 보관된 레코드는 애초에 fetchAll 응답에 없다(서버가 is_archived 로
    // 거른다). 여기서 같이 지우면 휴지통이 비고 되돌리기가 불가능해진다.
    let serverIds = Set(rows.map(\.id))
    for entry in local
    where entry.syncStatus == "synced"
      && !entry.memo.isArchived
      && !serverIds.contains(entry.memo.id) {
      try memos.purge(id: entry.memo.id)
    }
  }

  // MARK: - 캘린더

  /// 메모와 달리 병합이 없다 — 서버에 그대로 올리고 마지막에 쓴 쪽이 이긴다.
  /// 삭제는 서버에서도 하드 삭제라, 서버가 지운 것을 확인한 뒤에만 로컬 행을 없앤다.
  private func pushCalendar() async {
    let entries: [CalendarEntry]
    do {
      entries = try calendar.entries()
    } catch {
      log(error)
      lastError = "로컬 일정을 읽지 못했습니다."
      return
    }

    for entry in entries where entry.syncStatus != CalendarStore.synced {
      do {
        if entry.syncStatus == CalendarStore.pendingDelete {
          try await calendarRemote.delete(id: entry.block.id)
          try calendar.purge(id: entry.block.id)
        } else {
          let acked = try await calendarRemote.upsert(entry.block)
          try calendar.markSynced(acked.toBlock(), pushed: entry.block)
        }
      } catch {
        log(error)
        // 이 일정은 대기 상태로 남아 다음 동기화에서 다시 시도된다.
        lastError = "일부 일정을 올리지 못했습니다."
      }
    }
  }

  /// 완료 이벤트 아웃박스. 오프라인에서 쌓인 것을 올린다 — 서버 쪽 upsert 가 멱등이라
  /// 같은 것을 다시 보내도 행이 늘지 않는다. pull 은 없다: append-only 라 받아올
  /// 것이 없고, 유일한 소비자인 월간 리포트는 서버에서 직접 읽는다.
  private func pushCompletions() async {
    do {
      for record in try calendar.pendingActivityCompletions() {
        try await calendarRemote.record(record)
        try calendar.markCompletionSynced(.activityCompletion, id: record.calendarBlockId)
      }
      for record in try calendar.pendingDailyCompletions() {
        try await calendarRemote.record(record)
        try calendar.markCompletionSynced(.dailyCompletion, id: record.localDate)
      }
    } catch {
      log(error)
      // 남은 것은 대기 상태로 두고 다음 동기화에서 다시 보낸다.
      lastError = "일부 완료 기록을 올리지 못했습니다."
    }
  }

  /// 무엇을 적용하고 무엇을 지울지는 `CalendarPullPlan` 이 정한다 — 그래야 그
  /// 판단(특히 pending 을 덮지 않는 규칙)을 네트워크 없이 테스트할 수 있다.
  private func pullCalendar() async throws {
    let plan = CalendarPullPlan.make(
      rows: try await calendarRemote.fetchAll(), local: try calendar.entries()
    )
    for block in plan.apply { try calendar.applyRemote(block) }
    for id in plan.purge { try calendar.purge(id: id) }
  }

  // MARK: - 도움말

  /// 충돌이라고 했으면 행이 있어야 한다. 없어졌다면 읽는 사이에 사라진 것이므로
  /// 로컬 내용을 지우지 말고 다음 동기화로 미룬다 — 그때 upsert 가 `deleted` 를
  /// 돌려주면 그 신호로 지운다.
  private func fetchOne(_ id: String) async throws -> RemoteMemo {
    guard let row = try await remote.fetchOne(id: id) else { throw SyncError.serverRowVanished }
    return row
  }

  /// 서버 행을 로컬 메모로. **id 는 그대로 쓴다** — 충돌을 풀 때도 새 id 를 만들지
  /// 않는 게 중복 노트를 막는 유일한 규칙이다.
  private func adopt(_ row: RemoteMemo) -> Memo {
    Memo(
      id: row.id, content: row.content, category: row.category,
      createdAt: row.createdAt, contentUpdatedAt: row.contentUpdatedAt,
      isArchived: row.isArchived
    )
  }

  /// 보관 푸시는 내용을 올리지 않았으므로 base 의 내용은 그대로 두고 플래그만 옮긴다.
  private func archivedBase(_ entry: MemoEntry) -> Memo? {
    guard var base = entry.syncedBase else { return nil }
    base.isArchived = true
    return base
  }

  private func log(_ error: Error) {
    #if DEBUG
      print("[Subnota][sync] \(String(reflecting: error))")
    #endif
  }

  enum SyncError: Error {
    case serverRowVanished
    case conflictMovedAgain
  }
}
