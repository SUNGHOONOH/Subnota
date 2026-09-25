import Foundation
import Supabase

/// 문구를 타입으로 고정한다. 호출부가 문자열을 지어내면 데스크탑과 갈린다.
/// 데스크탑 `services/backend/accountService.ts` 와 같은 문구다.
enum AccountError: LocalizedError {
  /// 빌드 설정에 MEMO_BACKEND_URL 이 없다. 데스크탑에서는 개발자용 메시지지만
  /// 여기서는 사용자가 볼 수 있으므로 사람이 읽을 문구를 준다.
  case notConfigured
  case needsSignIn
  case sessionExpired
  /// 5xx 와 네트워크 예외 — 다시 시도하면 될 수 있다.
  case temporarilyUnavailable
  /// 그 밖의 실패.
  case failed

  var errorDescription: String? {
    switch self {
    case .notConfigured: "계정 삭제 서버가 설정되지 않았습니다."
    case .needsSignIn: "계정 삭제를 위해 다시 로그인해 주세요."
    case .sessionExpired: "세션이 만료되었습니다. 다시 로그인해 주세요."
    case .temporarilyUnavailable: "계정 삭제를 완료하지 못했습니다. 잠시 후 다시 시도해 주세요."
    case .failed: "계정 삭제에 실패했습니다. 잠시 후 다시 시도해 주세요."
    }
  }
}

/// `DELETE /account`. 서버가 service-role 로 계정을 지운다 — 클라이언트는 부를 수
/// 없고 불러서도 안 된다. 로컬 정리와 로그아웃은 호출부의 몫이다(서버가 먼저다).
struct AccountService {
  private let client = SupabaseClientProvider.shared

  func deleteAccount() async throws {
    guard let baseURL = BackendConfig.baseURL else { throw AccountError.notConfigured }
    guard let session = try? await client.auth.session, !session.accessToken.isEmpty else {
      throw AccountError.needsSignIn
    }

    var request = URLRequest(url: baseURL.appendingPathComponent("account"))
    request.httpMethod = "DELETE"

    var status = try await send(request, token: session.accessToken)
    if status == 401 {
      // 재시도는 정확히 한 번. 루프로 만들면 계정 삭제를 반복 호출하게 된다.
      // 갱신된 세션이 다른 사용자면 중단한다 — 남의 계정을 지우게 된다.
      guard
        let refreshed = try? await client.auth.refreshSession(),
        refreshed.user.id == session.user.id
      else { throw AccountError.sessionExpired }
      status = try await send(request, token: refreshed.accessToken)
    }

    guard (200..<300).contains(status) else {
      throw status >= 500 ? AccountError.temporarilyUnavailable : AccountError.failed
    }
  }

  private func send(_ request: URLRequest, token: String) async throws -> Int {
    var request = request
    request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
    do {
      let (_, response) = try await URLSession.shared.data(for: request)
      // http(s) 요청의 응답은 항상 HTTPURLResponse 다. 아니면 500 과 같이 다룬다.
      return (response as? HTTPURLResponse)?.statusCode ?? 500
    } catch {
      // 네트워크 예외는 5xx 와 같이 다룬다 (데스크탑의 fetch catch 와 동일).
      throw AccountError.temporarilyUnavailable
    }
  }
}
