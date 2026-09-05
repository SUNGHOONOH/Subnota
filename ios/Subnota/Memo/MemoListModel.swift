import Foundation
import SubnotaKit

@MainActor
@Observable
final class MemoListModel {
  private(set) var memos: [Memo] = []
  var loadError: String?

  private let store: MemoStore?

  init(ownerId: String) {
    do {
      let local = try LocalStore(path: try AppGroup.databaseURL())
      store = MemoStore(store: local, ownerId: ownerId)
    } catch {
      store = nil
      loadError = "로컬 저장소를 열지 못했습니다."
    }
  }

  func load() {
    guard let store else { return }
    do { memos = try store.all() }
    catch { loadError = "메모를 불러오지 못했습니다." }
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
    do { try store.save(updated) }
    catch { loadError = "메모를 저장하지 못했습니다." }
    load()
  }

  func delete(_ memo: Memo) {
    guard let store else { return }
    do { try store.delete(id: memo.id) }
    catch { loadError = "메모를 삭제하지 못했습니다." }
    load()
  }
}
