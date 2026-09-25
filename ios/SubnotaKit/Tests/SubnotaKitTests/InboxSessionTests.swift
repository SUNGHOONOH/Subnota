import Foundation
import Testing

@testable import SubnotaKit

/// 키 이름은 데스크탑 `inboxService.ts` 의 `InboxSessionRow` 에서 그대로 가져왔다.
private let serverRowJSON = """
  {
    "canonical_url": "https://www.youtube.com/watch?v=abc",
    "client_id": "share-1",
    "created_at": "2026-09-07T01:02:03.456Z",
    "description": "설명",
    "domain": "youtube.com",
    "id": "row-1",
    "keywords": ["swift", "ios"],
    "liked": true,
    "original_url": "https://youtu.be/abc",
    "selected_text": "고른 문장",
    "source_type": "youtube",
    "summary": "요약 본문",
    "summary_basis": "자막",
    "summary_detail": "자세한 요약",
    "summary_one_liner": "한 줄 요약",
    "summary_provider": "gemini",
    "summary_search_text": "검색용 텍스트",
    "summary_status": "ready",
    "thumbnail_url": "https://img/abc.jpg",
    "title": "영상 제목",
    "user_note": "내 메모",
    "metadata": {
      "author_name": "작성자",
      "channel_title": "채널",
      "duration": "PT10M",
      "published_at": "2026-08-01T00:00:00Z"
    }
  }
  """

private func decodeRow(_ json: String) throws -> InboxSessionRow {
  try JSONDecoder().decode(InboxSessionRow.self, from: Data(json.utf8))
}

@Test func mapsAServerRowOntoTheDesktopShape() throws {
  let session = try decodeRow(serverRowJSON).toSession()

  #expect(session.id == "row-1")
  #expect(session.canonicalUrl == "https://www.youtube.com/watch?v=abc")
  #expect(session.clientId == "share-1")
  #expect(session.domain == "youtube.com")
  #expect(session.keywords == ["swift", "ios"])
  #expect(session.liked)
  #expect(session.originalUrl == "https://youtu.be/abc")
  #expect(session.selectedText == "고른 문장")
  #expect(session.sourceType == .youtube)
  #expect(session.summary == "요약 본문")
  #expect(session.summaryBasis == "자막")
  #expect(session.summaryDetail == "자세한 요약")
  #expect(session.summaryOneLiner == "한 줄 요약")
  #expect(session.summaryProvider == "gemini")
  #expect(session.summarySearchText == "검색용 텍스트")
  #expect(session.summaryStatus == .ready)
  #expect(session.thumbnailUrl == "https://img/abc.jpg")
  #expect(session.title == "영상 제목")
  #expect(session.userNote == "내 메모")
  // 데스크탑 `mapInboxSession` 은 이 셋을 metadata 에서 꺼낸다.
  #expect(session.channelTitle == "채널")
  #expect(session.duration == "PT10M")
  #expect(session.publishedAt == "2026-08-01T00:00:00Z")
}

/// 데스크탑은 `channel_title ?? author_name` 으로 떨어진다.
@Test func fallsBackToTheAuthorNameWhenNoChannelTitle() throws {
  let json = """
    {"id": "row-1", "created_at": "2026-09-07T01:02:03.456Z",
     "metadata": {"author_name": "작성자"}}
    """
  #expect(try decodeRow(json).toSession().channelTitle == "작성자")
}

@Test func keepsFractionalSecondsFromTheServerTimestamp() throws {
  let session = try decodeRow(serverRowJSON).toSession()
  #expect(ServerTimestamp.string(from: session.createdAt) == "2026-09-07T01:02:03.456Z")
}

/// Postgres 가 만든 `now()` 는 소수점 초가 없을 수 있다. 둘 다 읽혀야 한다.
@Test func readsATimestampWithoutFractionalSeconds() throws {
  let json = """
    {"id": "row-1", "created_at": "2026-09-07T01:02:03Z"}
    """
  #expect(
    try decodeRow(json).toSession().createdAt == ServerTimestamp.parse("2026-09-07T01:02:03Z"))
}

/// nullable 컬럼이 통째로 빠져도 행 하나가 응답 전체를 깨뜨리면 안 된다.
@Test func absorbsARowWithOnlyTheRequiredColumns() throws {
  let session = try decodeRow(#"{"id": "row-1", "created_at": "2026-09-07T01:02:03.456Z"}"#)
    .toSession()

  #expect(session.keywords.isEmpty)
  #expect(!session.liked)
  #expect(session.sourceType == .url)
  #expect(session.summaryStatus == .pending)
  #expect(session.title == nil)
}

/// 서버가 새 출처·새 상태를 추가해도 카드가 사라지면 안 된다.
@Test func fallsBackWhenTheServerSendsAnUnknownEnumValue() throws {
  let json = """
    {"id": "row-1", "created_at": "2026-09-07T01:02:03.456Z",
     "source_type": "podcast", "summary_status": "queued"}
    """
  let session = try decodeRow(json).toSession()

  #expect(session.sourceType == .url)
  // 모르는 상태를 실패로 읽으면 없는 재시도 버튼이 뜬다.
  #expect(session.summaryStatus == .pending)
}

/// 앱 업데이트로 모델에 필드가 늘어도 이미 저장된 캐시가 읽혀야 한다.
/// `decodeIfPresent` 가 없으면 여기서 목록이 통째로 빈다.
@Test func decodesACachedPayloadThatPredatesNewerFields() throws {
  let legacyPayload = """
    {"id": "row-1", "createdAt": "2026-09-07T01:02:03.456Z", "title": "옛 캐시"}
    """
  let session = try PayloadCoder.decode(InboxSession.self, from: legacyPayload)

  #expect(session.title == "옛 캐시")
  #expect(session.keywords.isEmpty)
  #expect(!session.liked)
  #expect(session.summaryStatus == .pending)
}

/// 저장→읽기 왕복에서 소수점 초가 잘리면 데스크탑과 시각이 갈린다.
@Test func roundTripsThroughTheLocalPayloadWithoutLosingPrecision() throws {
  let original = try decodeRow(serverRowJSON).toSession()
  let restored = try PayloadCoder.decode(
    InboxSession.self, from: try PayloadCoder.encode(original))

  #expect(restored == original)
}

@Test func picksTheListTitleTheWayTheDesktopCardDoes() throws {
  let base = try decodeRow(#"{"id": "row-1", "created_at": "2026-09-07T01:02:03.456Z"}"#)
    .toSession()
  #expect(base.listTitle == "제목 없음")

  var withDomain = base
  withDomain.domain = "example.com"
  #expect(withDomain.listTitle == "example.com")

  var withOneLiner = withDomain
  withOneLiner.summaryOneLiner = "한 줄 요약"
  #expect(withOneLiner.listTitle == "한 줄 요약")

  var withTitle = withOneLiner
  withTitle.title = "  제목  "
  #expect(withTitle.listTitle == "제목")
}

// MARK: - InboxStore

private func makeStore() throws -> InboxStore {
  let dir = URL(fileURLWithPath: NSTemporaryDirectory())
    .appendingPathComponent(UUID().uuidString, isDirectory: true)
  try FileManager.default.createDirectory(at: dir, withIntermediateDirectories: true)
  return InboxStore(
    store: try LocalStore(path: dir.appendingPathComponent("test.sqlite3")), ownerId: "user-1"
  )
}

private func session(_ id: String, at iso: String) -> InboxSession {
  guard let date = ServerTimestamp.parse(iso) else {
    fatalError("테스트 픽스처의 시각이 잘못됐다: \(iso)")
  }
  return InboxSession(id: id, createdAt: date, title: "제목 \(id)")
}

/// 공유한 링크가 맨 위에 있어야 한다 — 최신 순이다.
@Test func listsSessionsNewestFirst() throws {
  let store = try makeStore()
  try store.replace(with: [
    session("old", at: "2026-09-06T01:00:00.000Z"),
    session("new", at: "2026-09-07T01:00:00.000Z"),
  ])

  #expect(try store.sessions().map(\.id) == ["new", "old"])
}

/// 서버 응답이 정본이다 — 다른 기기에서 지운 항목은 여기서도 사라진다.
@Test func dropsSessionsMissingFromTheServerAnswer() throws {
  let store = try makeStore()
  try store.replace(with: [session("a", at: "2026-09-06T01:00:00.000Z")])
  try store.replace(with: [session("b", at: "2026-09-07T01:00:00.000Z")])

  #expect(try store.sessions().map(\.id) == ["b"])
}

@Test func upsertsASingleSessionAfterALikeToggle() throws {
  let store = try makeStore()
  var liked = session("a", at: "2026-09-06T01:00:00.000Z")
  try store.replace(with: [liked])

  liked.liked = true
  try store.upsert(liked)

  #expect(try store.sessions() == [liked])
}

@Test func deletesASession() throws {
  let store = try makeStore()
  try store.replace(with: [session("a", at: "2026-09-06T01:00:00.000Z")])

  try store.delete(id: "a")

  #expect(try store.sessions().isEmpty)
}
