import Foundation

/// 모델 없이 검증할 수 있는 임베딩 수학. 확장에서 링크돼도 가볍다.
public enum EmbeddingMath {
  /// e5 풀링: attention mask 로 가중한 토큰 은닉 상태의 평균.
  /// 데스크탑 bge-m3 의 CLS 풀링(첫 토큰)과 다르다 — 틀려도 에러 없이 품질만 떨어진다.
  ///
  /// `hidden` 은 `[토큰 수 × dimensions]` 행 우선. transformers.js `mean_pooling` 처럼
  /// 합은 배정밀도로 쌓는다.
  public static func meanPool(hidden: [Float], mask: [Int], dimensions: Int) -> [Float] {
    precondition(hidden.count == mask.count * dimensions, "hidden/mask shape mismatch")
    var sums = [Double](repeating: 0, count: dimensions)
    var count = 0.0
    for (token, weight) in mask.enumerated() where weight != 0 {
      count += Double(weight)
      let base = token * dimensions
      for d in 0..<dimensions {
        sums[d] += Double(hidden[base + d]) * Double(weight)
      }
    }
    return sums.map { Float($0 / count) }
  }

  public static func l2Normalized(_ vector: [Float]) -> [Float] {
    let norm = vector.reduce(0.0) { $0 + Double($1) * Double($1) }.squareRoot()
    return vector.map { Float(Double($0) / norm) }
  }

  public static func cosine(_ a: [Float], _ b: [Float]) -> Double {
    precondition(a.count == b.count, "dimension mismatch")
    var dot = 0.0, normA = 0.0, normB = 0.0
    for i in a.indices {
      dot += Double(a[i]) * Double(b[i])
      normA += Double(a[i]) * Double(a[i])
      normB += Double(b[i]) * Double(b[i])
    }
    return dot / (normA * normB).squareRoot()
  }

  /// 벡터 BLOB: float32 리틀 엔디언을 이어 붙인다. 데스크탑이 `Float32Array` 버퍼를
  /// 그대로 저장하는 것과 같은 배치다. 384차원이면 1536B.
  public static func blob(from vector: [Float]) -> Data {
    var data = Data(capacity: vector.count * MemoryLayout<UInt32>.size)
    for value in vector {
      withUnsafeBytes(of: value.bitPattern.littleEndian) { data.append(contentsOf: $0) }
    }
    return data
  }

  /// 길이가 4의 배수가 아니면 손상된 BLOB 이다.
  public static func vector(fromBlob data: Data) -> [Float]? {
    let stride = MemoryLayout<UInt32>.size
    guard data.count % stride == 0 else { return nil }
    return data.withUnsafeBytes { raw in
      (0..<(data.count / stride)).map { index in
        Float(bitPattern: UInt32(littleEndian: raw.loadUnaligned(fromByteOffset: index * stride, as: UInt32.self)))
      }
    }
  }
}
