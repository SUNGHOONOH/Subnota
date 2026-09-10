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
}
