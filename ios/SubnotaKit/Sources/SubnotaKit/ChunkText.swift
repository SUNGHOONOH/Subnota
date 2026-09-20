import Foundation

/// 데스크탑 `desktop/src/lib/chunkText.ts` 의 쌍둥이. 동작이 갈리면 두 기기가
/// 서로 다른 벡터를 만든다 — `chunktext-golden.json` 이 그걸 잡는다.
///
/// 청크 원문은 손대지 않는다. 오프셋과 편집기 텍스트 매칭의 기준이기 때문이다.
/// 화면에 그릴 때와 임베딩할 때만 이 함수를 통과시킨다.
///
/// 에디터가 하이라이트를 마크다운 본문에 raw HTML 로 직렬화해서 이런 청크가 남는다:
///   `## <mark data-color="var(--tt-color-highlight-green)">다른 앱 아이디어</mark>`
/// 70자 중 55자가 태그라 뜻이 묻히고, 목록에도 태그가 그대로 보인다.
public enum ChunkText {
  /// JS 의 `\s` 와 같은 집합. **ICU 의 `\s` 를 쓰면 안 된다** — 세로탭(U+000B)과
  /// ZWNBSP(U+FEFF)가 빠져 같은 본문이 두 기기에서 다른 벡터가 된다.
  private static let jsSpace =
    "\\t\\n\\u000B\\f\\r \\u00A0\\u1680\\u2000-\\u200A\\u2028\\u2029\\u202F\\u205F\\u3000\\uFEFF"

  /// 여는 꺾쇠 다음에 글자가 와야 태그로 본다. `<[^>]+>` 로 하면
  /// "3 < 5 그리고 7 > 2" 의 가운데가 태그로 잡혀 본문이 지워진다.
  private static let tag = regex("</?[a-zA-Z][^>]*>")
  private static let entity = regex("&(nbsp|amp|lt|gt|quot|#39);")
  /// JS 의 `/^.../gm` 은 줄 구분자가 `\n \r    ` 뿐이다. ICU 의
  /// 멀티라인은 NEL(U+0085)도 줄바꿈으로 세므로 `^` 를 쓰지 않고 직접 적는다.
  private static let heading = regex("(?:^|(?<=[\\n\\r\\u2028\\u2029]))#{1,6}[\(jsSpace)]*")
  private static let bullet = regex("(?:^|(?<=[\\n\\r\\u2028\\u2029]))[-*+][\(jsSpace)]+")
  private static let spaceRun = regex("[\(jsSpace)]+")

  private static let entityText: [String: String] = [
    "#39": "'", "amp": "&", "gt": ">", "lt": "<", "nbsp": " ", "quot": "\"",
  ]

  private static func regex(_ pattern: String) -> NSRegularExpression {
    // 패턴은 전부 이 파일 안의 상수다. 실패하면 빌드가 잘못된 것이므로 즉시 죽는다.
    try! NSRegularExpression(pattern: pattern)
  }

  private static func replacingAll(
    _ text: String, _ expression: NSRegularExpression, with template: String
  ) -> String {
    expression.stringByReplacingMatches(
      in: text, range: NSRange(text.startIndex..., in: text), withTemplate: template)
  }

  public static func normalized(_ text: String) -> String {
    // 태그를 먼저 떼고 엔티티를 푼다 — 순서가 반대면 `&lt;b&gt;` 가 태그로
    // 되살아나 지워진다.
    var value = replacingAll(text, tag, with: " ")
    value = expandEntities(value)
    value = replacingAll(value, heading, with: "")
    value = replacingAll(value, bullet, with: "")
    value = replacingAll(value, spaceRun, with: " ")
    return value.trimmingCharacters(in: jsWhitespace)
  }

  private static func expandEntities(_ text: String) -> String {
    let source = text as NSString
    let matches = entity.matches(
      in: text, range: NSRange(location: 0, length: source.length))
    guard !matches.isEmpty else { return text }
    var out = ""
    var cursor = 0
    for match in matches {
      out += source.substring(with: NSRange(location: cursor, length: match.range.location - cursor))
      let name = source.substring(with: match.range(at: 1))
      out += entityText[name] ?? " "
      cursor = match.range.location + match.range.length
    }
    out += source.substring(from: cursor)
    return out
  }

  /// JS 의 `String.prototype.trim` 과 같은 집합으로 다듬는다.
  private static let jsWhitespace: CharacterSet = {
    var set = CharacterSet()
    for scalar in [
      0x09, 0x0A, 0x0B, 0x0C, 0x0D, 0x20, 0xA0, 0x1680, 0x2028, 0x2029, 0x202F, 0x205F,
      0x3000, 0xFEFF,
    ] {
      set.insert(Unicode.Scalar(scalar)!)
    }
    for scalar in 0x2000...0x200A { set.insert(Unicode.Scalar(scalar)!) }
    return set
  }()

  /// 색인에서 뺄 청크. `&nbsp;`, `1.`, `교통`, `ㅇㅇㅇ` 처럼 내용이 없는 것들이
  /// 코퍼스 한가운데에 놓여 아무 질의에나 1등으로 올라온다.
  private static let contentWord = regex("[가-힣]{2,}|[A-Za-z]{3,}")
  private static let minimumContentWords = 2

  public static func hasSearchableContent(_ text: String) -> Bool {
    let value = normalized(text)
    return contentWord.numberOfMatches(
      in: value, range: NSRange(value.startIndex..., in: value)) >= minimumContentWords
  }
}
