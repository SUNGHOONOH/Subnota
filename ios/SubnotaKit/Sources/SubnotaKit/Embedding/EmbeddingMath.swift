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

  // MARK: - 중심화 + CSLS
  //
  // 원본 코사인은 이 공간에서 쓸 수 없다. 무관한 문장쌍의 코사인 중앙값(0.866)이
  // 진짜 주제 연상(0.850)보다 **높다** — 모든 벡터가 공통 성분을 나눠 갖고(anisotropy),
  // 일부 문서는 아무거나와 가까운 허브가 된다(hubness). 공통 성분을 빼고(중심화)
  // 허브에 벌점을 물리면(CSLS) 의미 연상 중앙등수가 33 → 7 로 내려간다.
  //
  // 수식은 데스크탑 구현과 같아야 한다. 임의로 바꾸지 말 것.

  /// CSLS 이웃 수 k. 데스크탑과 같은 10.
  public static let neighborCount = 10

  /// 내적. 중심화한 벡터는 이미 단위 길이라 코사인과 같다 — 정규화를 다시 하지 않는다.
  public static func dot(_ a: [Float], _ b: [Float]) -> Double {
    precondition(a.count == b.count, "dimension mismatch")
    var sum = 0.0
    for i in a.indices { sum += Double(a[i]) * Double(b[i]) }
    return sum
  }

  /// 벡터 집합의 평균(muD, muQ). 비었으면 nil.
  public static func mean(of vectors: [[Float]]) -> [Float]? {
    guard let dimensions = vectors.first?.count else { return nil }
    var sums = [Double](repeating: 0, count: dimensions)
    for vector in vectors {
      precondition(vector.count == dimensions, "dimension mismatch")
      for d in 0..<dimensions { sums[d] += Double(vector[d]) }
    }
    return sums.map { Float($0 / Double(vectors.count)) }
  }

  /// 중심화: 공통 성분(평균)을 빼고 다시 단위 길이로.
  public static func centered(_ vector: [Float], mean: [Float]) -> [Float] {
    precondition(vector.count == mean.count, "dimension mismatch")
    let shifted = zip(vector, mean).map { $0 - $1 }
    let norm = shifted.reduce(0.0) { $0 + Double($1) * Double($1) }.squareRoot()
    // 코퍼스의 벡터가 전부 같으면(청크 한 개, 테스트) 중심화가 0 벡터를 만든다.
    // 0 으로 나누면 NaN 이 되어 정렬 자체가 무너진다 — 0 벡터로 둔다(모든 점수 0).
    guard norm > 1e-12 else { return [Float](repeating: 0, count: shifted.count) }
    return shifted.map { Float(Double($0) / norm) }
  }

  /// 상위 k 개 평균. k 가 개수보다 크면 있는 만큼, 비었으면 0(벌점 없음).
  public static func topKMean(_ values: [Double], k: Int = neighborCount) -> Double {
    let top = values.sorted(by: >).prefix(k)
    guard !top.isEmpty else { return 0 }
    return top.reduce(0, +) / Double(top.count)
  }

  /// 문서마다의 허브 벌점 r_i — 코퍼스의 모든 질의 벡터와의 내적 중 상위 k 평균.
  /// 아무와도 가까운 허브 문서일수록 커져서 점수에서 더 깎인다.
  ///
  /// j == i 를 빼지 않는다. 같은 청크라도 질의 벡터(`query: `)와 문서 벡터
  /// (`passage: `)는 접두사가 달라 서로 다른 벡터이고, 측정도 제외 없이 했다.
  ///
  /// ponytail: 전수 O(문서 × 질의). 데스크탑 측정에서 672청크 263ms(JS), 표본 추정은
  /// 잔차 0.08 로 점수 구간 폭과 맞먹어 쓸 수 없다고 확인됐다. 청크 3,000개쯤이면
  /// 다시 본다 — 그때는 Accelerate 행렬곱이나 근사 이웃이 먼저다.
  public static func hubPenalties(
    documents: [[Float]], queries: [[Float]], k: Int = neighborCount
  ) -> [Double] {
    documents.map { document in topKMean(queries.map { dot($0, document) }, k: k) }
  }

  /// CSLS 점수. **코사인과 달리 0~1 이 아니다** — 대략 −0.5 ~ 1.5.
  public static func csls(dot: Double, queryPenalty: Double, documentPenalty: Double) -> Double {
    2 * dot - queryPenalty - documentPenalty
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
