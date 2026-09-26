import Foundation

public enum AppGroupError: Error {
  case containerUnavailable
}

/// 본 앱·위젯·Share Extension이 같은 SQLite 파일을 열기 위한 단일 진실.
/// 기존 React Native 배포본의 App Group 컨테이너 데이터와 호환되도록 유지한다.
public enum AppGroup {
  public static let identifier = "group.com.subnota.capture"

  public static func databaseURL() throws -> URL {
    guard let container = FileManager.default
      .containerURL(forSecurityApplicationGroupIdentifier: identifier)
    else { throw AppGroupError.containerUnavailable }
    return container.appendingPathComponent("subnota-local.sqlite3")
  }
}
