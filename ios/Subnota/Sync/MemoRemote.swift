import Foundation
import SubnotaKit
import Supabase

/// 데스크탑 `services/supabase/data.ts` 와 같은 계약을 쓴다. 한쪽만 바뀌면 두
/// 클라이언트가 서로의 데이터를 덮어쓴다.
struct MemoRemote {
  let client: SupabaseClient
  let userId: String

  /// 데스크탑 `lib/memoCategory.ts` 의 DEFAULT_MEMO_CATEGORY.
  private static let defaultCategory = "Ideas"

  /// 데스크탑 `select(...)` 에서 우리가 쓰는 컬럼만 가져왔다. 이름이 하나라도
  /// 어긋나면 PostgREST 가 통째로 에러를 낸다.
  private static let columns =
    "id, content, content_hash, content_updated_at, category, is_archived, created_at, updated_at"

  /// 서버는 하드 삭제를 안 한다. 목록에서는 휴지통을 뺀다.
  func fetchAll() async throws -> [RemoteMemo] {
    try await client
      .from("memos")
      .select(Self.columns)
      .eq("user_id", value: userId)
      .eq("is_archived", value: false)
      .order("updated_at", ascending: false)
      .execute()
      .value
  }

  /// 충돌 후 서버 정본을 다시 읽는 자리. 휴지통에 있는 것도 그대로 돌려준다 —
  /// 여기서 거르면 다른 기기가 버린 메모를 우리가 되살리게 된다.
  func fetchOne(id: String) async throws -> RemoteMemo? {
    let rows: [RemoteMemo] = try await client
      .from("memos")
      .select(Self.columns)
      .eq("user_id", value: userId)
      .eq("id", value: id)
      .limit(1)
      .execute()
      .value
    return rows.first
  }

  /// 낙관적 동시성 upsert. 동시 편집이면 서버가 자기 버전을 지키고 `conflict` 를
  /// 돌려주므로 호출자가 3-way 병합 후 다시 민다.
  func upsert(_ memo: Memo, baseHash: String?) async throws -> UpsertOutcome {
    let contentHash = ContentHash.hash(memo.content)
    let category = memo.category ?? Self.defaultCategory
    let rows: [UpsertRow] = try await client
      .rpc(
        "upsert_memo_if_base_hash",
        params: UpsertParams(
          id: memo.id,
          baseHash: baseHash,
          content: memo.content,
          contentHash: contentHash,
          category: category,
          contentUpdatedAt: ServerTimestamp.string(from: memo.contentUpdatedAt),
          createdAt: ServerTimestamp.string(from: memo.createdAt)
        )
      )
      .execute()
      .value

    guard let row = rows.first else {
      throw RemoteError.emptyUpsertResult
    }
    guard let status = UpsertStatus(rawValue: row.status) else {
      throw RemoteError.unknownUpsertStatus(row.status)
    }
    if status == .deleted {
      // 다른 기기가 영구 삭제했다. 묘비가 있으니 되살리지 않는다.
      return UpsertOutcome(status: .deleted, memo: nil)
    }

    // `conflict` 면 정본은 서버 것이고, insert/update 면 우리 것이다. 정확한
    // 타임스탬프는 다음 fetchAll 에서 맞춰진다 — 데스크탑도 같다.
    return UpsertOutcome(
      status: status,
      memo: RemoteMemo(
        id: memo.id,
        content: row.content ?? memo.content,
        contentHash: row.contentHash ?? contentHash,
        contentUpdatedAt: memo.contentUpdatedAt,
        createdAt: memo.createdAt,
        category: category,
        isArchived: false
      )
    )
  }

  /// 휴지통으로 보내기·되돌리기 — 서버도 행을 지우지 않는다.
  ///
  /// `upsert_memo_if_base_hash` 는 `is_archived` 를 건드리지 않으므로 되돌리기도
  /// 반드시 여기를 지나야 한다. 빼면 되돌린 메모가 서버에서는 보관 상태로 남고,
  /// 다음 pull 이 "서버에 없다"고 판정해 로컬에서 지워 버린다.
  func setArchived(id: String, _ archived: Bool) async throws {
    try await client
      .from("memos")
      .update(["is_archived": archived], returning: .minimal)
      .eq("id", value: id)
      .eq("user_id", value: userId)
      .execute()
  }

  /// 휴지통 비우기 — 여기서만 실제로 지운다. 온라인 전용이다.
  /// 서버 트리거가 묘비를 남기므로 다른 기기가 이 메모를 다시 밀어도 되살아나지 않는다.
  func purge(id: String) async throws {
    try await client
      .from("memos")
      .delete(returning: .minimal)
      .eq("id", value: id)
      .eq("user_id", value: userId)
      .execute()
  }

  enum RemoteError: Error {
    case emptyUpsertResult
    case unknownUpsertStatus(String)
  }

  /// `upsert_memo_if_base_hash` 의 인자. 이름은 마이그레이션
  /// `20260706000100_memo_conflict_merge_optin.sql` 그대로다.
  private struct UpsertParams: Encodable {
    let id: String
    let baseHash: String?
    let content: String
    let contentHash: String
    let category: String
    let contentUpdatedAt: String
    let createdAt: String
    /// 항상 false — 서버 충돌 사본은 의도적으로 끈다. 우리가 병합해서 다시 민다.
    let preserveConflictCopy = false

    enum CodingKeys: String, CodingKey {
      case id = "p_id"
      case baseHash = "p_base_hash"
      case content = "p_content"
      case contentHash = "p_content_hash"
      case category = "p_category"
      case contentUpdatedAt = "p_content_updated_at"
      case createdAt = "p_created_at"
      case preserveConflictCopy = "p_preserve_conflict_copy"
    }

    /// baseHash 가 nil 이면 키를 빼는 게 아니라 null 을 보내야 한다 — 최초 푸시가
    /// "서버에 아직 없음"을 뜻하는 자리다.
    func encode(to encoder: Encoder) throws {
      var c = encoder.container(keyedBy: CodingKeys.self)
      try c.encode(id, forKey: .id)
      try c.encode(baseHash, forKey: .baseHash)
      try c.encode(content, forKey: .content)
      try c.encode(contentHash, forKey: .contentHash)
      try c.encode(category, forKey: .category)
      try c.encode(contentUpdatedAt, forKey: .contentUpdatedAt)
      try c.encode(createdAt, forKey: .createdAt)
      try c.encode(preserveConflictCopy, forKey: .preserveConflictCopy)
    }
  }

  /// RPC 는 `returns table (...)` 이라 행 배열로 온다.
  private struct UpsertRow: Decodable {
    let status: String
    let content: String?
    let contentHash: String?

    enum CodingKeys: String, CodingKey {
      case status
      case content
      case contentHash = "content_hash"
    }
  }
}
