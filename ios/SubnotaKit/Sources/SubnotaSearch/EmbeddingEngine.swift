import Foundation
import OnnxRuntimeBindings
import SubnotaKit
import Tokenizers

public enum EmbeddingError: Error {
  case invalidOutput
}

/// 온디바이스 e5 임베딩. 이 타겟은 앱만 링크한다 — `Package.swift` 참고.
///
/// 풀링은 attention mask 평균 + L2 정규화다. 데스크탑 `local-embedding-runtime.ts` 의
/// `pooling: 'cls'` 는 bge-m3 용이라 따라 하지 않는다. 골든 테스트가 이를 고정한다.
public final class EmbeddingEngine: @unchecked Sendable {
  // ponytail: 잠금 없음. ORTSession.run 은 스레드 안전하고(ORT 문서) 토크나이저는
  // 불변이다. 동시 호출이 메모리를 과하게 쓰면 호출부에서 직렬화한다.
  private let env: ORTEnv
  private let session: ORTSession
  private let inputNames: Set<String>
  private let tokenizer: any Tokenizer

  /// `modelDirectory` 는 `EmbeddingModel.files` 가 모두 들어 있는 로컬 폴더다.
  /// Hub 네트워크 로딩을 쓰지 않는다.
  public init(modelDirectory: URL) async throws {
    tokenizer = try await AutoTokenizer.from(modelFolder: modelDirectory)
    env = try ORTEnv(loggingLevel: .warning)
    let weights = modelDirectory.appending(path: EmbeddingModel.weights.path)
    // 데스크탑은 색인 세션만 스레드 2개로 묶는다(대화형 검색을 막지 않으려고).
    // 여기는 색인과 검색이 세션 하나를 같이 쓴다 — 두 개면 가중치를 두 번 올린다 —
    // 그래서 세션 전체를 2개로 묶는다. 색인이 도는 동안에도 UI 와 질의에 코어가 남는다.
    let options = try ORTSessionOptions()
    try options.setIntraOpNumThreads(2)
    session = try ORTSession(env: env, modelPath: weights.path, sessionOptions: options)
    inputNames = Set(try session.inputNames())
  }

  /// 접두사를 여기서 붙인다 — 호출부가 빠뜨릴 수 없게.
  public func embed(_ text: String, as kind: EmbeddingModel.Kind) throws -> [Float] {
    try embed(prefixed: kind.prefix + text)
  }

  /// transformers.js 는 한도를 넘으면 `input_ids` 를 그냥 512 에서 자른다
  /// (`truncateHelper`) — 끝의 `</s>` 도 잘려 나간다. Python HF 는 `</s>` 를 남기지만
  /// 기준 벡터가 transformers.js 라 그쪽을 따른다.
  func tokenIds(_ prefixed: String) -> [Int] {
    Array(tokenizer.encode(text: prefixed).prefix(EmbeddingModel.maxTokens))
  }

  func embed(prefixed text: String) throws -> [Float] {
    let ids = tokenIds(text)
    let shape: [NSNumber] = [1, NSNumber(value: ids.count)]
    func tensor(_ values: [Int64]) throws -> ORTValue {
      let data = values.withUnsafeBytes { NSMutableData(bytes: $0.baseAddress, length: $0.count) }
      return try ORTValue(tensorData: data, elementType: .int64, shape: shape)
    }

    // 한 건씩 넣으므로 패딩이 없다 — 마스크는 전부 1.
    let mask = [Int](repeating: 1, count: ids.count)
    let candidates: [String: [Int64]] = [
      "input_ids": ids.map(Int64.init),
      "attention_mask": mask.map(Int64.init),
      "token_type_ids": [Int64](repeating: 0, count: ids.count),
    ]
    let inputs = try candidates
      .filter { inputNames.contains($0.key) }
      .mapValues(tensor)

    let outputs = try session.run(
      withInputs: inputs,
      outputNames: ["last_hidden_state"],
      runOptions: nil
    )
    guard let output = outputs["last_hidden_state"] else { throw EmbeddingError.invalidOutput }
    let raw = try output.tensorData() as Data
    let hidden = raw.withUnsafeBytes { Array($0.bindMemory(to: Float.self)) }
    guard hidden.count == ids.count * EmbeddingModel.dimensions else { throw EmbeddingError.invalidOutput }

    let vector = EmbeddingMath.l2Normalized(
      EmbeddingMath.meanPool(hidden: hidden, mask: mask, dimensions: EmbeddingModel.dimensions)
    )
    guard vector.allSatisfy(\.isFinite) else { throw EmbeddingError.invalidOutput }
    return vector
  }
}
