import Foundation
#if canImport(WidgetKit)
import WidgetKit
#endif

/// 위젯이 그릴 최소한의 데이터. App Group `UserDefaults` 에 캐시한다.
///
/// **왜 캐시가 필요한가.** iOS 파일 보호 기본 등급이
/// `CompleteUntilFirstUserAuthentication` 이라, 기기를 재부팅하고 아직 한 번도
/// 잠금을 풀지 않았으면 위젯이 SQLite 를 못 연다. 그때 빈 화면이나 크래시 대신
/// 마지막으로 본 것을 보여주려고 둔다.
///
/// **왜 본문을 안 담는가.** `UserDefaults` 의 plist 는 SQLite 와 달리 그 상태에서도
/// 읽힌다. 즉 여기 넣은 것은 잠금 해제 없이 잠금화면에 뜰 수 있다는 뜻이다.
/// 그래서 첫 줄만, 그것도 `titleLimit` 자로 잘라 담는다. 본문·노트는 넣지 않는다.
public struct WidgetSnapshot: Codable, Sendable, Equatable {
  public struct Todo: Codable, Sendable, Equatable, Identifiable {
    public let id: String
    public let title: String
    public let isCompleted: Bool

    public init(id: String, title: String, isCompleted: Bool) {
      self.id = id
      self.title = WidgetSnapshot.oneLine(title)
      self.isCompleted = isCompleted
    }
  }

  /// 잠금화면 `accessoryRectangular` 에 들어가는 줄 수.
  public static let maxTodos = 2
  /// 한 줄에 들어갈 만큼. 넘치면 잘라 담는다 — 위의 "왜 본문을 안 담는가" 참고.
  public static let titleLimit = 60
  static let defaultsKey = "widget.snapshot"

  /// 위젯이 DB 를 직접 읽을 때 필요하다. 확장은 Supabase 세션을 못 보므로
  /// 소유자 id 를 알 길이 이것뿐이다.
  public let ownerId: String
  public let todos: [Todo]
  public let latestMemoTitle: String?
  /// 홈화면 위젯이 그 메모를 여는 딥링크(`DeepLink.memo`)에 쓴다. 이 필드가 생기기
  /// 전에 캐시된 스냅샷에는 없다 — 옵셔널이라 그대로 `nil` 로 읽힌다.
  public let latestMemoId: String?

  public init(
    ownerId: String, todos: [Todo], latestMemoTitle: String?, latestMemoId: String? = nil
  ) {
    self.ownerId = ownerId
    self.todos = Array(todos.prefix(Self.maxTodos))
    self.latestMemoTitle = latestMemoTitle.map(Self.oneLine)
    self.latestMemoId = latestMemoId
  }

  /// 첫 줄만 잘라 낸다. 메모 제목 규칙(`Memo.listTitle`)과 같다.
  static func oneLine(_ text: String) -> String {
    let first = text.split(separator: "\n", omittingEmptySubsequences: false).first ?? ""
    let trimmed = first.trimmingCharacters(in: .whitespaces)
    return trimmed.count <= titleLimit ? trimmed : String(trimmed.prefix(titleLimit)) + "…"
  }

  // MARK: - App Group 캐시

  public static func defaults() -> UserDefaults? {
    UserDefaults(suiteName: AppGroup.identifier)
  }

  public static func load(from defaults: UserDefaults? = WidgetSnapshot.defaults()) -> WidgetSnapshot? {
    guard let data = defaults?.data(forKey: defaultsKey) else { return nil }
    return try? JSONDecoder().decode(WidgetSnapshot.self, from: data)
  }

  public func save(to defaults: UserDefaults? = WidgetSnapshot.defaults()) {
    guard let defaults, let data = try? JSONEncoder().encode(self) else { return }
    defaults.set(data, forKey: Self.defaultsKey)
  }

  // MARK: - 만들기

  /// 오늘 일정과 가장 최근 메모를 읽어 스냅샷을 만든다.
  /// 끝나지 않은 것을 앞에 둔다 — 잠금화면 두 줄은 "아직 남은 것"에 써야 한다.
  public static func capture(
    memos: MemoStore, calendar: CalendarStore, ownerId: String, now: Date = Date()
  ) throws -> WidgetSnapshot {
    let blocks = try calendar.blocks(on: now)
    let ordered = blocks.filter { !$0.isCompleted } + blocks.filter(\.isCompleted)
    let latest = try memos.all().first
    return WidgetSnapshot(
      ownerId: ownerId,
      todos: ordered.map { Todo(id: $0.id, title: $0.title, isCompleted: $0.isCompleted) },
      latestMemoTitle: latest?.content,
      latestMemoId: latest?.id
    )
  }

  /// 앱이 목록을 그릴 때마다 부른다. 실패는 조용히 넘긴다 — 위젯 갱신이 안 됐다고
  /// 화면이 멈추면 안 된다. 내용이 그대로면 타임라인을 다시 부르지 않는다:
  /// 위젯 리로드 예산은 유한하고, 목록 화면은 자주 다시 그려진다.
  public static func refresh(
    memos: MemoStore, calendar: CalendarStore, ownerId: String, now: Date = Date()
  ) {
    guard let snapshot = try? capture(memos: memos, calendar: calendar, ownerId: ownerId, now: now),
          snapshot != load()
    else { return }
    snapshot.save()
    #if canImport(WidgetKit)
    WidgetCenter.shared.reloadAllTimelines()
    #endif
  }
}
