import Foundation
import SubnotaKit
import Supabase

/// 문구를 타입으로 고정한다 — `AccountError` 와 같은 결이다.
enum InboxError: LocalizedError {
  case notConfigured
  case needsSignIn
  case sessionExpired
  case failed

  var errorDescription: String? {
    switch self {
    case .notConfigured: "링크 서버가 설정되지 않았습니다."
    case .needsSignIn: "링크를 보려면 다시 로그인해 주세요."
    case .sessionExpired: "세션이 만료되었습니다. 다시 로그인해 주세요."
    case .failed: "링크를 가져오지 못했습니다. 잠시 후 다시 시도해 주세요."
    }
  }
}

/// 데스크탑 `services/backend/inboxService.ts` 와 같은 계약이다.
///
/// **전부 백엔드를 지나간다.** `inbox_sessions` 에는 클라이언트용 RLS 정책이 없어서
/// (2026-06-23 보안 마이그레이션에서 client grant 를 revoke 했다) Supabase 를 직접
/// 치면 조용히 실패한다 — 특히 좋아요가 그렇다. 백엔드가 bearer 토큰에서 뽑은
/// user id 로 행을 좁힌다.
struct InboxRemote {
  private let client = SupabaseClientProvider.shared

  /// 데스크탑 `INBOX_REQUEST_TIMEOUT_MS`. 연결과 멈춘 응답 본문을 같이 덮는다.
  private static let timeout: TimeInterval = 20

  /// `GET /inbox/sessions?limit=50`
  func list() async throws -> [InboxSession] {
    let payload = try await send(
      request("/inbox/sessions?limit=50"), as: ItemsEnvelope.self)
    return payload.items.map { $0.toSession() }
  }

  /// `POST /inbox/sessions`. `clientId` 는 공유 확장이 만든 항목을 중복 없이
  /// 이어 붙이는 열쇠다 — 같은 값을 두 번 보내면 서버가 하나로 친다.
  func create(
    url: String,
    clientId: String? = nil,
    rawSharedText: String? = nil,
    selectedText: String? = nil,
    userNote: String? = nil
  ) async throws -> InboxSession {
    let payload = try await send(
      request(
        "/inbox/sessions", method: "POST",
        body: CreateBody(
          clientId: clientId, rawSharedText: rawSharedText, selectedText: selectedText,
          url: url, userNote: userNote)),
      as: ItemEnvelope.self)
    return payload.item.toSession()
  }

  /// `POST /inbox/sessions/analyze`. 새 세션을 만들지 않고 같은 `session_id` 를
  /// 다시 분석하므로 카드가 중복되지 않는다.
  func retrySummary(id: String) async throws -> InboxSession {
    let payload = try await send(
      request("/inbox/sessions/analyze", method: "POST", body: AnalyzeBody(sessionId: id)),
      as: ItemEnvelope.self)
    return payload.item.toSession()
  }

  /// `PATCH /inbox/sessions/{id}/liked`
  func setLiked(id: String, liked: Bool) async throws {
    _ = try await perform(
      request("/inbox/sessions/\(escape(id))/liked", method: "PATCH", body: LikedBody(liked: liked))
    )
  }

  /// `DELETE /inbox/sessions/{id}`. 백엔드는 멱등이다 — 이미 없는 세션도 성공이다.
  func delete(id: String) async throws {
    _ = try await perform(request("/inbox/sessions/\(escape(id))", method: "DELETE"))
  }

  // MARK: - 요청

  /// `encodeURIComponent` 와 같은 허용 문자다. `/` 가 살아남으면 id 가 경로를
  /// 갈라서 다른 엔드포인트를 치게 된다.
  private static let unescaped = CharacterSet(charactersIn: "-_.!~*'()").union(.alphanumerics)

  private func escape(_ value: String) -> String {
    value.addingPercentEncoding(withAllowedCharacters: Self.unescaped) ?? value
  }

  /// 데스크탑과 같이 베이스 URL 의 끝 슬래시를 떼고 경로를 잇는다. 쿼리가 붙는
  /// 경로가 있어서 `appendingPathComponent` 는 못 쓴다.
  private func request(_ path: String, method: String = "GET", body: (any Encodable)? = nil) throws
    -> URLRequest
  {
    guard
      let base = BackendConfig.baseURL,
      let url = URL(
        string: base.absoluteString.hasSuffix("/")
          ? String(base.absoluteString.dropLast()) + path : base.absoluteString + path)
    else { throw InboxError.notConfigured }

    var request = URLRequest(url: url)
    request.httpMethod = method
    request.timeoutInterval = Self.timeout
    request.setValue("application/json", forHTTPHeaderField: "Content-Type")
    if let body { request.httpBody = try JSONEncoder().encode(body) }
    return request
  }

  private func send<T: Decodable>(_ request: URLRequest, as type: T.Type) async throws -> T {
    let data = try await perform(request)
    do {
      return try JSONDecoder().decode(type, from: data)
    } catch {
      log(error)
      throw InboxError.failed
    }
  }

  private func perform(_ request: URLRequest) async throws -> Data {
    guard let session = try? await client.auth.session, !session.accessToken.isEmpty else {
      throw InboxError.needsSignIn
    }

    var result = try await send(request, token: session.accessToken)
    if result.status == 401 {
      // 재시도는 정확히 한 번. 루프로 만들면 갱신이 안 되는 동안 서버를 두드린다.
      // 갱신된 세션이 다른 사용자면 중단한다 — 남의 링크를 보게 된다.
      guard
        let refreshed = try? await client.auth.refreshSession(),
        refreshed.user.id == session.user.id
      else { throw InboxError.sessionExpired }
      result = try await send(request, token: refreshed.accessToken)
    }

    guard (200..<300).contains(result.status) else { throw InboxError.failed }
    return result.data
  }

  private func send(_ request: URLRequest, token: String) async throws -> (data: Data, status: Int) {
    var request = request
    request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
    do {
      let (data, response) = try await URLSession.shared.data(for: request)
      // http(s) 요청의 응답은 항상 HTTPURLResponse 다. 아니면 500 과 같이 다룬다.
      return (data, (response as? HTTPURLResponse)?.statusCode ?? 500)
    } catch {
      log(error)
      throw InboxError.failed
    }
  }

  private func log(_ error: Error) {
    #if DEBUG
      print("[Subnota][inbox] \(String(reflecting: error))")
    #endif
  }

  // MARK: - 본문·응답

  private struct CreateBody: Encodable {
    let clientId: String?
    let rawSharedText: String?
    let selectedText: String?
    let url: String
    let userNote: String?

    enum CodingKeys: String, CodingKey {
      case clientId = "client_id"
      case rawSharedText = "raw_shared_text"
      case selectedText = "selected_text"
      case url
      case userNote = "user_note"
    }
  }

  private struct AnalyzeBody: Encodable {
    let sessionId: String

    enum CodingKeys: String, CodingKey {
      case sessionId = "session_id"
    }
  }

  private struct LikedBody: Encodable {
    let liked: Bool
  }

  private struct ItemsEnvelope: Decodable {
    let items: [InboxSessionRow]
  }

  private struct ItemEnvelope: Decodable {
    let item: InboxSessionRow
  }
}
