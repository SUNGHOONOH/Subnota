import Foundation
import SubnotaKit

@MainActor
@Observable
final class MemoListModel {
  private(set) var memos: [Memo] = []
  private(set) var trashed: [Memo] = []
  var loadError: String?

  private let store: MemoStore?
  private(set) var sync: SyncService?

  /// 화면에 한 줄로 띄울 안내. 로컬 오류가 우선이다 — 그게 더 급하다.
  var notice: String? { loadError ?? sync?.lastError }
  var isSyncing: Bool { sync?.isSyncing ?? false }
  var isOnline: Bool { sync?.isOnline ?? false }

  init(ownerId: String) {
    do {
      let local = try LocalStore(path: try AppGroup.databaseURL())
      let memoStore = MemoStore(store: local, ownerId: ownerId)
      store = memoStore
      // CalendarStore 는 상태가 없다 — 캘린더 화면(Phase 5 Task 3)이 같은
      // LocalStore 로 자기 것을 만들어도 안전하다.
      sync = SyncService(
        memos: memoStore,
        calendar: CalendarStore(store: local, ownerId: ownerId),
        userId: ownerId
      )
    } catch {
      store = nil
      loadError = "로컬 저장소를 열지 못했습니다."
    }
  }

  func load() {
    guard let store else { return }
    do {
      memos = try store.all()
      trashed = try store.trashed()
      loadError = nil
    } catch { loadError = "메모를 불러오지 못했습니다." }
  }

  func create() -> Memo? {
    guard let store else { return nil }
    do {
      let memo = try store.create(content: "", category: nil)
      load()
      return memo
    } catch {
      loadError = "메모를 만들지 못했습니다."
      return nil
    }
  }

  func save(_ memo: Memo) {
    guard let store else { return }
    var updated = memo
    updated.contentUpdatedAt = Date()
    do {
      try store.save(updated)
      load()
    } catch {
      loadError = "메모를 저장하지 못했습니다."
    }
  }

  func delete(_ memo: Memo) {
    guard let store else { return }
    do {
      try store.moveToTrash(id: memo.id, now: Date())
      load()
    } catch {
      loadError = "메모를 휴지통으로 옮기지 못했습니다."
    }
  }

  func restore(_ memo: Memo) {
    guard let store else { return }
    do {
      try store.restore(id: memo.id, now: Date())
      load()
    } catch {
      loadError = "메모를 되돌리지 못했습니다."
    }
  }

  /// 네트워크가 없어도 로컬 목록은 그대로다 — 동기화 실패가 화면을 비우지 않는다.
  func syncNow() async {
    await sync?.syncNow()
    load()
  }

  func emptyTrash() async {
    await sync?.emptyTrash()
    load()
  }
}
