import Foundation

/// 가까운 메모 하나 — 그 메모에서 질의와 가장 가까운 청크와 그 CSLS 점수.
/// 점수는 **0~1 이 아니다**(대략 −0.5 ~ 1.5). `EmbeddingMath` 의 수식 참고.
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
/// 예전에는 1등이 후보 분포에서 얼마나 튀는가(z점수)를 봤다. 그건 의미 연상에
/// **거꾸로** 걸린다 — 통과한 10/24 중 7건은 정답이 22등 밖이었고, 정답이 5등 안이던
/// 9건 중 6건이 탈락했다. z 는 "1등이 혼자 튀는가"를 보는데 진짜 주제 연상은 이웃이
/// 여럿이라 z 가 납작해지기 때문이다. 지금은 CSLS 점수 자체를 본다 — 중심화가
/// "아무거나와 0.86" 이라는 바닥값을 없애 절대 임계값이 뜻을 갖게 됐다.
public enum AmbientSearch {
  /// 실제 크기 메모로 직접 재서 얻은 값. 사용자 메모 89개 + 관계를 설계한
  /// 테스트 메모 38개(청크 898개, 질의 16건)에서 정답 "완전 동일" 의 최저점과
  /// 최선의 오답 최고점 사이가 이 데이터에서 **유일하게 깨끗한 틈**이다:
  ///
  ///              완전 동일 최저   최선의 오답 최고
  ///   e5-small       0.102            0.023      ← iOS 가 쓰는 모델
  ///   bge-m3         0.113           -0.005      ← 데스크탑
  ///
  /// 그 아래로는 유사함·관련됨·오답 점수가 전부 겹쳐 어떤 값으로도 못 가른다.
  /// 그래서 자동검색은 이 위만 띄운다(정밀도 우선). 두 모델이 같은 값으로 갈려서
  /// 데스크탑 `AMBIENT_MIN_SIMILARITY` 와 같은 값을 쓴다.
  ///
  /// 앞서 쓰던 0.15 는 KLUE-STS 로 잡은 값이었는데, KLUE 문장은 사용자 질의
  /// 분포 밖이라 CSLS 의 허브 벌점을 거의 안 받아 척도가 달랐다.
  ///
  /// CSLS 점수는 0~1 이 아니다(대략 −0.5 ~ 1.5) — 옛 코사인 문턱을 옮겨 적지 말 것.
  public static let scoreThreshold = 0.10

  /// 캘리브레이션 로그에 남기는 후보 수. 게이트는 더 이상 분포를 보지 않지만,
  /// 재보정이 끝날 때까지 상위 몇 개는 계속 찍는다(`SearchModelStore`).
  public static let candidateCount = 10
  /// 코퍼스가 이보다 작으면 중심화·허브 벌점의 표본이 못 된다 — 침묵한다.
  public static let minimumCandidates = 5
  /// 데스크탑 `AMBIENT_MIN_CHARS`. 짧은 조각은 자동으로 묻지 않는다(수동은 허용).
  public static let minimumQueryLength = 12

  public static func shouldSurface(_ scores: [Double]) -> Bool {
    guard scores.count >= minimumCandidates, let best = scores.max() else { return false }
    return best >= scoreThreshold
  }

  /// 커서 주변 문맥. 글자·숫자가 없으면(구분선, 빈 체크박스) 물을 것이 없다 — nil.
  /// `cursor` 는 UTF-16 오프셋이다(`UITextView.selectedRange` 와 같다).
  public static func queryText(_ text: String, cursor: Int) -> String? {
    let context = MemoChunker.getCursorContextText(text, cursorIndex: cursor)
    return MemoChunker.isMeaningfulChunk(context) ? context : nil
  }
}
