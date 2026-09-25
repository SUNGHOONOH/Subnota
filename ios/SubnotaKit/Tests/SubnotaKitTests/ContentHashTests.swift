import Foundation
import Testing
@testable import SubnotaKit

/// 데스크탑과 해시가 다르면 서버가 모든 푸시를 충돌로 판정한다.
@Test func hashMatchesDesktopForEveryGoldenCase() throws {
  for testCase in try GoldenFixtures.load().hashText {
    #expect(
      ContentHash.hash(testCase.input) == testCase.expected,
      "input \(testCase.input.debugDescription)"
    )
  }
}

/// charCodeAt 은 UTF-16 코드 유닛이다. 바이트나 unicodeScalars 로 순회하면
/// 이 케이스들에서 데스크탑과 갈린다.
@Test func hashUsesUTF16CodeUnitsNotScalarsOrBytes() throws {
  let fixtures = try GoldenFixtures.load()
  for name in ["👍", "a👍b", "안녕하세요"] {
    let testCase = try #require(fixtures.hashText.first { $0.input == name })
    #expect(ContentHash.hash(testCase.input) == testCase.expected)
  }
}

@Test func hashIsStableAndDiffersOnChange() {
  #expect(ContentHash.hash("abc") == ContentHash.hash("abc"))
  #expect(ContentHash.hash("abc") != ContentHash.hash("abd"))
}
