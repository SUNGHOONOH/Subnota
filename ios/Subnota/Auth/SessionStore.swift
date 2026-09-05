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

  func signOut() async {
    try? await client.auth.signOut()
    userId = nil
  }
}
