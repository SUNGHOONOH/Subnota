import AppIntents
import SubnotaKit
import WidgetKit

/// 잠금화면 위젯에서 Todo 체크를 켜고 끈다. 잠금 해제 없이 된다 — 이 Phase 의 목적이다.
///
/// 쓰기 경로는 앱의 `CalendarModel.toggle` 과 같다(저장 → `recordCompletion`).
/// 둘 다 `CalendarStore` 가 멱등하게 처리하므로 여기서 따로 만들지 않는다.
struct ToggleTodoIntent: AppIntent {
  static let title: LocalizedStringResource = "할 일 체크"
  // 잠금화면에서 체크하는 게 목적이다. 인증을 요구하면 기능 자체가 사라진다.
  static let authenticationPolicy: IntentAuthenticationPolicy = .alwaysAllowed
  static let openAppWhenRun = false
  // 단축어 앱에 노출할 이유가 없다 — 블록 id 를 사람이 넣을 수 없다.
  static let isDiscoverable = false

  @Parameter(title: "Block ID")
  var blockId: String

  init() {}

  init(blockId: String) {
    self.blockId = blockId
  }

  func perform() async throws -> some IntentResult {
    // 소유자 id 는 스냅샷에만 있다(`WidgetData.current()` 참고). 모르면 쓰지 않는다 —
    // 누구의 레코드인지 모른 채 쓰면 안 된다.
    guard let ownerId = WidgetSnapshot.load()?.ownerId, !ownerId.isEmpty else { return .result() }

    // 재부팅 후 첫 잠금 해제 전에는 파일 보호 때문에 DB 가 안 열린다. 크래시하지 않고
    // 조용히 넘긴다 — 그 체크는 반영되지 않는다. 데이터 보호상 어쩔 수 없다.
    guard let local = try? LocalStore(path: try AppGroup.databaseURL()) else { return .result() }
    let calendar = CalendarStore(store: local, ownerId: ownerId)
    guard var block = try? calendar.load(id: blockId) else { return .result() }

    block.isCompleted.toggle()
    block.completedAt = block.isCompleted ? Date() : nil
    // 정규화까지 끝난 결과로 기록해야 종일 일정의 local_date 가 맞는다.
    if let saved = try? calendar.save(block), saved.isCompleted {
      try? calendar.recordCompletion(of: saved)
    }

    // `refresh` 가 스냅샷을 다시 쓰고 바뀌었으면 `reloadAllTimelines` 까지 부른다.
    WidgetSnapshot.refresh(
      memos: MemoStore(store: local, ownerId: ownerId), calendar: calendar, ownerId: ownerId)
    return .result()
  }
}
