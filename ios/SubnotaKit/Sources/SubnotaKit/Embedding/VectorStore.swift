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
    chunks: [(chunk: MemoChunk, vector: [Float], queryVector: [Float])], now: Date = Date()
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
      for (chunk, vector, queryVector) in chunks {
        // 차원이 틀리면 CHECK(length = 1536) 가 던지고 트랜잭션 전체가 되돌아간다.
        try db.execute(sql: """
          INSERT INTO local_memo_chunk_vectors
            (owner_id, memo_id, chunk_id, chunk_index, chunk_text, start_index, end_index,
             source_content_hash, embedding_signature, vector, query_vector)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          """, arguments: [
            ownerId, memoId, chunk.id, chunk.index, chunk.text, chunk.start, chunk.end,
            hash, signature, EmbeddingMath.blob(from: vector),
            EmbeddingMath.blob(from: queryVector)
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

  /// 질의 벡터와 가까운 메모, 가까운 순. 메모마다 가장 가까운 청크 하나만 남긴다
  /// (데스크탑 `searchMemoVectors` 의 `resultMemoIds`). `excluding` 은 지금 쓰는 메모.
  ///
  /// 점수는 중심화 + CSLS 다(`EmbeddingMath`). **0~1 이 아니다** — 대략 −0.5 ~ 1.5.
  ///
  /// 벡터를 만든 본문의 해시가 지금 본문과 다르면 그 메모를 **뺀다**. 색인은 편집이
  /// 멎고 몇 초 뒤에 돌므로 그 사이의 옛 벡터가 이미 지운 문장을 근거로 메모를 들이댈
  /// 수 있다. 데스크탑도 결과마다 같은 대조를 한다. 다음 색인이 끝나면 다시 나온다.
  // ponytail: 선형 스캔. 청크가 수만 개를 넘어 지연이 측정되면 인덱스를 둔다.
  public func nearbyMemos(
    to query: [Float], excluding memoId: String?, signature: String = EmbeddingModel.signature
  ) async throws -> [NearbyMemo] {
    let stats = try await corpusStats(signature: signature)
    guard query.count == stats.queryMean.count else { return [] }  // 빈 코퍼스거나 차원이 다르다
    let centeredQuery = EmbeddingMath.centered(query, mean: stats.queryMean)
    let dots = stats.chunks.map { EmbeddingMath.dot(centeredQuery, $0.document) }
    // rq 도 코퍼스 전체로 잰다 — 거르기 전의 공간이 기준이다.
    let queryPenalty = EmbeddingMath.topKMean(dots)

    let memos = try MemoStore(store: store, ownerId: ownerId).all()  // 휴지통 제외
    let current = Dictionary(uniqueKeysWithValues: memos.map { ($0.id, (memo: $0, hash: ContentHash.hash($0.content))) })
    var best: [String: NearbyMemo] = [:]
    for (index, chunk) in stats.chunks.enumerated() {
      guard chunk.memoId != memoId,
        let entry = current[chunk.memoId], entry.hash == chunk.contentHash
      else { continue }
      let score = EmbeddingMath.csls(
        dot: dots[index], queryPenalty: queryPenalty, documentPenalty: chunk.hubPenalty)
      if score > best[chunk.memoId]?.score ?? -.infinity {
        best[chunk.memoId] = NearbyMemo(memo: entry.memo, chunkText: chunk.chunkText, score: score)
      }
    }
    return best.values.sorted { ($0.score, $1.memo.id) > ($1.score, $0.memo.id) }
  }

  /// 중심 벡터와 허브 벌점은 **저장하지 않는다** — 저장된 벡터에서 파생되는 값이라
  /// DB 에 두면 무효화 규칙이 하나 더 생긴다. 검색할 때 만들고 색인이 바뀔 때까지만
  /// 메모리에 둔다.
  private func corpusStats(signature: String) async throws -> CorpusStats {
    let key = try cacheKey(signature: signature)
    if let cached = await CorpusStatsCache.shared.stats(for: key) { return cached }

    let rows = try store.dbQueue.read { db in
      try Row.fetchAll(db, sql: """
        SELECT memo_id, chunk_text, source_content_hash, vector, query_vector
        FROM local_memo_chunk_vectors
        WHERE owner_id = ? AND embedding_signature = ?
        ORDER BY memo_id, chunk_index
        """, arguments: [ownerId, signature])
    }
    let loaded = rows.compactMap {
      row -> (memoId: String, chunkText: String, hash: String, document: [Float], query: [Float])? in
      guard let document = EmbeddingMath.vector(fromBlob: row["vector"]),
        let query = EmbeddingMath.vector(fromBlob: row["query_vector"]),
        document.count == EmbeddingModel.dimensions, query.count == EmbeddingModel.dimensions
      else { return nil }
      return (row["memo_id"], row["chunk_text"], row["source_content_hash"], document, query)
    }
    // 중심화는 코퍼스 전체로 한다 — 지금 쓰는 메모의 청크도, 편집으로 낡은 청크도
    // 공간의 일부다. 거르는 일은 결과를 고를 때만 한다(그래야 캐시가 질의와 무관해진다).
    guard let documentMean = EmbeddingMath.mean(of: loaded.map(\.document)),
      let queryMean = EmbeddingMath.mean(of: loaded.map(\.query))
    else { return CorpusStats(queryMean: [], chunks: []) }

    let documents = loaded.map { EmbeddingMath.centered($0.document, mean: documentMean) }
    let queries = loaded.map { EmbeddingMath.centered($0.query, mean: queryMean) }
    let penalties = EmbeddingMath.hubPenalties(documents: documents, queries: queries)
    let stats = CorpusStats(
      queryMean: queryMean,
      chunks: loaded.indices.map {
        CorpusChunk(
          memoId: loaded[$0].memoId, chunkText: loaded[$0].chunkText,
          contentHash: loaded[$0].hash, document: documents[$0], hubPenalty: penalties[$0])
      })
    await CorpusStatsCache.shared.store(stats, for: key)
    return stats
  }

  /// 색인 상태 테이블(메모당 한 줄)이 곧 "지금 어떤 벡터가 들어 있는가"다 — 재색인·
  /// 휴지통·영구 삭제·계정 정리가 모두 이 테이블을 지나간다. 달라지면 캐시를 버린다.
  /// DB 파일 경로까지 넣는 건 한 프로세스가 여러 저장소를 여는 테스트 때문이다.
  private func cacheKey(signature: String) throws -> String {
    try store.dbQueue.read { db in
      let fingerprint = try Row.fetchAll(db, sql: """
        SELECT memo_id, source_content_hash, chunk_count, indexed_at
        FROM local_memo_vector_state
        WHERE owner_id = ? AND embedding_signature = ?
        ORDER BY memo_id
        """, arguments: [ownerId, signature])
        .map { row in
          "\(row["memo_id"] as String)/\(row["source_content_hash"] as String)"
            + "/\(row["chunk_count"] as Int)/\(row["indexed_at"] as String)"
        }
        .joined(separator: ",")
      return "\(store.dbQueue.path)|\(ownerId)|\(signature)|\(fingerprint)"
    }
  }
}

/// 중심화한 청크 하나와 그 허브 벌점.
struct CorpusChunk: Sendable {
  let memoId: String
  let chunkText: String
  let contentHash: String
  /// 중심화한 문서 벡터 d'_i.
  let document: [Float]
  /// 허브 벌점 r_i.
  let hubPenalty: Double
}

/// 검색에 필요한 코퍼스 통계 전부. 값 타입이라 액터 밖으로 그대로 건네도 된다.
struct CorpusStats: Sendable {
  /// muQ — 런타임 질의도 이걸로 중심화한다. 질의는 muQ 계산에 넣지 않는다.
  let queryMean: [Float]
  let chunks: [CorpusChunk]
}

/// 통계 캐시. 색인 지문이 달라지면 통째로 버린다 — 따로 버전 키를 두지 않는다.
/// 액터라 Swift 6 에서 공유해도 안전하다. 한 칸만 둔다: 앱은 계정 하나·서명 하나를 쓴다.
private actor CorpusStatsCache {
  static let shared = CorpusStatsCache()
  private var key = ""
  private var stats: CorpusStats?

  func stats(for key: String) -> CorpusStats? { key == self.key ? stats : nil }

  func store(_ stats: CorpusStats, for key: String) {
    self.key = key
    self.stats = stats
  }
}

/// 무엇을 색인할지 — 엔진 없이 테스트하는 순수 결정.
public enum MemoIndexPlan {
  /// 휴지통에 없고, 이 서명으로 색인된 적 없거나 내용이 바뀐 메모.
  /// 되돌린 메모는 휴지통 이동 때 상태가 지워졌으므로 여기서 다시 잡힌다.
  public static func memosToIndex(_ memos: [Memo], indexed: [String: String]) -> [Memo] {
    memos.filter { !$0.isArchived && indexed[$0.id] != ContentHash.hash($0.content) }
  }

  /// 데스크탑 `indexableChunksForMemo` 와 같다. `isMeaningfulChunk` 은 백엔드
  /// chunking.py 와 맞춘 계약이라 그대로 두고, 색인에만 더 엄한 기준을 얹는다 —
  /// 내용어가 둘 미만인 조각(`&nbsp;`, `1.`, `교통`)은 코퍼스 한가운데에 놓여
  /// 아무 질의에나 1등으로 올라온다(실측: 1등이 쓰레기인 질의 4.4% → 0%).
  public static func indexableChunks(_ content: String) -> [MemoChunk] {
    MemoChunker.chunkMemoText(content).filter {
      MemoChunker.isMeaningfulChunk($0.text) && ChunkText.hasSearchableContent($0.text)
    }
  }
}
