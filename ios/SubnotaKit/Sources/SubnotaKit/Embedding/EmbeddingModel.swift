import Foundation

/// iOS 검색 모델 고정값. 데스크탑 `local-embedding-config.ts` 처럼 revision·바이트·
/// SHA256 으로 고정한다 — 다른 revision 이 섞이면 받은 파일을 버린다.
///
/// 데스크탑(`Xenova/bge-m3`, 1024차원, CLS 풀링)과 모델·차원·풀링이 모두 다르다.
/// 값을 옮겨 적지 말 것.
public enum EmbeddingModel {
  public static let repo = "Xenova/multilingual-e5-small"
  public static let revision = "761b726dd34fb83930e26aab4e9ac3899aa1fa78"
  public static let dimensions = 384
  /// 모델 한도. transformers.js 와 같은 방식으로 자른다(`EmbeddingEngine` 참고).
  public static let maxTokens = 512

  public struct File: Sendable, Equatable {
    public let path: String
    public let bytes: Int64
    public let sha256: String

    public init(path: String, bytes: Int64, sha256: String) {
      self.path = path
      self.bytes = bytes
      self.sha256 = sha256
    }
  }

  public static let weights = File(
    path: "onnx/model_quantized.onnx",
    bytes: 118_308_185,
    sha256: "f80102d3f2a1229f387d3c81909990d8945513e347b0eab049f7de3c6f98c193"
  )

  /// 엔진이 실제로 읽는 파일만 받는다. `config.json` 은 토크나이저가 없어도 되고
  /// `special_tokens_map.json` 은 아무도 읽지 않는다.
  public static let files: [File] = [
    weights,
    File(
      path: "tokenizer.json",
      bytes: 17_082_730,
      sha256: "0b44a9d7b51c3c62626640cda0e2c2f70fdacdc25bbbd68038369d14ebdf4c39"
    ),
    // 토크나이저 클래스(XLMRobertaTokenizer → Unigram)를 여기서 고른다.
    File(
      path: "tokenizer_config.json",
      bytes: 443,
      sha256: "a1d6bc8734a6f635dc158508bef000f8e2e5a759c7d92f984b2c86e5ff53425b"
    ),
  ]

  /// 저장된 벡터가 어느 공간에 있는지. 모델·양자화·풀링 중 하나라도 바뀌면 벡터가
  /// 달라지므로 셋 다 담는다 — 다르면 옛 벡터를 전부 버린다(`VectorStore`).
  /// 데스크탑 `EMBEDDING_MODEL_ID` 에 풀링을 더한 모양이다.
  ///
  /// `v2` = 청크마다 `passage: `/`query: ` 벡터를 **둘 다** 저장한다(CSLS 에 필요).
  /// `norm1` = 임베딩 전에 `ChunkText.normalized` 로 마크업을 벗긴다. 규칙이 바뀌면
  /// 같은 본문이 다른 벡터가 되므로 숫자를 올려야 한다. 데스크탑 `NORMALIZATION_VERSION`
  /// 과 같은 값을 쓴다. 채점(중심화·CSLS)은 저장된 벡터 위의 계산이라 여기 넣지 않는다 —
  /// 넣으면 채점을 손볼 때마다 전체 재색인이 돈다.
  /// 서명이 바뀌면 옛 벡터는 자동으로 버려지고 다시 색인된다(`VectorStore`).
  public static let signature = "\(repo)@\(revision):onnx-q8:mean:v2:norm1"

  public static var totalBytes: Int64 { files.reduce(0) { $0 + $1.bytes } }

  public static func url(for file: File) -> URL {
    // 상수만으로 만든 문자열이라 실패하지 않는다.
    URL(string: "https://huggingface.co/\(repo)/resolve/\(revision)/\(file.path)")!
  }

  /// 앱 전용 Application Support. App Group 이 아니다 — 위젯은 검색하지 않고,
  /// 공유 컨테이너에 135MB 를 둘 이유가 없다.
  public static func directory() throws -> URL {
    try FileManager.default
      .url(for: .applicationSupportDirectory, in: .userDomainMask, appropriateFor: nil, create: true)
      .appending(path: "EmbeddingModel/\(revision)", directoryHint: .isDirectory)
  }

  /// e5 는 접두사가 필수다. 빼면 에러 없이 품질만 급락한다.
  public enum Kind: Sendable {
    case passage
    case query

    public var prefix: String {
      switch self {
      case .passage: "passage: "
      case .query: "query: "
      }
    }
  }
}
