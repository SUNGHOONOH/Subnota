import Foundation
import Testing
@testable import SubnotaKit

// 문턱(`AmbientSearch.zThreshold`)은 캘리브레이션 전이라 바뀔 수 있다. 여기 분포는
// 튀는 쪽 z ≈ 2.97(상위 10개의 이론 최대 3), 평평한 쪽 z ≈ 1.6 — 문턱이 그 사이
// 어디로 옮겨 가도 뜻이 그대로다.
struct AmbientSearchTests {
  @Test func spikedDistributionSurfaces() {
    let scores = [0.91, 0.62, 0.61, 0.60, 0.60, 0.59, 0.59, 0.58, 0.58, 0.57]
    #expect(AmbientSearch.shouldSurface(scores))
  }

  @Test func flatDistributionStaysQuiet() {
    let scores = [0.84, 0.83, 0.83, 0.82, 0.82, 0.81, 0.81, 0.80, 0.80, 0.79]
    #expect(!AmbientSearch.shouldSurface(scores))
  }

  @Test func tooFewCandidatesStayQuiet() {
    let scores = [0.95, 0.30, 0.30]
    #expect(AmbientSearch.zScore(scores) == nil)
    #expect(!AmbientSearch.shouldSurface(scores))
  }

  @Test func identicalScoresStayQuietWithoutDividingByZero() {
    let scores = [Double](repeating: 0.7, count: 10)
    #expect(AmbientSearch.zScore(scores) == nil)
    #expect(!AmbientSearch.shouldSurface(scores))
  }

  /// 메모 전체를 분포로 삼으면 1등은 메모 수만 늘어도 튄다(n 개 중 최댓값 ≈ √(2 ln n)σ).
  /// 멀리 떨어진 꼬리가 평균을 끌어내려 평평한 상위권도 발동시키면 안 된다.
  @Test func onlyTopCandidatesFormTheDistribution() {
    let flatHead = [0.84, 0.83, 0.83, 0.82, 0.82, 0.81, 0.81, 0.80, 0.80, 0.79]
    let farTail = [Double](repeating: 0.20, count: 80)
    #expect(!AmbientSearch.shouldSurface(flatHead + farTail))
    #expect(!AmbientSearch.shouldSurface((flatHead + farTail).shuffled()))
  }

  @Test func queryTextNeedsLettersOrDigits() {
    #expect(AmbientSearch.queryText("---\n\n- [ ] ", cursor: 2) == nil)
    #expect(AmbientSearch.queryText("", cursor: 0) == nil)
    #expect(AmbientSearch.queryText("  회의 준비물 챙기기  ", cursor: 3) == "회의 준비물 챙기기")
  }
}

// MARK: - 로컬 벡터에서 가까운 메모

private let signature = EmbeddingModel.signature

private func makeStore() throws -> LocalStore {
  let dir = URL(fileURLWithPath: NSTemporaryDirectory())
    .appendingPathComponent(UUID().uuidString, isDirectory: true)
  try FileManager.default.createDirectory(at: dir, withIntermediateDirectories: true)
  return try LocalStore(path: dir.appendingPathComponent("test.sqlite3"))
}

private func axis(_ index: Int) -> [Float] {
  var vector = [Float](repeating: 0, count: EmbeddingModel.dimensions)
  vector[index] = 1
  return vector
}

/// 0축과 1축 사이 45° — 0축 질의와의 코사인 0.7071.
private let diagonal: [Float] = EmbeddingMath.l2Normalized(
  zip(axis(0), axis(1)).map { $0 + $1 })

private func index(_ store: LocalStore, _ memo: Memo, vector: (Int) -> [Float]) throws {
  let chunks = MemoIndexPlan.indexableChunks(memo.content).enumerated()
    .map { (chunk: $1, vector: vector($0)) }
  #expect(try VectorStore(store: store, ownerId: "a")
    .replace(memoId: memo.id, content: memo.content, signature: signature, chunks: chunks))
}

@Test func nearbyMemosKeepsTheBestChunkPerMemoAndSkipsTheCurrentMemo() throws {
  let store = try makeStore()
  let memos = MemoStore(store: store, ownerId: "a")
  let apple = try memos.create(content: "사과 수확 일정\n\n바나나 가격 비교", category: nil)
  let mixed = try memos.create(content: "과일 가게 메모", category: nil)
  let current = try memos.create(content: "지금 쓰는 사과 메모", category: nil)
  try index(store, apple) { $0 == 0 ? axis(0) : axis(1) }
  try index(store, mixed) { _ in diagonal }
  try index(store, current) { _ in axis(0) }

  let results = try VectorStore(store: store, ownerId: "a")
    .nearbyMemos(to: axis(0), excluding: current.id)

  #expect(results.map(\.memo.id) == [apple.id, mixed.id])
  #expect(results[0].chunkText == MemoIndexPlan.indexableChunks(apple.content)[0].text)
  #expect(abs(results[0].score - 1) < 1e-6)
  #expect(abs(results[1].score - 0.7071) < 1e-3)
}

/// 색인은 편집이 멎고 몇 초 뒤에 돈다. 그 사이 옛 벡터가 지운 문장을 근거로 메모를
/// 들이대면 안 된다 — 벡터를 만든 본문과 지금 본문이 다르면 그 메모를 뺀다.
@Test func nearbyMemosDropsMemosEditedSinceIndexing() throws {
  let store = try makeStore()
  let memos = MemoStore(store: store, ownerId: "a")
  let kept = try memos.create(content: "그대로 둔 메모", category: nil)
  var edited = try memos.create(content: "곧 지울 문장이 있는 메모", category: nil)
  try index(store, kept) { _ in axis(0) }
  try index(store, edited) { _ in axis(0) }

  edited.content = "문장을 지운 뒤의 메모"
  try memos.save(edited)
  let vectors = VectorStore(store: store, ownerId: "a")
  #expect(try vectors.nearbyMemos(to: axis(0), excluding: nil).map(\.memo.id) == [kept.id])

  // 다시 색인하면 돌아온다.
  try index(store, edited) { _ in axis(0) }
  #expect(Set(try vectors.nearbyMemos(to: axis(0), excluding: nil).map(\.memo.id)) == [kept.id, edited.id])
}
