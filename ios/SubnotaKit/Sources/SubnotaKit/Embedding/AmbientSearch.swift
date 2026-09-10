import Foundation

/// 가까운 메모 하나 — 그 메모에서 질의와 가장 가까운 청크와 그 코사인.
public struct NearbyMemo: Sendable, Equatable {
  public let memo: Memo
  public let chunkText: String
  public let score: Double

  public init(memo: Memo, chunkText: String, score: Double) {
    self.memo = memo
    self.chunkText = chunkText
    self.score = score
  }
}

/// 자동 검색의 순수 판단. 모델 없이 테스트한다.
///
/// 절대 코사인 임계값을 쓰지 않는다 — 스펙 측정에서 관련/무관의 분리 여유가 +0.0062 뿐이었다.
/// 대신 1등이 후보 분포에서 얼마나 튀는가(z점수)를 본다.
public enum AmbientSearch {
  /// **미확정 — 캘리브레이션 대상.** 스펙 측정의 `z ≥ 2.1` 은 질의 10건 표본이라
  /// 그대로 옮기지 않고, 정밀도 쪽(엉뚱한 메모를 들이대는 "비싼 실수"를 피하는 쪽)으로
  /// 조금 올려 잡았다. 상위 10개로 만든 분포라 z 의 이론 최대는 √9 = 3 이다.
  /// 실제 메모에서 관련/무관 질의의 z 를 모아 다시 정한다 — 그 전까지 자동 검색은
  /// 기본 꺼짐이다(설정 토글).
  public static let zThreshold = 2.3

  /// 분포를 만드는 후보 수. 메모 전체를 쓰면 1등의 z 가 메모 수만 늘어도 커진다
  /// (n 개 중 최댓값 ≈ √(2 ln n)σ — 무관한 질의도 메모 90개면 z ≈ 2.4). 상위 K 로 고정한다.
  public static let candidateCount = 10
  /// 이보다 적으면 분포라 부를 수 없다 — 침묵한다.
  public static let minimumCandidates = 5
  /// 데스크탑 `AMBIENT_MIN_CHARS`. 짧은 조각은 자동으로 묻지 않는다(수동은 허용).
  public static let minimumQueryLength = 12

  /// 1등의 z점수. 후보가 모자라거나 점수가 모두 같으면(표준편차 0) nil.
  public static func zScore(_ scores: [Double]) -> Double? {
    let top = Array(scores.sorted(by: >).prefix(candidateCount))
    guard top.count >= minimumCandidates else { return nil }
    let mean = top.reduce(0, +) / Double(top.count)
    let variance = top.reduce(0) { $0 + ($1 - mean) * ($1 - mean) } / Double(top.count)
    let deviation = variance.squareRoot()
    guard deviation > 1e-9 else { return nil }
    return (top[0] - mean) / deviation
  }

  public static func shouldSurface(_ scores: [Double]) -> Bool {
    guard let z = zScore(scores) else { return false }
    return z >= zThreshold
  }

  /// 커서 주변 문맥. 글자·숫자가 없으면(구분선, 빈 체크박스) 물을 것이 없다 — nil.
  /// `cursor` 는 UTF-16 오프셋이다(`UITextView.selectedRange` 와 같다).
  public static func queryText(_ text: String, cursor: Int) -> String? {
    let context = MemoChunker.getCursorContextText(text, cursorIndex: cursor)
    return MemoChunker.isMeaningfulChunk(context) ? context : nil
  }
}
