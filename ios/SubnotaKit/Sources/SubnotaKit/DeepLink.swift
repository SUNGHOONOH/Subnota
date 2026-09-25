import Foundation

/// 위젯이 앱을 여는 주소. 앱의 `onOpenURL` 은 이 파서를 통과한 것만 처리한다.
///
/// **`subnota://` 스킴은 OAuth 콜백(`subnota://auth/callback`)과 같이 쓴다.**
/// 그 콜백은 supabase-swift 의 `ASWebAuthenticationSession` 이 완료 핸들러로 스스로
/// 받으므로 앱의 URL 처리를 거치지 않는다. 그래도 혹시 들어오면 여기서 `nil` 이 돼
/// 아무 일도 일어나지 않아야 한다. 그래서 아는 주소만 받고 나머지는 전부 버린다 —
/// `auth` 호스트는 절대 딥링크로 쓰지 않는다.
public enum DeepLink: Equatable, Sendable {
  /// `subnota://calendar`
  case calendar
  /// `subnota://memo/new`
  case newMemo
  /// `subnota://memo/<id>`
  case memo(id: String)

  static let scheme = "subnota"

  public init?(url: URL) {
    guard let parts = URLComponents(url: url, resolvingAgainstBaseURL: false),
          parts.scheme?.lowercased() == Self.scheme
    else { return nil }
    let path = parts.path.split(separator: "/").map(String.init)
    switch (parts.host, path.count) {
    case ("calendar", 0): self = .calendar
    case ("memo", 1) where path[0] == "new": self = .newMemo
    case ("memo", 1): self = .memo(id: path[0])
    default: return nil
    }
  }

  public var url: URL {
    var parts = URLComponents()
    parts.scheme = Self.scheme
    switch self {
    case .calendar:
      parts.host = "calendar"
    case .newMemo:
      parts.host = "memo"
      parts.path = "/new"
    case .memo(let id):
      parts.host = "memo"
      parts.path = "/\(id)"
    }
    // 호스트가 있고 경로가 "/" 로 시작하므로 항상 만들어진다.
    return parts.url!
  }
}
