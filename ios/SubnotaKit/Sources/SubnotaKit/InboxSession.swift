import Foundation

/// 데스크탑 `services/backend/inboxService.ts` 의 `InboxSourceType`.
public enum InboxSourceType: String, Codable, Sendable, CaseIterable {
  case youtube
  case instagram
  case url
  case image

  /// 서버가 새 출처를 추가해도 카드가 통째로 사라지지 않게 한다.
  static let fallback = InboxSourceType.url
}

/// 데스크탑 `InboxSummaryStatus`. 요약 파이프라인의 상태다 —
/// `partial` 은 일부만 뽑힌 것, `unsupported` 는 그 사이트를 요약할 수 없는 것이다.
public enum InboxSummaryStatus: String, Codable, Sendable, CaseIterable {
  case pending
  case ready
  case partial
  case unsupported
  case failed

  /// 모르는 상태는 아직 처리 중으로 읽는다 — 실패로 읽으면 없는 재시도 버튼이 뜬다.
  static let fallback = InboxSummaryStatus.pending
}

/// 링크 한 건. 필드는 데스크탑 `InboxSession` 인터페이스를 그대로 옮겼다.
///
/// **`createdAt` 만 `Date` 다.** 목록 정렬에 쓰기 때문이다. `publishedAt` 은
/// 데스크탑처럼 문자열로 둔다 — 유튜브 메타데이터라 `2026-01` 같이 시각이 아닌
/// 값이 올 수 있고, 우리는 그걸 그대로 보여주기만 한다.
public struct InboxSession: Codable, Sendable, Equatable, Hashable, Identifiable {
  public let id: String
  public var canonicalUrl: String?
  public var channelTitle: String?
  /// 공유 확장이 만든 항목을 서버 항목과 이어 붙이는 열쇠. 같은 값을 두 번 보내면
  /// 서버가 하나로 친다 — 이게 없으면 앱을 두 번 열 때 카드가 두 개 생긴다.
  public var clientId: String?
  public var createdAt: Date
  public var description: String?
  public var domain: String?
  public var duration: String?
  public var keywords: [String]
  public var liked: Bool
  public var originalUrl: String?
  public var publishedAt: String?
  public var selectedText: String?
  public var sourceType: InboxSourceType
  public var summary: String?
  public var summaryBasis: String?
  public var summaryDetail: String?
  public var summaryOneLiner: String?
  public var summaryProvider: String?
  public var summarySearchText: String?
  public var summaryStatus: InboxSummaryStatus
  public var thumbnailUrl: String?
  public var title: String?
  public var userNote: String?

  public init(
    id: String,
    canonicalUrl: String? = nil,
    channelTitle: String? = nil,
    clientId: String? = nil,
    createdAt: Date,
    description: String? = nil,
    domain: String? = nil,
    duration: String? = nil,
    keywords: [String] = [],
    liked: Bool = false,
    originalUrl: String? = nil,
    publishedAt: String? = nil,
    selectedText: String? = nil,
    sourceType: InboxSourceType = .url,
    summary: String? = nil,
    summaryBasis: String? = nil,
    summaryDetail: String? = nil,
    summaryOneLiner: String? = nil,
    summaryProvider: String? = nil,
    summarySearchText: String? = nil,
    summaryStatus: InboxSummaryStatus = .pending,
    thumbnailUrl: String? = nil,
    title: String? = nil,
    userNote: String? = nil
  ) {
    self.id = id
    self.canonicalUrl = canonicalUrl
    self.channelTitle = channelTitle
    self.clientId = clientId
    self.createdAt = createdAt
    self.description = description
    self.domain = domain
    self.duration = duration
    self.keywords = keywords
    self.liked = liked
    self.originalUrl = originalUrl
    self.publishedAt = publishedAt
    self.selectedText = selectedText
    self.sourceType = sourceType
    self.summary = summary
    self.summaryBasis = summaryBasis
    self.summaryDetail = summaryDetail
    self.summaryOneLiner = summaryOneLiner
    self.summaryProvider = summaryProvider
    self.summarySearchText = summarySearchText
    self.summaryStatus = summaryStatus
    self.thumbnailUrl = thumbnailUrl
    self.title = title
    self.userNote = userNote
  }

  /// `id` 말고는 전부 `decodeIfPresent` 다. 서버 필드가 늘어 모델이 커져도
  /// 이미 저장된 캐시가 그대로 읽힌다 — 아니면 앱 업데이트 한 번에 목록이 빈다.
  public init(from decoder: Decoder) throws {
    let c = try decoder.container(keyedBy: CodingKeys.self)
    id = try c.decode(String.self, forKey: .id)
    canonicalUrl = try c.decodeIfPresent(String.self, forKey: .canonicalUrl)
    channelTitle = try c.decodeIfPresent(String.self, forKey: .channelTitle)
    clientId = try c.decodeIfPresent(String.self, forKey: .clientId)
    // 시각을 잃은 캐시는 목록 맨 아래로 간다. 카드를 버리지는 않는다.
    createdAt = try c.decodeIfPresent(Date.self, forKey: .createdAt) ?? .distantPast
    description = try c.decodeIfPresent(String.self, forKey: .description)
    domain = try c.decodeIfPresent(String.self, forKey: .domain)
    duration = try c.decodeIfPresent(String.self, forKey: .duration)
    keywords = try c.decodeIfPresent([String].self, forKey: .keywords) ?? []
    liked = try c.decodeIfPresent(Bool.self, forKey: .liked) ?? false
    originalUrl = try c.decodeIfPresent(String.self, forKey: .originalUrl)
    publishedAt = try c.decodeIfPresent(String.self, forKey: .publishedAt)
    selectedText = try c.decodeIfPresent(String.self, forKey: .selectedText)
    sourceType =
      try c.decodeIfPresent(InboxSourceType.self, forKey: .sourceType) ?? InboxSourceType.fallback
    summary = try c.decodeIfPresent(String.self, forKey: .summary)
    summaryBasis = try c.decodeIfPresent(String.self, forKey: .summaryBasis)
    summaryDetail = try c.decodeIfPresent(String.self, forKey: .summaryDetail)
    summaryOneLiner = try c.decodeIfPresent(String.self, forKey: .summaryOneLiner)
    summaryProvider = try c.decodeIfPresent(String.self, forKey: .summaryProvider)
    summarySearchText = try c.decodeIfPresent(String.self, forKey: .summarySearchText)
    summaryStatus =
      try c.decodeIfPresent(InboxSummaryStatus.self, forKey: .summaryStatus)
      ?? InboxSummaryStatus.fallback
    thumbnailUrl = try c.decodeIfPresent(String.self, forKey: .thumbnailUrl)
    title = try c.decodeIfPresent(String.self, forKey: .title)
    userNote = try c.decodeIfPresent(String.self, forKey: .userNote)
  }

  /// 목록 행 제목. 데스크탑 수집함 카드와 같은 순서로 떨어진다.
  public var listTitle: String {
    for candidate in [title, summaryOneLiner, canonicalUrl ?? originalUrl, domain] {
      let trimmed = candidate?.trimmingCharacters(in: .whitespacesAndNewlines) ?? ""
      if !trimmed.isEmpty { return trimmed }
    }
    return "제목 없음"
  }

  /// 원문을 열 주소. 정규화된 쪽이 먼저다.
  public var linkURL: URL? {
    (canonicalUrl ?? originalUrl).flatMap(URL.init(string:))
  }
}

/// 서버 `/inbox/sessions` 의 한 행. 키 이름은 데스크탑 `InboxSessionRow` 에서
/// 그대로 가져왔다.
public struct InboxSessionRow: Sendable, Equatable, Decodable {
  public struct Metadata: Sendable, Equatable, Decodable {
    public let authorName: String?
    public let channelTitle: String?
    public let duration: String?
    public let publishedAt: String?

    enum CodingKeys: String, CodingKey {
      case authorName = "author_name"
      case channelTitle = "channel_title"
      case duration
      case publishedAt = "published_at"
    }

    public init(from decoder: Decoder) throws {
      let c = try decoder.container(keyedBy: CodingKeys.self)
      authorName = try c.decodeIfPresent(String.self, forKey: .authorName)
      channelTitle = try c.decodeIfPresent(String.self, forKey: .channelTitle)
      duration = try c.decodeIfPresent(String.self, forKey: .duration)
      publishedAt = try c.decodeIfPresent(String.self, forKey: .publishedAt)
    }
  }

  public let canonicalUrl: String?
  public let clientId: String?
  public let createdAt: String?
  public let description: String?
  public let domain: String?
  public let id: String
  public let keywords: [String]?
  public let liked: Bool?
  public let originalUrl: String?
  public let selectedText: String?
  public let sourceType: String?
  public let summary: String?
  public let summaryBasis: String?
  public let summaryDetail: String?
  public let summaryOneLiner: String?
  public let summaryProvider: String?
  public let summarySearchText: String?
  public let summaryStatus: String?
  public let thumbnailUrl: String?
  public let title: String?
  public let userNote: String?
  public let metadata: Metadata?

  enum CodingKeys: String, CodingKey {
    case canonicalUrl = "canonical_url"
    case clientId = "client_id"
    case createdAt = "created_at"
    case description
    case domain
    case id
    case keywords
    case liked
    case originalUrl = "original_url"
    case selectedText = "selected_text"
    case sourceType = "source_type"
    case summary
    case summaryBasis = "summary_basis"
    case summaryDetail = "summary_detail"
    case summaryOneLiner = "summary_one_liner"
    case summaryProvider = "summary_provider"
    case summarySearchText = "summary_search_text"
    case summaryStatus = "summary_status"
    case thumbnailUrl = "thumbnail_url"
    case title
    case userNote = "user_note"
    case metadata
  }

  /// nullable 컬럼은 전부 흡수한다 — 한 행이 이상하다고 응답 전체가 깨지면
  /// 링크 목록이 통째로 안 뜬다.
  public init(from decoder: Decoder) throws {
    let c = try decoder.container(keyedBy: CodingKeys.self)
    id = try c.decode(String.self, forKey: .id)
    canonicalUrl = try c.decodeIfPresent(String.self, forKey: .canonicalUrl)
    clientId = try c.decodeIfPresent(String.self, forKey: .clientId)
    createdAt = try c.decodeIfPresent(String.self, forKey: .createdAt)
    description = try c.decodeIfPresent(String.self, forKey: .description)
    domain = try c.decodeIfPresent(String.self, forKey: .domain)
    keywords = try c.decodeIfPresent([String].self, forKey: .keywords)
    liked = try c.decodeIfPresent(Bool.self, forKey: .liked)
    originalUrl = try c.decodeIfPresent(String.self, forKey: .originalUrl)
    selectedText = try c.decodeIfPresent(String.self, forKey: .selectedText)
    sourceType = try c.decodeIfPresent(String.self, forKey: .sourceType)
    summary = try c.decodeIfPresent(String.self, forKey: .summary)
    summaryBasis = try c.decodeIfPresent(String.self, forKey: .summaryBasis)
    summaryDetail = try c.decodeIfPresent(String.self, forKey: .summaryDetail)
    summaryOneLiner = try c.decodeIfPresent(String.self, forKey: .summaryOneLiner)
    summaryProvider = try c.decodeIfPresent(String.self, forKey: .summaryProvider)
    summarySearchText = try c.decodeIfPresent(String.self, forKey: .summarySearchText)
    summaryStatus = try c.decodeIfPresent(String.self, forKey: .summaryStatus)
    thumbnailUrl = try c.decodeIfPresent(String.self, forKey: .thumbnailUrl)
    title = try c.decodeIfPresent(String.self, forKey: .title)
    userNote = try c.decodeIfPresent(String.self, forKey: .userNote)
    metadata = try c.decodeIfPresent(Metadata.self, forKey: .metadata)
  }

  /// 데스크탑 `mapInboxSession` 과 같은 매핑이다. 채널명이 없으면 작성자명으로
  /// 떨어지는 것까지 같다.
  public func toSession() -> InboxSession {
    InboxSession(
      id: id,
      canonicalUrl: canonicalUrl,
      channelTitle: metadata?.channelTitle ?? metadata?.authorName,
      clientId: clientId,
      // 읽을 수 없는 시각 때문에 카드를 버리지는 않는다 — 맨 아래로 보낸다.
      createdAt: createdAt.flatMap(ServerTimestamp.parse) ?? .distantPast,
      description: description,
      domain: domain,
      duration: metadata?.duration,
      keywords: keywords ?? [],
      liked: liked ?? false,
      originalUrl: originalUrl,
      publishedAt: metadata?.publishedAt,
      selectedText: selectedText,
      sourceType: sourceType.flatMap(InboxSourceType.init(rawValue:)) ?? InboxSourceType.fallback,
      summary: summary,
      summaryBasis: summaryBasis,
      summaryDetail: summaryDetail,
      summaryOneLiner: summaryOneLiner,
      summaryProvider: summaryProvider,
      summarySearchText: summarySearchText,
      summaryStatus: summaryStatus.flatMap(InboxSummaryStatus.init(rawValue:))
        ?? InboxSummaryStatus.fallback,
      thumbnailUrl: thumbnailUrl,
      title: title,
      userNote: userNote
    )
  }
}
