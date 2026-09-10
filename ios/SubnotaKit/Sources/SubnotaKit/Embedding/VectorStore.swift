import Foundation
import GRDB

/// 메모 청크 벡터. 순수 SQL 이라 모델 없이 테스트한다 — 임베딩은 `SubnotaSearch` 의
/// `MemoIndexer` 가 한다. 기기별 로컬이고 동기화하지 않는다.
///
/// 휴지통·영구 삭제·계정 삭제 시 지우는 일은 `LocalStore` 가 한다(`deleteMemoVectors`,
/// `clearOwner`). 여기서 따로 부를 필요가 없다.
public struct VectorStore: Sendable {
  private let store: LocalStore
  private let ownerId: String

  public init(store: LocalStore, ownerId: String) {
    self.store = store
    self.ownerId = ownerId
  }

  /// 이 서명으로 색인된 메모 → 색인할 때의 `ContentHash`.
  public func indexedHashes(signature: String) throws -> [String: String] {
    try store.dbQueue.read { db in
      let rows = try Row.fetchAll(db, sql: """
        SELECT memo_id, source_content_hash FROM local_memo_vector_state
        WHERE owner_id = ? AND embedding_signature = ?
        """, arguments: [ownerId, signature])
      return Dictionary(uniqueKeysWithValues: rows.map { ($0["memo_id"], $0["source_content_hash"]) })
    }
  }

  /// 한 메모의 벡터를 통째로 갈아끼운다. 임베딩은 오래 걸리므로 그 사이 메모가
  /// 바뀌었거나 휴지통으로 갔거나 계정이 지워졌으면(행이 없음) **아무것도 쓰지 않고**
  /// false 를 낸다 — 데스크탑 `replaceMemoVectors` 의 같은 트랜잭션 안 확인이다.
  /// 이게 없으면 계정 삭제 직후 끝난 색인이 지운 본문 조각을 다시 써 넣는다.
  @discardableResult
  public func replace(
    memoId: String, content: String, signature: String,
    chunks: [(chunk: MemoChunk, vector: [Float])], now: Date = Date()
  ) throws -> Bool {
    try store.dbQueue.write { db in
      guard
        let row = try Row.fetchOne(db, sql: """
          SELECT payload_json, is_archived FROM local_records
          WHERE owner_id = ? AND record_type = 'memo' AND record_id = ?
          """, arguments: [ownerId, memoId]),
        (row["is_archived"] as Int) == 0,
        (try? PayloadCoder.decode(Memo.self, from: row["payload_json"]))?.content == content
      else { return false }

      let hash = ContentHash.hash(content)
      try LocalStore.deleteMemoVectors(db, ownerId: ownerId, memoId: memoId)
      for (chunk, vector) in chunks {
        // 차원이 틀리면 CHECK(length = 1536) 가 던지고 트랜잭션 전체가 되돌아간다.
        try db.execute(sql: """
          INSERT INTO local_memo_chunk_vectors
            (owner_id, memo_id, chunk_id, chunk_index, chunk_text, start_index, end_index,
             source_content_hash, embedding_signature, vector)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          """, arguments: [
            ownerId, memoId, chunk.id, chunk.index, chunk.text, chunk.start, chunk.end,
            hash, signature, EmbeddingMath.blob(from: vector)
          ])
      }
      // 청크가 0개여도 상태를 남긴다 — 빈 메모를 매번 다시 보지 않게.
      try db.execute(sql: """
        INSERT INTO local_memo_vector_state
          (owner_id, memo_id, source_content_hash, embedding_signature, chunk_count, indexed_at)
        VALUES (?, ?, ?, ?, ?, ?)
        """, arguments: [
          ownerId, memoId, hash, signature, chunks.count, ServerTimestamp.string(from: now)
        ])
      return true
    }
  }

  /// 모델·풀링이 바뀌면 옛 벡터 공간을 새 것과 섞지 않는다 — 모든 owner 에서 지운다.
  /// 데스크탑 `local-database.ts` 170–174행.
  public static func deleteOtherSignatures(in store: LocalStore, keeping signature: String) throws {
    try store.dbQueue.write { db in
      for table in ["local_memo_chunk_vectors", "local_memo_vector_state"] {
        try db.execute(
          sql: "DELETE FROM \(table) WHERE embedding_signature != ?", arguments: [signature])
      }
    }
  }
}

/// 무엇을 색인할지 — 엔진 없이 테스트하는 순수 결정.
public enum MemoIndexPlan {
  /// 휴지통에 없고, 이 서명으로 색인된 적 없거나 내용이 바뀐 메모.
  /// 되돌린 메모는 휴지통 이동 때 상태가 지워졌으므로 여기서 다시 잡힌다.
  public static func memosToIndex(_ memos: [Memo], indexed: [String: String]) -> [Memo] {
    memos.filter { !$0.isArchived && indexed[$0.id] != ContentHash.hash($0.content) }
  }

  /// 데스크탑 `indexableChunksForMemo` 와 같다 — 글자·숫자 없는 조각은 색인하지 않는다.
  public static func indexableChunks(_ content: String) -> [MemoChunk] {
    MemoChunker.chunkMemoText(content).filter { MemoChunker.isMeaningfulChunk($0.text) }
  }
}
