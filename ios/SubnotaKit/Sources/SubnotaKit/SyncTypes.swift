import Foundation

/// 서버 `memos` 행. 데스크탑 `types.ts` 의 `MemoRow` 와 같은 뜻이고, 컬럼 이름은
/// `services/supabase/data.ts` 의 `select(...)` 에서 그대로 가져왔다.
///
/// 네트워크를 모르는 순수 값 타입이라 SubnotaKit 에 둔다 — 그래야 시뮬레이터 없이
/// 디코딩을 테스트할 수 있다.
public struct RemoteMemo: Sendable, Equatable, Decodable {
  public let id: String
  public let content: String
  /// 서버 컬럼은 nullable 이다. 데스크탑도 `server.content_hash` 를 그대로
  /// baseHash 로 넘긴다 (`memoSync.ts`).
  public let contentHash: String?
  public let contentUpdatedAt: Date
  public let createdAt: Date
  public let category: String?
  public let isArchived: Bool

  public init(
    id: String, content: String, contentHash: String?,
    contentUpdatedAt: Date, createdAt: Date, category: String?, isArchived: Bool
  ) {
    self.id = id
    self.content = content
    self.contentHash = contentHash
    self.contentUpdatedAt = contentUpdatedAt
    self.createdAt = createdAt
    self.category = category
    self.isArchived = isArchived
  }

  enum CodingKeys: String, CodingKey {
    case id
    case content
    case contentHash = "content_hash"
    case contentUpdatedAt = "content_updated_at"
    case createdAt = "created_at"
    case category
    case isArchived = "is_archived"
    case updatedAt = "updated_at"
  }

  /// 날짜를 `Date` 가 아니라 문자열로 받아서 직접 파싱한다. 그러면 바깥
  /// JSONDecoder 의 dateDecodingStrategy 가 무엇이든(기본 `.iso8601` 은 소수점
  /// 초를 통째로 버린다) 결과가 같다.
  public init(from decoder: Decoder) throws {
    let c = try decoder.container(keyedBy: CodingKeys.self)
    id = try c.decode(String.self, forKey: .id)
    content = try c.decode(String.self, forKey: .content)
    contentHash = try c.decodeIfPresent(String.self, forKey: .contentHash)
    category = try c.decodeIfPresent(String.self, forKey: .category)
    // 서버 컬럼이 `boolean | null` 이다. null 은 휴지통이 아니라는 뜻이다.
    isArchived = try c.decodeIfPresent(Bool.self, forKey: .isArchived) ?? false
    createdAt = try Self.date(in: c, forKey: .createdAt)

    // 데스크탑은 이 컬럼을 읽는 모든 자리에서 `content_updated_at ?? updated_at`
    // 을 쓴다. 그 폴백을 경계에서 한 번만 풀어 둔다.
    let raw = try c.decodeIfPresent(String.self, forKey: .contentUpdatedAt)
      ?? c.decodeIfPresent(String.self, forKey: .updatedAt)
    guard let raw else {
      throw DecodingError.keyNotFound(
        CodingKeys.contentUpdatedAt,
        .init(codingPath: c.codingPath, debugDescription: "content_updated_at 도 updated_at 도 없다")
      )
    }
    contentUpdatedAt = try Self.parse(raw, forKey: .contentUpdatedAt, in: c)
  }

  private static func date(
    in c: KeyedDecodingContainer<CodingKeys>, forKey key: CodingKeys
  ) throws -> Date {
    try parse(try c.decode(String.self, forKey: key), forKey: key, in: c)
  }

  private static func parse(
    _ raw: String, forKey key: CodingKeys, in c: KeyedDecodingContainer<CodingKeys>
  ) throws -> Date {
    guard let date = ServerTimestamp.parse(raw) else {
      throw DecodingError.dataCorruptedError(
        forKey: key, in: c, debugDescription: "Invalid ISO8601 date: \(raw)"
      )
    }
    return date
  }
}

/// `upsert_memo_if_base_hash` 의 `status`.
public enum UpsertStatus: String, Sendable {
  case inserted
  case updated
  case conflict
  case deleted
}

/// `deleted` 면 서버에 행이 없다 — 그래서 `memo` 가 nil 이다.
public struct UpsertOutcome: Sendable {
  public let status: UpsertStatus
  public let memo: RemoteMemo?

  public init(status: UpsertStatus, memo: RemoteMemo?) {
    self.status = status
    self.memo = memo
  }
}

/// 서버 타임스탬프 문자열 ↔ Date.
///
/// 소수점 초는 있을 수도 없을 수도 있다 — 데스크탑이 쓴 값은 `toISOString()` 이라
/// 밀리초가 붙지만 Postgres 가 만든 `now()` 나 초 단위로 떨어지는 값은 소수점이
/// 없다. `ISO8601DateFormatter` 는 `.withFractionalSeconds` 를 켠 쪽과 끈 쪽이
/// 서로의 형식을 못 읽으므로 둘 다 둔다.
public enum ServerTimestamp {
  public static func parse(_ raw: String) -> Date? {
    fractional.date(from: raw) ?? plain.date(from: raw)
  }

  /// 데스크탑의 `toISOString()` 과 같은 모양(UTC, 밀리초)을 낸다.
  public static func string(from date: Date) -> String {
    fractional.string(from: date)
  }

  // ISO8601DateFormatter 는 Sendable 이 아니지만, 여기서는 설정 후 읽기만 하고
  // 다시 바꾸지 않는다 — MemoStore 가 같은 이유로 같은 탈출구를 쓴다.
  private nonisolated(unsafe) static let fractional: ISO8601DateFormatter = {
    let f = ISO8601DateFormatter()
    f.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
    return f
  }()

  private nonisolated(unsafe) static let plain: ISO8601DateFormatter = {
    let f = ISO8601DateFormatter()
    f.formatOptions = [.withInternetDateTime]
    return f
  }()
}
