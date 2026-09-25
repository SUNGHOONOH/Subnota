import Foundation
import Testing
@testable import SubnotaKit

struct EmbeddingMathTests {
  @Test func meanPoolIgnoresMaskedTokens() {
    // 3 토큰 × 2차원. 마지막 토큰은 패딩이라 평균에서 빠져야 한다.
    let hidden: [Float] = [1, 2, 3, 4, 100, 100]
    #expect(EmbeddingMath.meanPool(hidden: hidden, mask: [1, 1, 0], dimensions: 2) == [2, 3])
  }

  @Test func meanPoolIsNotClsPooling() {
    // 데스크탑 bge-m3 는 첫 토큰(CLS)을 쓴다. e5 는 평균이다.
    let hidden: [Float] = [1, 0, 3, 4]
    #expect(EmbeddingMath.meanPool(hidden: hidden, mask: [1, 1], dimensions: 2) != [1, 0])
  }

  @Test func normalizesToUnitLength() {
    let unit = EmbeddingMath.l2Normalized([3, 4])
    #expect(unit == [0.6, 0.8])
  }

  @Test func cosineBounds() {
    #expect(abs(EmbeddingMath.cosine([1, 2, 3], [2, 4, 6]) - 1) < 1e-12)
    #expect(EmbeddingMath.cosine([1, 0], [0, 1]) == 0)
    #expect(abs(EmbeddingMath.cosine([1, 0], [-1, 0]) + 1) < 1e-12)
  }

  @Test func blobRoundTripsAt1536Bytes() throws {
    let vector = (0..<EmbeddingModel.dimensions).map { Float($0) * 0.001 - 0.19 }
    let blob = EmbeddingMath.blob(from: vector)
    #expect(blob.count == 1536)
    #expect(try #require(EmbeddingMath.vector(fromBlob: blob)) == vector)
  }

  @Test func blobIsLittleEndianFloat32() {
    // 데스크탑 `Float32Array` 버퍼와 같은 배치: 1.0 = 0x3F800000 → 00 00 80 3F.
    #expect([UInt8](EmbeddingMath.blob(from: [1])) == [0x00, 0x00, 0x80, 0x3F])
    #expect(EmbeddingMath.vector(fromBlob: Data([0x00, 0x00, 0x80, 0x3F])) == [1])
  }

  @Test func rejectsTruncatedBlob() {
    #expect(EmbeddingMath.vector(fromBlob: Data([0, 0, 0])) == nil)
  }

  // MARK: - 중심화 + CSLS

  @Test func meanIsTheComponentwiseAverage() {
    // 벡터는 Float 라 4/3 을 Double 로 적으면 마지막 자리에서 갈린다. 오차로 본다.
    let mean = try! #require(EmbeddingMath.mean(of: [[1, 0], [0, 1], [2, 3]]))
    #expect(mean.count == 2)
    #expect(abs(mean[0] - 1) < 1e-6)
    #expect(abs(mean[1] - 4.0 / 3.0) < 1e-6)
    #expect(EmbeddingMath.mean(of: []) == nil)
  }

  @Test func centeringSubtractsTheMeanThenNormalizes() {
    let centered = EmbeddingMath.centered([1, 0], mean: [0.5, 0.5])  // [0.5, -0.5]
    #expect(abs(Double(centered[0]) - 0.5.squareRoot()) < 1e-6)
    #expect(abs(Double(centered[1]) + 0.5.squareRoot()) < 1e-6)
  }

  /// 코퍼스의 벡터가 전부 같으면 중심화가 0 벡터를 만든다. NaN 이 나오면 정렬이 무너진다.
  @Test func centeringOnItsOwnMeanGivesZeroNotNaN() {
    #expect(EmbeddingMath.centered([0.3, 0.4], mean: [0.3, 0.4]) == [0, 0])
  }

  @Test func topKMeanUsesWhatIsThereWhenKExceedsTheCorpus() {
    #expect(EmbeddingMath.topKMean([5, 1, 4, 2, 3], k: 2) == 4.5)
    #expect(EmbeddingMath.topKMean([1, 2, 3], k: 10) == 2)
    #expect(EmbeddingMath.topKMean([], k: 10) == 0)
  }

  /// 허브 문서 H 는 코퍼스의 질의 벡터 대부분과 가깝고, T 는 외딴 곳에 하나만 있다.
  /// 원본 내적은 H 를 1등으로 놓지만(질의가 H 쪽으로 40° 기울었다) CSLS 는 H 의
  /// 벌점을 더 크게 매겨 T 를 앞세운다 — 바로잡으려는 hubness 가 이 모양이다.
  @Test func hubPenaltyFlipsTheRankingAwayFromTheHub() {
    let hub: [Float] = [1, 0]
    let lone: [Float] = [0, 1]
    // 9개는 허브 쪽, 1개만 외딴 쪽.
    let queries = [[Float]](repeating: hub, count: 9) + [lone]
    let angle = 40.0 * .pi / 180
    let query = [Float(cos(angle)), Float(sin(angle))]

    let penalties = EmbeddingMath.hubPenalties(documents: [hub, lone], queries: queries)
    #expect(abs(penalties[0] - 0.9) < 1e-9)  // (9×1 + 0) / 10
    #expect(abs(penalties[1] - 0.1) < 1e-9)  // (9×0 + 1) / 10

    let dots = [hub, lone].map { EmbeddingMath.dot(query, $0) }
    #expect(dots[0] > dots[1])  // 원본 내적: 허브가 1등
    let scores = zip(dots, penalties).map {
      EmbeddingMath.csls(dot: $0, queryPenalty: EmbeddingMath.topKMean(dots), documentPenalty: $1)
    }
    #expect(scores[1] > scores[0])  // CSLS: 외딴 문서가 1등
  }

  /// 코퍼스가 k 보다 작아도(청크 두 개짜리 새 계정) 깨지지 않는다.
  @Test func hubPenaltiesSurviveACorpusSmallerThanK() {
    let penalties = EmbeddingMath.hubPenalties(
      documents: [[1, 0], [0, 1]], queries: [[1, 0], [0, 1]], k: EmbeddingMath.neighborCount)
    #expect(penalties == [0.5, 0.5])  // (1 + 0) / 2
  }

  @Test func cslsSubtractsBothPenalties() {
    let score = EmbeddingMath.csls(dot: 0.8, queryPenalty: 0.3, documentPenalty: 0.2)
    #expect(abs(score - 1.1) < 1e-12)
  }
}
