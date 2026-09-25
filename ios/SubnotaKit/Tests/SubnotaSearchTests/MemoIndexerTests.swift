import Foundation
import SubnotaKit
import Testing
@testable import SubnotaSearch

/// `EmbeddingGoldenTests` 와 같은 조건으로만 돈다 — 모델이 없으면 건너뛴다.
private let modelDirectory: URL? = {
  guard let path = ProcessInfo.processInfo.environment["SUBNOTA_E5_MODEL_DIR"] else { return nil }
  let directory = URL(fileURLWithPath: path, isDirectory: true)
  return ModelDownloader.isInstalled(in: directory) ? directory : nil
}()

@Suite(.enabled(if: modelDirectory != nil, "SUBNOTA_E5_MODEL_DIR 에 모델이 없어 건너뜀"))
struct MemoIndexerTests {
  @Test func indexesOnlyWhatChangedAndForgetsTrashedMemos() async throws {
    let dir = URL(fileURLWithPath: NSTemporaryDirectory())
      .appendingPathComponent(UUID().uuidString, isDirectory: true)
    try FileManager.default.createDirectory(at: dir, withIntermediateDirectories: true)
    let store = try LocalStore(path: dir.appendingPathComponent("test.sqlite3"))
    let memos = MemoStore(store: store, ownerId: "a")
    let vectors = VectorStore(store: store, ownerId: "a")
    let indexer = MemoIndexer(engine: try await EmbeddingEngine(modelDirectory: try #require(modelDirectory)))

    var roadmap = try memos.create(content: "다음 분기 로드맵. 출시일은 3월이다.", category: nil)
    let groceries = try memos.create(content: "우유, 달걀, 두부 사기.", category: nil)

    // 첫 실행 = 모델이 막 설치됐을 때의 전체 색인.
    #expect(try await indexer.reconcile(store: store, ownerId: "a") == 2)
    // 해시가 같으면 다시 임베딩하지 않는다.
    #expect(try await indexer.reconcile(store: store, ownerId: "a") == 0)

    roadmap.content += " 일정이 밀렸다."
    try memos.save(roadmap)
    #expect(try await indexer.reconcile(store: store, ownerId: "a") == 1)
    #expect(try vectors.indexedHashes(signature: EmbeddingModel.signature)[roadmap.id]
      == ContentHash.hash(roadmap.content))

    try memos.moveToTrash(id: groceries.id, now: Date())
    #expect(try vectors.indexedHashes(signature: EmbeddingModel.signature)[groceries.id] == nil)
    #expect(try await indexer.reconcile(store: store, ownerId: "a") == 0)

    try memos.restore(id: groceries.id, now: Date())
    #expect(try await indexer.reconcile(store: store, ownerId: "a") == 1)
  }
}
