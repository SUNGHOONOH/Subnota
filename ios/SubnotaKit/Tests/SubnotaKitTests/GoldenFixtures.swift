import Foundation
import Testing

/// 데스크탑 JS 에서 생성한 고정 입출력. 값이 바뀌면 두 클라이언트가 갈렸다는
/// 뜻이므로 재생성하지 않는다.
enum GoldenFixtures {
  struct HashCase: Decodable {
    let input: String
    let expected: String
  }

  struct MergeCase: Decodable {
    let name: String
    let base: String
    let local: String
    let server: String
    let expectedOk: Bool
    let expectedText: String
  }

  struct Fixtures: Decodable {
    let hashText: [HashCase]
    let mergeMemoContent: [MergeCase]
  }

  static func load() throws -> Fixtures {
    let url = try #require(
      Bundle.module.url(forResource: "sync-golden", withExtension: "json")
    )
    return try JSONDecoder().decode(Fixtures.self, from: Data(contentsOf: url))
  }
}
