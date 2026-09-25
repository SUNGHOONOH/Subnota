import Foundation
import Testing
@testable import SubnotaKit

// 문턱(`AmbientSearch.scoreThreshold`)은 코퍼스가 바뀌면 다시 보정한다. 여기
// 점수는 문턱보다 한참 위/아래라 문턱이 0.05~0.5 사이 어디로 옮겨 가도 뜻이 그대로다.
// CSLS 점수는 0~1 이 아니다(대략 −0.5 ~ 1.5).
struct AmbientSearchTests {
  @Test func strongTopScoreSurfaces() {
    let scores = [0.84, 0.31, 0.12, -0.04, -0.20, -0.31]
    #expect(AmbientSearch.shouldSurface(scores))
  }

  /// 이웃이 여럿이어도(옛 z 게이트가 납작해져 탈락시키던 모양) 점수가 높으면 띄운다.
  @Test func severalCloseNeighboursStillSurface() {
    let scores = [0.71, 0.68, 0.66, 0.61, 0.55, 0.40]
    #expect(AmbientSearch.shouldSurface(scores))
  }

  /// 1등만 혼자 튀어도 점수가 낮으면 침묵한다 — 옛 z 게이트가 통과시키던 모양이다.
  @Test func aLonelySpikeBelowTheThresholdStaysQuiet() {
    let scores = [0.08, -0.42, -0.45, -0.47, -0.48, -0.50]
    #expect(!AmbientSearch.shouldSurface(scores))
  }

  /// 코퍼스가 이보다 작으면 중심화·허브 벌점의 표본이 못 된다.
  @Test func tooFewCandidatesStayQuiet() {
    #expect(!AmbientSearch.shouldSurface([1.4, 0.3, 0.3]))
    #expect(!AmbientSearch.shouldSurface([]))
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

/// 질의 벡터를 따로 주지 않으면 문서 벡터와 같은 것을 쓴다 — 그러면 muD == muQ 라
/// 손으로 따라가기 쉽다. 실제 색인은 접두사가 달라 둘이 다른 벡터다.
private func index(
  _ store: LocalStore, _ memo: Memo, now: Date = Date(),
  queryVector: ((Int) -> [Float])? = nil, vector: (Int) -> [Float]
) throws {
  let chunks = MemoIndexPlan.indexableChunks(memo.content).enumerated()
    // `queryVector ?? vector` 로 쓰면 non-escaping 인 `vector` 가 제네릭 T 로 넘어가
    // 탈출 가능해진다. 호출 결과로 고르면 그 문제가 없다.
    .map { (chunk: $1, vector: vector($0), queryVector: queryVector?($0) ?? vector($0)) }
  #expect(try VectorStore(store: store, ownerId: "a").replace(
    memoId: memo.id, content: memo.content, signature: signature, chunks: chunks, now: now))
}

/// 점수는 CSLS 라 0~1 이 아니고 손으로 적어 둘 만한 상수도 아니다 — 순서만 본다.
@Test func nearbyMemosKeepsTheBestChunkPerMemoAndSkipsTheCurrentMemo() async throws {
  let store = try makeStore()
  let memos = MemoStore(store: store, ownerId: "a")
  let apple = try memos.create(content: "사과 수확 일정\n\n바나나 가격 비교", category: nil)
  let mixed = try memos.create(content: "과일 가게 메모", category: nil)
  let current = try memos.create(content: "지금 쓰는 사과 메모", category: nil)
  try index(store, apple) { $0 == 0 ? axis(0) : axis(1) }
  try index(store, mixed) { _ in diagonal }
  try index(store, current) { _ in axis(0) }

  let results = try await VectorStore(store: store, ownerId: "a")
    .nearbyMemos(to: axis(0), excluding: current.id)

  #expect(results.map(\.memo.id) == [apple.id, mixed.id])
  #expect(results[0].chunkText == MemoIndexPlan.indexableChunks(apple.content)[0].text)
  #expect(results[0].score > results[1].score)
}

/// 허브 벌점은 코퍼스 전체의 **질의** 벡터로 매긴다 — 문서 벡터만으로는 계산할 수
/// 없다. 질의 벡터가 모두 한 문서 쪽에 몰려 있으면 그 문서가 벌점을 더 받는다.
@Test func storedQueryVectorsDecideTheHubPenalty() async throws {
  let store = try makeStore()
  let memos = MemoStore(store: store, ownerId: "a")
  // 문서 벡터는 세 축에 하나씩 고정. 저장된 **질의** 벡터만 옮긴다.
  let hub = try memos.create(content: "허브 메모", category: nil)
  let lone = try memos.create(content: "외딴 메모", category: nil)
  let filler = try memos.create(content: "채우는 메모", category: nil)
  /// 질의 벡터 축만 바꿔 셋을 다시 색인한다(문서 벡터는 0·1·2축 그대로).
  func reindex(queryAxes: [Int], at now: Date) throws {
    for (position, memo) in [hub, lone, filler].enumerated() {
      try index(store, memo, now: now, queryVector: { _ in axis(queryAxes[position]) }) {
        _ in axis(position)
      }
    }
  }

  // 질의 벡터 셋이 0축(=허브의 문서 벡터)으로 쏠려 있다 → 허브가 벌점을 받는다.
  try reindex(queryAxes: [0, 0, 1], at: Date(timeIntervalSince1970: 1))
  let vectors = VectorStore(store: store, ownerId: "a")
  let penalised = try await vectors.nearbyMemos(to: axis(0), excluding: nil)
  // 같은 문서 벡터, 같은 본문. 질의 벡터만 1축으로 옮기면 벌점의 주인이 바뀐다.
  try reindex(queryAxes: [1, 1, 0], at: Date(timeIntervalSince1970: 2))
  let moved = try await vectors.nearbyMemos(to: axis(0), excluding: nil)

  let before = try #require(penalised.first { $0.memo.id == hub.id }).score
  let after = try #require(moved.first { $0.memo.id == hub.id }).score
  #expect(after > before)
}

/// 색인은 편집이 멎고 몇 초 뒤에 돈다. 그 사이 옛 벡터가 지운 문장을 근거로 메모를
/// 들이대면 안 된다 — 벡터를 만든 본문과 지금 본문이 다르면 그 메모를 뺀다.
@Test func nearbyMemosDropsMemosEditedSinceIndexing() async throws {
  let store = try makeStore()
  let memos = MemoStore(store: store, ownerId: "a")
  let kept = try memos.create(content: "그대로 둔 메모", category: nil)
  var edited = try memos.create(content: "곧 지울 문장이 있는 메모", category: nil)
  try index(store, kept) { _ in axis(0) }
  try index(store, edited) { _ in axis(0) }

  edited.content = "문장을 지운 뒤의 메모"
  try memos.save(edited)
  let vectors = VectorStore(store: store, ownerId: "a")
  #expect(try await vectors.nearbyMemos(to: axis(0), excluding: nil).map(\.memo.id) == [kept.id])

  // 다시 색인하면 돌아온다.
  try index(store, edited) { _ in axis(0) }
  #expect(Set(try await vectors.nearbyMemos(to: axis(0), excluding: nil).map(\.memo.id))
    == [kept.id, edited.id])
}
