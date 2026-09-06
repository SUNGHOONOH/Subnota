import Foundation

/// 백엔드 URL. `SupabaseClientProvider` 와 같은 Info.plist 경로로 읽되 **없다고
/// 죽지는 않는다** — 계정 삭제에서만 쓰는 값이라, 없으면 그 버튼에서만 안내하면 된다.
/// xcconfig 에 키가 없으면 `$(MEMO_BACKEND_URL)` 이 빈 문자열로 남으므로 그것도 nil 이다.
enum BackendConfig {
  static var baseURL: URL? {
    guard
      let raw = Bundle.main.object(forInfoDictionaryKey: "MEMO_BACKEND_URL") as? String
    else { return nil }
    let trimmed = raw.trimmingCharacters(in: .whitespacesAndNewlines)
    guard !trimmed.isEmpty else { return nil }
    return URL(string: trimmed)
  }
}
