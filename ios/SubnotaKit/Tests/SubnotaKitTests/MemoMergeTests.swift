import Foundation
import Testing
@testable import SubnotaKit

/// 데스크탑과 병합 결과가 다르면 같은 편집이 두 기기에서 다르게 끝난다.
/// 픽스처는 데스크탑 JS 에서 생성했다 — 여기 값을 고치지 말고 구현을 고칠 것.
@Test func mergeMatchesDesktopForEveryGoldenCase() throws {
  for testCase in try GoldenFixtures.load().mergeMemoContent {
    let result = MemoMerge.merge(
      base: testCase.base,
      local: testCase.local,
      server: testCase.server
    )
    #expect(result.ok == testCase.expectedOk, "case \(testCase.name): ok")
    #expect(result.text == testCase.expectedText, "case \(testCase.name): text")
  }
}

/// 병합 실패 경로가 실제로 존재해야 한다. 전부 성공만 통과하면
/// memo_recovery 경로가 한 번도 검증되지 않는다.
@Test func goldenFixturesCoverBothOutcomes() throws {
  let cases = try GoldenFixtures.load().mergeMemoContent
  #expect(cases.contains { $0.expectedOk })
  #expect(cases.contains { !$0.expectedOk })
}

@Test func rebasePrefersTheLiveEditorText() {
  // 편집기가 살아 있는 동안 정본이 바뀌면, 최신 타이핑을 잃지 않는 쪽으로 붙인다.
  let result = MemoMerge.rebaseEditorChange(
    previous: "hello",
    next: "hello world",
    canonical: "hello"
  )
  #expect(result.ok)
  #expect(result.text == "hello world")
}
