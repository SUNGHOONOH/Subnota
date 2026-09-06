import Foundation
import Supabase

@MainActor
@Observable
final class SessionStore {
  private(set) var userId: String?
  /// 앱 시작 시 세션 복원 중인지. 이 값만 RootView 의 전체 화면 스피너를 켠다.
  private(set) var isRestoring = true
  /// 폼 안에서 진행 중인 요청. 로그인 화면은 계속 보이고 컨트롤만 잠긴다 —
  /// OAuth 중에 화면이 통째로 사라지면 사용자가 무슨 일이 벌어지는지 알 수 없다.
  private(set) var isBusy = false
  var errorMessage: String?
  /// 가입 후 이메일 확인이 필요할 때 보여줄 안내.
  var noticeMessage: String?

  private let client = SupabaseClientProvider.shared

  /// 앱 시작 시 저장된 세션을 복원한다. 실패는 정상 — 로그인 화면으로 간다.
  func restore() async {
    defer { isRestoring = false }
    userId = try? await client.auth.session.user.id.uuidString
  }

  func signIn(email: String, password: String) async {
    await run(failureMessage: "로그인하지 못했습니다. 이메일과 비밀번호를 확인해 주세요.") {
      let session = try await self.client.auth.signIn(email: email, password: password)
      self.userId = session.user.id.uuidString
    }
  }

  /// 데스크탑과 같은 규칙: 8자 이상, 대·소문자와 숫자를 각각 포함
  /// (`desktop/src/features/auth/authValidation.ts`).
  static func isStrongPassword(_ password: String) -> Bool {
    password.count >= 8
      && password.contains(where: \.isLowercase)
      && password.contains(where: \.isUppercase)
      && password.contains(where: \.isNumber)
  }

  func signUp(email: String, password: String) async {
    await run(failureMessage: "가입하지 못했습니다. 잠시 후 다시 시도해 주세요.") {
      let response = try await self.client.auth.signUp(email: email, password: password)
      if let session = response.session {
        self.userId = session.user.id.uuidString
      } else {
        // 이메일 확인이 켜져 있으면 세션 없이 돌아온다. 가입은 접수된 상태다.
        self.noticeMessage = "확인 메일을 보냈습니다. 메일의 링크를 눌러 가입을 마쳐 주세요."
      }
    }
  }

  /// 데스크탑과 같은 리다이렉트를 쓴다 (`data.ts` 의 OAUTH_REDIRECT_URL).
  /// 이 값은 Supabase 프로젝트에 이미 등록돼 있어 백엔드 설정이 필요 없다.
  private static let oauthRedirect = URL(string: "subnota://auth/callback")!

  /// Google·Kakao 로그인. supabase-swift 의 ASWebAuthenticationSession 오버로드가
  /// 브라우저 시트와 콜백 회수를 모두 처리한다 — 우리가 URL 을 열거나 스킴을
  /// 받아넘길 필요가 없다.
  func signIn(with provider: Provider) async {
    await run(failureMessage: "로그인하지 못했습니다. 잠시 후 다시 시도해 주세요.") {
      let session = try await self.client.auth.signInWithOAuth(
        provider: provider,
        redirectTo: Self.oauthRedirect
      )
      self.userId = session.user.id.uuidString
    }
  }

  func signOut() async {
    try? await client.auth.signOut()
    userId = nil
  }

  /// 폼 요청의 공통 껍데기. 사용자가 시트를 닫은 것은 실패가 아니므로 조용히 넘긴다.
  private func run(
    failureMessage: String,
    _ body: @escaping () async throws -> Void
  ) async {
    errorMessage = nil
    noticeMessage = nil
    isBusy = true
    defer { isBusy = false }
    do {
      try await body()
    } catch is CancellationError {
      // 사용자가 취소했다.
    } catch {
      errorMessage = failureMessage
    }
  }
}
