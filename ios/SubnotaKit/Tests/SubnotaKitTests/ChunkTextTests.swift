import Foundation
import Testing

@testable import SubnotaKit

/// `chunktext-golden.json` 은 데스크탑 `lib/chunkText.ts` 를 그대로 돌려서 만들었다.
/// 값이 바뀌면 두 클라이언트가 갈렸다는 뜻이므로 재생성하지 않는다 —
/// 같은 본문이 기기마다 다른 벡터가 되면 검색이 조용히 나빠진다.
@Suite("ChunkText 골든 픽스처")
struct ChunkTextGoldenTests {
  struct Case: Decodable {
    let input: String
    let normalized: String
    let searchable: Bool
  }

  struct Fixtures: Decodable {
    let note: String
    let cases: [Case]
  }

  static func load() throws -> Fixtures {
    let url = try #require(
      Bundle.module.url(forResource: "chunktext-golden", withExtension: "json"))
    return try JSONDecoder().decode(Fixtures.self, from: Data(contentsOf: url))
  }

  @Test("정규화가 데스크탑과 글자까지 같다")
  func normalizationMatchesDesktop() throws {
    let fixtures = try Self.load()
    #expect(fixtures.cases.count >= 40)
    for item in fixtures.cases {
      let actual = ChunkText.normalized(item.input)
      // 문자열 == 은 정준 동치라 조합·완성형이 같다고 나온다. 벡터는 바이트로
      // 갈리므로 UTF-16 코드 유닛으로 비교한다.
      #expect(
        Array(actual.utf16) == Array(item.normalized.utf16),
        "입력 \(item.input.debugDescription): \(actual.debugDescription) != \(item.normalized.debugDescription)"
      )
    }
  }

  @Test("색인 제외 판정이 데스크탑과 같다")
  func searchabilityMatchesDesktop() throws {
    for item in try Self.load().cases {
      #expect(
        ChunkText.hasSearchableContent(item.input) == item.searchable,
        "입력 \(item.input.debugDescription)")
    }
  }
}

@Suite("ChunkText 동작")
struct ChunkTextBehaviorTests {
  @Test("하이라이트 마크업을 벗겨 본문만 남긴다")
  func stripsHighlightMarkup() {
    let raw = "## <mark data-color=\"var(--tt-color-highlight-green)\">다른 앱 아이디어</mark>"
    #expect(ChunkText.normalized(raw) == "다른 앱 아이디어")
    #expect(ChunkText.hasSearchableContent(raw))
  }

  @Test("부등호를 태그로 착각하지 않는다")
  func keepsComparisonOperators() {
    #expect(ChunkText.normalized("조건은 3 < 5 그리고 7 > 2 이다") == "조건은 3 < 5 그리고 7 > 2 이다")
  }

  @Test("엔티티는 지우지 않고 글자로 되돌린다")
  func expandsEntities() {
    #expect(ChunkText.normalized("천안시 =&gt; 수도권") == "천안시 => 수도권")
    #expect(ChunkText.normalized("&nbsp;") == "")
  }

  /// ICU 의 `\s` 는 세로탭과 ZWNBSP 를 빼먹는다. 명시 문자 클래스를 쓰는 이유다.
  @Test("JS 가 공백으로 치는 문자를 모두 공백으로 친다")
  func matchesJavaScriptWhitespace() {
    #expect(ChunkText.normalized("앞\u{000B}뒤") == "앞 뒤")
    #expect(ChunkText.normalized("앞\u{FEFF}뒤") == "앞 뒤")
  }

  @Test("내용 없는 청크를 걸러낸다")
  func dropsEmptyChunks() {
    #expect(!ChunkText.hasSearchableContent("&nbsp;"))
    #expect(!ChunkText.hasSearchableContent("1."))
    #expect(!ChunkText.hasSearchableContent("교통"))
    #expect(ChunkText.hasSearchableContent("전체적으로 교통의 문제"))
  }
}
