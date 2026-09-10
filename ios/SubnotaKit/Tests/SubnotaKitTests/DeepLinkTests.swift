import Foundation
import Testing

@testable import SubnotaKit

private func link(_ string: String) -> DeepLink? {
  DeepLink(url: URL(string: string)!)
}

// MARK: - 아는 경로

@Test func deepLinkParsesTheKnownPaths() {
  #expect(link("subnota://calendar") == .calendar)
  #expect(link("subnota://memo/new") == .newMemo)
  #expect(link("subnota://memo/3f2a9c1e-0000-4000-8000-000000000001")
    == .memo(id: "3f2a9c1e-0000-4000-8000-000000000001"))
}

@Test func deepLinkRoundTripsThroughItsURL() {
  for original in [DeepLink.calendar, .newMemo, .memo(id: "abc-123")] {
    #expect(DeepLink(url: original.url) == original)
  }
}

// MARK: - OAuth 콜백은 절대 딥링크가 아니다

/// `subnota://auth/callback` 은 supabase-swift 의 ASWebAuthenticationSession 이
/// 스스로 받는다. 라우터가 이걸 가로채거나 무언가를 하면 로그인이 깨진다.
@Test func oauthCallbackIsNotADeepLink() {
  #expect(link("subnota://auth/callback") == nil)
  #expect(link("subnota://auth/callback?code=abc&state=xyz") == nil)
  #expect(link("subnota://auth/callback#access_token=abc") == nil)
  #expect(link("subnota://auth") == nil)
  #expect(link("subnota://AUTH/callback") == nil)
}

// MARK: - 모르는 것은 전부 무시

@Test func deepLinkIgnoresUnknownURLs() {
  #expect(link("subnota://") == nil)
  #expect(link("subnota://unknown") == nil)
  #expect(link("subnota://calendar/extra") == nil)
  #expect(link("subnota://memo") == nil)
  #expect(link("subnota://memo/") == nil)
  #expect(link("subnota://memo/a/b") == nil)
  #expect(link("https://calendar") == nil)
  #expect(link("https://example.com/memo/new") == nil)
  #expect(link("otherapp://calendar") == nil)
}
