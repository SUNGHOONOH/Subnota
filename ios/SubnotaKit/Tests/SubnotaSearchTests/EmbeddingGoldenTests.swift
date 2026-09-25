import Foundation
import SubnotaKit
import Testing
@testable import SubnotaSearch

/// `e5-golden.json` 은 transformers.js 4.2.0 이 같은 revision 의 같은 q8 파일을
/// `pooling: 'mean', normalize: true` 로 돌려 만들었다. 토큰 id 도 함께 담았다 —
/// 벡터가 어긋나면 토크나이저 탓인지 풀링·추론 탓인지 가르기 위해서다.
private struct Golden: Decodable {
  struct Case: Decodable {
    let text: String
    let inputIds: [Int]
    let vector: [Float]
  }

  let cases: [Case]
}

/// 모델(135MB)은 저장소에 없다. `SUBNOTA_E5_MODEL_DIR` 가 `EmbeddingModel.files` 를
/// 담은 폴더를 가리킬 때만 돈다 — CI 는 받지 않는다.
///
///     SUBNOTA_E5_MODEL_DIR=/path/to/e5-small swift test --filter EmbeddingGolden
private let modelDirectory: URL? = {
  guard let path = ProcessInfo.processInfo.environment["SUBNOTA_E5_MODEL_DIR"] else { return nil }
  let directory = URL(fileURLWithPath: path, isDirectory: true)
  let complete = EmbeddingModel.files.allSatisfy {
    FileManager.default.fileExists(atPath: directory.appending(path: $0.path).path)
  }
  return complete ? directory : nil
}()

@Suite(.enabled(if: modelDirectory != nil, "SUBNOTA_E5_MODEL_DIR 에 모델이 없어 건너뜀"))
struct EmbeddingGoldenTests {
  @Test func matchesTransformersJs() async throws {
    let url = try #require(Bundle.module.url(forResource: "e5-golden", withExtension: "json"))
    let golden = try JSONDecoder().decode(Golden.self, from: Data(contentsOf: url))
    let engine = try await EmbeddingEngine(modelDirectory: try #require(modelDirectory))

    var lowest = 1.0
    for (index, item) in golden.cases.enumerated() {
      let label = "#\(index) \(item.text.prefix(30).debugDescription)"
      let ids = engine.tokenIds(item.text)
      #expect(ids == item.inputIds, "tokenizer diverged: \(label)")

      let vector = try engine.embed(prefixed: item.text)
      let cosine = EmbeddingMath.cosine(vector, item.vector)
      lowest = min(lowest, cosine)
      print("golden \(label) tokens=\(ids.count) match=\(ids == item.inputIds) cosine=\(String(format: "%.6f", cosine))")
      #expect(vector.count == EmbeddingModel.dimensions)
      #expect(cosine >= 0.999, "vector diverged: \(label) cosine=\(cosine)")
    }
    print("golden lowest cosine=\(String(format: "%.6f", lowest)) over \(golden.cases.count) cases")
  }

  @Test func prefixIsApplied() async throws {
    let engine = try await EmbeddingEngine(modelDirectory: try #require(modelDirectory))
    #expect(try engine.embed("다음 분기 로드맵 출시일", as: .query) == engine.embed(prefixed: "query: 다음 분기 로드맵 출시일"))
  }
}
