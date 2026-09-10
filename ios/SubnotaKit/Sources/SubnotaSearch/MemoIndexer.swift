import Foundation
import SubnotaKit

/// 바뀐 메모만 골라 청크 벡터를 만든다. 엔진을 부르므로 앱만 링크하는 이 타겟에 있다.
/// actor 라 실행이 겹치지 않는다 — 뒤 실행은 앞 실행이 쓴 상태를 보고 건너뛴다.
public actor MemoIndexer {
  private let engine: EmbeddingEngine
  private var checkedSignature = false

  public init(engine: EmbeddingEngine) {
    self.engine = engine
  }

  /// 반환값은 새로 색인한 메모 수. 취소되면 메모 사이에서 멈춘다 — 끝낸 메모는 남는다.
  @discardableResult
  public func reconcile(store: LocalStore, ownerId: String) throws -> Int {
    let signature = EmbeddingModel.signature
    if !checkedSignature {
      // 전 테이블을 훑으므로 실행마다가 아니라 한 번만.
      try VectorStore.deleteOtherSignatures(in: store, keeping: signature)
      checkedSignature = true
    }
    let vectors = VectorStore(store: store, ownerId: ownerId)
    let memos = try MemoStore(store: store, ownerId: ownerId).all()
    var stored = 0
    for memo in MemoIndexPlan.memosToIndex(memos, indexed: try vectors.indexedHashes(signature: signature)) {
      try Task.checkCancellation()
      // ponytail: 바뀐 메모는 청크를 전부 다시 임베딩한다. 데스크탑은 같은 chunk_text 의
      // 옛 벡터를 재사용한다 — 긴 메모 편집이 느리게 느껴지면 그 풀을 들인다.
      let chunks = try MemoIndexPlan.indexableChunks(memo.content).map {
        (chunk: $0, vector: try engine.embed($0.text, as: .passage))
      }
      if try vectors.replace(memoId: memo.id, content: memo.content, signature: signature, chunks: chunks) {
        stored += 1
      }
    }
    return stored
  }
}
