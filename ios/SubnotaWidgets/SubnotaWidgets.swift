import SubnotaKit
import SwiftUI
import WidgetKit

@main
struct SubnotaWidgets: WidgetBundle {
  var body: some Widget {
    TodayTodoWidget()
    QuickMemoWidget()
  }
}

/// 위젯 한 장이 그릴 값. `snapshot` 이 `nil` 이면 아직 보여 줄 게 아무것도 없다는 뜻.
struct TodayEntry: TimelineEntry {
  let date: Date
  let snapshot: WidgetSnapshot?
}

enum WidgetData {
  /// 살아 있는 DB 를 먼저 읽고, 못 읽으면 마지막 스냅샷으로 떨어진다.
  ///
  /// **`isProtectedDataAvailable` 을 쓰지 않는다.** 그 값은 `UIApplication.shared`
  /// 에만 있고 `sharedApplication` 은 `NS_EXTENSION_UNAVAILABLE_IOS` 라 앱 확장에서는
  /// 컴파일 자체가 안 된다. 대신 실제로 열어 보고 실패하면 캐시를 쓴다 — 재부팅 후
  /// 첫 잠금 해제 전(파일 보호 등급 `CompleteUntilFirstUserAuthentication`)이든
  /// 다른 이유든 위젯이 해야 할 일은 똑같기 때문에 판별할 실익이 없다.
  static func current() -> WidgetSnapshot? {
    // 소유자 id 는 캐시에만 있다. 확장은 Supabase 세션을 못 보므로, 캐시가 없으면
    // DB 가 읽히더라도 누구의 레코드인지 알 수 없다.
    guard let cached = WidgetSnapshot.load() else { return nil }
    return (try? live(ownerId: cached.ownerId)) ?? cached
  }

  private static func live(ownerId: String) throws -> WidgetSnapshot {
    let local = try LocalStore(path: try AppGroup.databaseURL())
    return try WidgetSnapshot.capture(
      memos: MemoStore(store: local, ownerId: ownerId),
      calendar: CalendarStore(store: local, ownerId: ownerId),
      ownerId: ownerId
    )
  }
}

struct TodayProvider: TimelineProvider {
  func placeholder(in context: Context) -> TodayEntry {
    TodayEntry(
      date: Date(),
      snapshot: WidgetSnapshot(
        ownerId: "",
        todos: [
          .init(id: "1", title: "오늘 할 일", isCompleted: false),
          .init(id: "2", title: "다음 할 일", isCompleted: false),
        ],
        latestMemoTitle: nil
      )
    )
  }

  func getSnapshot(in context: Context, completion: @escaping (TodayEntry) -> Void) {
    completion(TodayEntry(date: Date(), snapshot: WidgetData.current()))
  }

  func getTimeline(in context: Context, completion: @escaping (Timeline<TodayEntry>) -> Void) {
    let now = Date()
    // "오늘"은 자정에 통째로 바뀐다. 그때 한 번 다시 그린다. 그 사이의 변화는
    // 앱이 `WidgetSnapshot.refresh` 에서 밀어 준다 — 여기서 자주 깨울 필요가 없다.
    let midnight = Calendar.current.nextDate(
      after: now, matching: DateComponents(hour: 0, minute: 0, second: 0),
      matchingPolicy: .nextTime)
    completion(
      Timeline(
        entries: [TodayEntry(date: now, snapshot: WidgetData.current())],
        policy: midnight.map { .after($0) } ?? .atEnd
      )
    )
  }
}
