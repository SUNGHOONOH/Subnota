import Foundation
import GRDB
import Testing
@testable import SubnotaKit

private let signature = EmbeddingModel.signature

private func makeStore() throws -> LocalStore {
  let dir = URL(fileURLWithPath: NSTemporaryDirectory())
    .appendingPathComponent(UUID().uuidString, isDirectory: true)
  try FileManager.default.createDirectory(at: dir, withIntermediateDirectories: true)
  return try LocalStore(path: dir.appendingPathComponent("test.sqlite3"))
}

private func rows(_ store: LocalStore, _ table: String, owner: String) throws -> Int {
  try store.dbQueue.read {
    try Int.fetchOne($0, sql: "SELECT COUNT(*) FROM \(table) WHERE owner_id = ?", arguments: [owner]) ?? 0
  }
}

private func vectorRows(_ store: LocalStore, owner: String) throws -> Int {
  try rows(store, "local_memo_chunk_vectors", owner: owner)
}

private func stateRows(_ store: LocalStore, owner: String) throws -> Int {
  try rows(store, "local_memo_vector_state", owner: owner)
}

/// 엔진 대신 차원만 맞춘 가짜 벡터. 이 파일은 SQL 만 본다.
private func fakeChunks(_ content: String) -> [(chunk: MemoChunk, vector: [Float])] {
  MemoIndexPlan.indexableChunks(content).map {
    (chunk: $0, vector: [Float](repeating: 0.5, count: EmbeddingModel.dimensions))
  }
}

@discardableResult
private func index(_ store: LocalStore, owner: String, _ memo: Memo, signature sig: String = signature) throws -> Bool {
  try VectorStore(store: store, ownerId: owner)
    .replace(memoId: memo.id, content: memo.content, signature: sig, chunks: fakeChunks(memo.content))
}

@Test func vectorBlobMustBeExactly1536Bytes() throws {
  let store = try makeStore()
  func insert(bytes: Int, id: String) throws {
    try store.dbQueue.write { db in
      try db.execute(sql: """
        INSERT INTO local_memo_chunk_vectors
          (owner_id, memo_id, chunk_id, chunk_index, chunk_text, start_index, end_index,
           source_content_hash, embedding_signature, vector)
        VALUES ('a', 'm', ?, 0, 't', 0, 1, 'h', 's', ?)
        """, arguments: [id, Data(count: bytes)])
    }
  }
  #expect(throws: DatabaseError.self) { try insert(bytes: 1535, id: "short") }
  #expect(throws: DatabaseError.self) { try insert(bytes: 4096, id: "desktop-size") }
  try insert(bytes: 1536, id: "ok")
  #expect(try vectorRows(store, owner: "a") == 1)
}

@Test func replaceStoresChunksAndStateThenReplacesThem() throws {
  let store = try makeStore()
  let memos = MemoStore(store: store, ownerId: "a")
  var memo = try memos.create(content: "첫 문장입니다. 둘째 문장입니다. 셋째 문장입니다.", category: nil)

  #expect(try index(store, owner: "a", memo))
  let first = try vectorRows(store, owner: "a")
  #expect(first == MemoIndexPlan.indexableChunks(memo.content).count)
  #expect(first > 1)
  #expect(try VectorStore(store: store, ownerId: "a").indexedHashes(signature: signature)
    == [memo.id: ContentHash.hash(memo.content)])

  memo.content = "한 문장만 남았다."
  try memos.save(memo)
  #expect(try index(store, owner: "a", memo))
  // 옛 청크가 남지 않는다.
  #expect(try vectorRows(store, owner: "a") == 1)
  #expect(try stateRows(store, owner: "a") == 1)
}

/// 임베딩하는 사이 메모가 바뀌었거나 휴지통으로 갔거나 계정이 지워졌으면 쓰지 않는다.
@Test func replaceRefusesStaleOrMissingMemos() throws {
  let store = try makeStore()
  let memos = MemoStore(store: store, ownerId: "a")
  let memo = try memos.create(content: "색인 대상 문장.", category: nil)

  var edited = memo
  edited.content = "사용자가 더 쳤다."
  try memos.save(edited)
  #expect(try index(store, owner: "a", memo) == false)

  try memos.moveToTrash(id: memo.id, now: Date())
  #expect(try index(store, owner: "a", edited) == false)

  let other = try memos.create(content: "다른 메모.", category: nil)
  try store.clearOwner("a")
  #expect(try index(store, owner: "a", other) == false)

  #expect(try vectorRows(store, owner: "a") == 0)
  #expect(try stateRows(store, owner: "a") == 0)
}

@Test func trashAndPurgeRemoveVectorsAndRestoreReindexes() throws {
  let store = try makeStore()
  let memos = MemoStore(store: store, ownerId: "a")
  let kept = try memos.create(content: "남는 메모.", category: nil)
  let trashed = try memos.create(content: "버릴 메모.", category: nil)
  try index(store, owner: "a", kept)
  try index(store, owner: "a", trashed)

  try memos.moveToTrash(id: trashed.id, now: Date())
  let vectors = VectorStore(store: store, ownerId: "a")
  #expect(try vectors.indexedHashes(signature: signature).keys.sorted() == [kept.id])
  #expect(try vectorRows(store, owner: "a") == 1)

  // 되돌리면 다시 색인 대상이다.
  try memos.restore(id: trashed.id, now: Date())
  #expect(MemoIndexPlan.memosToIndex(try memos.all(), indexed: try vectors.indexedHashes(signature: signature))
    .map(\.id) == [trashed.id])

  // 영구 삭제(휴지통 비우기, 다른 기기의 삭제를 pull 이 반영)도 지운다.
  try memos.purge(id: kept.id)
  #expect(try vectorRows(store, owner: "a") == 0)
  #expect(try stateRows(store, owner: "a") == 0)
}

/// 다른 기기에서 온 메모(pull 의 applyRemote)도 색인 대상이고, 다른 기기가 지워
/// pull 이 purge 하면 벡터도 사라진다. (서버는 보관된 메모를 pull 에 주지 않는다.)
@Test func remoteMemosAreIndexedAndRemoteDeletesRemoveVectors() throws {
  let store = try makeStore()
  let memos = MemoStore(store: store, ownerId: "a")
  let memo = Memo(id: "remote", content: "다른 기기에서 쓴 메모.", category: nil,
                  createdAt: Date(), contentUpdatedAt: Date())
  try memos.applyRemote(memo)
  #expect(MemoIndexPlan.memosToIndex(try memos.all(), indexed: [:]).map(\.id) == ["remote"])
  #expect(try index(store, owner: "a", memo))

  try memos.purge(id: memo.id)
  #expect(try vectorRows(store, owner: "a") == 0)
  #expect(try stateRows(store, owner: "a") == 0)
}

@Test func otherSignaturesAreDroppedForEveryOwner() throws {
  let store = try makeStore()
  for owner in ["a", "b"] {
    let memos = MemoStore(store: store, ownerId: owner)
    try index(store, owner: owner, try memos.create(content: "옛 모델 벡터.", category: nil), signature: "old-model")
    try index(store, owner: owner, try memos.create(content: "새 모델 벡터.", category: nil))
  }

  try VectorStore.deleteOtherSignatures(in: store, keeping: signature)

  for owner in ["a", "b"] {
    #expect(try vectorRows(store, owner: owner) == 1)
    #expect(try stateRows(store, owner: owner) == 1)
    #expect(try VectorStore(store: store, ownerId: owner).indexedHashes(signature: "old-model").isEmpty)
  }
}

/// Phase 3 의 보장이 벡터에도 걸린다 — `chunk_text` 는 메모 본문 조각이다.
/// 계정 삭제 뒤 같은 기기의 다음 계정이 이전 계정의 본문을 볼 수 없어야 한다.
@Test func clearOwnerWipesVectorTablesForThatOwnerOnly() throws {
  let store = try makeStore()
  for owner in ["a", "b"] {
    let memo = try MemoStore(store: store, ownerId: owner).create(content: "비밀 메모 본문.", category: nil)
    try index(store, owner: owner, memo)
    #expect(try vectorRows(store, owner: owner) == 1)
    #expect(try stateRows(store, owner: owner) == 1)
  }

  try store.clearOwner("a")

  #expect(try vectorRows(store, owner: "a") == 0)
  #expect(try stateRows(store, owner: "a") == 0)
  #expect(try vectorRows(store, owner: "b") == 1)
  #expect(try stateRows(store, owner: "b") == 1)
}

@Test func planSkipsUnchangedAndArchivedMemos() {
  let now = Date()
  let same = Memo(id: "same", content: "그대로", category: nil, createdAt: now, contentUpdatedAt: now)
  let changed = Memo(id: "changed", content: "바뀐 내용", category: nil, createdAt: now, contentUpdatedAt: now)
  let fresh = Memo(id: "fresh", content: "처음", category: nil, createdAt: now, contentUpdatedAt: now)
  var archived = Memo(id: "archived", content: "휴지통", category: nil, createdAt: now, contentUpdatedAt: now)
  archived.isArchived = true

  let indexed = ["same": ContentHash.hash("그대로"), "changed": ContentHash.hash("옛 내용")]
  #expect(MemoIndexPlan.memosToIndex([same, changed, fresh, archived], indexed: indexed).map(\.id)
    == ["changed", "fresh"])
}

@Test func indexableChunksDropThoseWithoutLettersOrDigits() {
  let texts = MemoIndexPlan.indexableChunks("회의 메모\n---\n- [ ]\n다음 주 출시").map(\.text)
  #expect(texts == ["회의 메모", "다음 주 출시"])
}

@Test func signatureNamesModelRevisionAndPooling() {
  #expect(EmbeddingModel.signature.contains(EmbeddingModel.revision))
  #expect(EmbeddingModel.signature.hasSuffix(":mean"))
}
