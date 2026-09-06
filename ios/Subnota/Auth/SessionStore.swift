import Foundation
import Supabase

@MainActor
@Observable
final class SessionStore {
  private(set) var userId: String?
  private(set) var isLoading = true
  var errorMessage: String?

  private let client = SupabaseClientProvider.shared

  /// 앱 시작 시 저장된 세션을 복원한다. 실패는 정상 — 로그인 화면으로 간다.
  func restore() async {
    defer { isLoading = false }
    userId = try? await client.auth.session.user.id.uuidString
  }

  func signIn(email: String, password: String) async {
    errorMessage = nil
    isLoading = true
    defer { isLoading = false }
    do {
      let session = try await client.auth.signIn(email: email, password: password)
      userId = session.user.id.uuidString
    } catch {
      errorMessage = "로그인하지 못했습니다. 이메일과 비밀번호를 확인해 주세요."
    }
  }

  /// 데스크탑과 같은 리다이렉트를 쓴다 (`data.ts` 의 OAUTH_REDIRECT_URL).
  /// 이 값은 Supabase 프로젝트에 이미 등록돼 있어 백엔드 설정이 필요 없다.
  private static let oauthRedirect = URL(string: "subnota://auth/callback")!

  /// Google·Kakao 로그인. supabase-swift 의 ASWebAuthenticationSession 오버로드가
  /// 브라우저 시트와 콜백 회수를 모두 처리한다 — 우리가 URL 을 열거나 스킴을
  /// 받아넘길 필요가 없다.
  func signIn(with provider: Provider) async {
    errorMessage = nil
    isLoading = true
    defer { isLoading = false }
    do {
      let session = try await client.auth.signInWithOAuth(
        provider: provider,
        redirectTo: Self.oauthRedirect
      )
      userId = session.user.id.uuidString
    } catch is CancellationError {
      // 사용자가 시트를 닫은 것은 실패가 아니다. 조용히 돌아간다.
    } catch {
      errorMessage = "로그인하지 못했습니다. 잠시 후 다시 시도해 주세요."
    }
  }

  func signOut() async {
    try? await client.auth.signOut()
    userId = nil
  }
}
