import Foundation
import Testing

@testable import SubnotaKit

/// 컬럼 이름은 데스크탑 `services/supabase/data.ts` 의 `select(...)` 문자열에서
/// 그대로 가져왔다. 하나라도 어긋나면 목록이 통째로 비어 보인다.
private func row(
  contentUpdatedAt: String? = "2026-09-06T12:34:56.744663+00:00",
  createdAt: String = "2026-09-01T00:00:00.000Z",
  updatedAt: String = "2026-09-06T12:34:56.744663+00:00",
  isArchived: String = "false",
  contentHash: String = "\"1a2b3c\"",
  category: String = "\"Ideas\""
) -> Data {
  let contentUpdated = contentUpdatedAt.map { "\"\($0)\"" } ?? "null"
  return Data(
    """
    {
      "id": "3F2504E0-4F89-11D3-9A0C-0305E82C3301",
      "content": "안녕 👍",
      "content_hash": \(contentHash),
      "content_updated_at": \(contentUpdated),
      "category": \(category),
      "is_archived": \(isArchived),
      "created_at": "\(createdAt)",
      "updated_at": "\(updatedAt)"
    }
    """.utf8
  )
}

private func decode(_ data: Data) throws -> RemoteMemo {
  // 일부러 설정하지 않은 JSONDecoder 다. RemoteMemo 가 날짜를 스스로 파싱하지
  // 않으면 여기서 깨진다 — Supabase 의 디코더 설정에 기대면 안 된다.
  try JSONDecoder().decode(RemoteMemo.self, from: data)
}

@Test func decodesSnakeCaseServerColumns() throws {
  let memo = try decode(row())

  #expect(memo.id == "3F2504E0-4F89-11D3-9A0C-0305E82C3301")
  #expect(memo.content == "안녕 👍")
  #expect(memo.contentHash == "1a2b3c")
  #expect(memo.category == "Ideas")
  #expect(memo.isArchived == false)
  #expect(memo.createdAt == Date(timeIntervalSince1970: 1_788_220_800))
}

/// 소수점 초를 버리면 데스크탑이 쓴 타임스탬프와 정밀도가 갈리고, 누가 최신인지
/// 비교하는 자리에서 조용히 틀린다.
@Test func keepsFractionalSecondsInServerTimestamps() throws {
  let memo = try decode(row(contentUpdatedAt: "2026-09-06T12:34:56.744663+00:00"))

  #expect(memo.contentUpdatedAt.timeIntervalSince1970 == 1_788_698_096.744)
}

/// 서버 타임스탬프에 소수점 초가 없을 수도 있다.
@Test func decodesServerTimestampsWithoutFractionalSeconds() throws {
  let memo = try decode(
    row(contentUpdatedAt: "2026-09-06T12:34:56+00:00", createdAt: "2026-09-01T00:00:00Z")
  )

  #expect(memo.contentUpdatedAt.timeIntervalSince1970 == 1_788_698_096)
  #expect(memo.createdAt.timeIntervalSince1970 == 1_788_220_800)
}

/// 데스크탑은 이 컬럼을 읽는 모든 자리에서 `content_updated_at ?? updated_at` 을 쓴다.
@Test func fallsBackToUpdatedAtWhenContentUpdatedAtIsNull() throws {
  let memo = try decode(
    row(contentUpdatedAt: nil, updatedAt: "2026-09-06T12:34:56.744+00:00")
  )

  #expect(memo.contentUpdatedAt.timeIntervalSince1970 == 1_788_698_096.744)
}

/// 서버 컬럼이 nullable 이다. null 을 만나 디코딩이 통째로 실패하면 메모가 사라진다.
@Test func toleratesNullableColumns() throws {
  let memo = try decode(row(isArchived: "null", contentHash: "null", category: "null"))

  #expect(memo.isArchived == false)
  #expect(memo.contentHash == nil)
  #expect(memo.category == nil)
}

@Test func decodesArchivedRows() throws {
  #expect(try decode(row(isArchived: "true")).isArchived)
}

@Test func upsertStatusMatchesTheServerStrings() {
  // RPC 가 돌려주는 문자열 그대로다 — 바꾸면 모든 푸시가 알 수 없는 상태가 된다.
  #expect(UpsertStatus(rawValue: "inserted") == .inserted)
  #expect(UpsertStatus(rawValue: "updated") == .updated)
  #expect(UpsertStatus(rawValue: "conflict") == .conflict)
  #expect(UpsertStatus(rawValue: "deleted") == .deleted)
  #expect(UpsertStatus(rawValue: "merged") == nil)
}

/// 우리가 서버로 보내는 문자열은 데스크탑의 `toISOString()` 과 같은 모양이어야 한다.
@Test func formatsTimestampsLikeDesktopToISOString() {
  let date = Date(timeIntervalSince1970: 1_788_698_096.744)

  #expect(ServerTimestamp.string(from: date) == "2026-09-06T12:34:56.744Z")
}
