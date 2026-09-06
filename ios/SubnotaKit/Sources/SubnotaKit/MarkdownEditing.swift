import Foundation

/// 서식 툴바 버튼 하나에 대응하는 편집 동작.
public enum MarkdownEditAction: String, Sendable, CaseIterable {
  case bold
  case italic
  case strikethrough
  case inlineCode
  case heading
  case checkbox
  case bulletList
  case numberedList
  case quote
  case link
}

/// 원문 마크다운에 기호를 넣고 빼는 **순수 함수**.
///
/// UIKit 을 모른다 — 문자열과 `NSRange` 만 오간다. 그래야 UI 없이 왕복(적용 → 해제 →
/// 원문 일치)을 검증할 수 있다. `selection` 은 `MarkdownSpan.range` 와 같은
/// **UTF-16 오프셋**이다.
///
/// 모든 동작은 토글이다. 같은 버튼을 한 번 더 누르면 원문과 selection 이 정확히
/// 돌아온다(헤딩만 4단 순환 — `없음 → # → ## → ### → 없음`).
public enum MarkdownEditing {
  public static func toggle(
    _ action: MarkdownEditAction,
    in text: String,
    selection: NSRange
  ) -> (text: String, selection: NSRange) {
    let source = text as NSString
    let range = clamped(selection, length: source.length)

    switch action {
    case .bold: return wrap("**", source, range)
    case .italic: return wrap("*", source, range)
    case .strikethrough: return wrap("~~", source, range)
    case .inlineCode: return wrap("`", source, range)
    case .link: return toggleLink(source, range)
    case .heading, .checkbox, .bulletList, .numberedList, .quote:
      return editLines(action, source, range)
    }
  }

  // MARK: - 감싸는 기호 (굵게·기울임·취소선·인라인 코드)

  private static func wrap(
    _ marker: String, _ source: NSString, _ range: NSRange
  ) -> (text: String, selection: NSRange) {
    let width = (marker as NSString).length

    // 1) 선택이 `**굵게**` 통째면 안쪽 기호를 벗긴다.
    if range.length >= 2 * width {
      let selected = source.substring(with: range)
      if selected.hasPrefix(marker), selected.hasSuffix(marker), !isAsteriskPair(marker, selected) {
        let edits = [
          (NSRange(location: range.location, length: width), ""),
          (NSRange(location: NSMaxRange(range) - width, length: width), ""),
        ]
        return (
          applying(edits, to: source),
          NSRange(location: range.location, length: range.length - 2 * width)
        )
      }
    }

    // 2) 선택(또는 커서) 바깥에 기호가 붙어 있으면 그걸 벗긴다.
    let open = NSRange(location: range.location - width, length: width)
    let close = NSRange(location: NSMaxRange(range), length: width)
    if open.location >= 0, NSMaxRange(close) <= source.length,
      source.substring(with: open) == marker, source.substring(with: close) == marker,
      !isNestedAsterisk(marker, source, open: open, close: close)
    {
      return (
        applying([(open, ""), (close, "")], to: source),
        NSRange(location: open.location, length: range.length)
      )
    }

    // 3) 아니면 감싼다. 선택이 없으면 기호 사이에 커서를 둔다.
    let edits = [
      (NSRange(location: range.location, length: 0), marker),
      (NSRange(location: NSMaxRange(range), length: 0), marker),
    ]
    return (
      applying(edits, to: source),
      NSRange(location: range.location + width, length: range.length)
    )
  }

  /// `*` 로 기울임을 토글할 때 굵게(`**`)를 반으로 쪼개지 않게 막는다.
  private static func isAsteriskPair(_ marker: String, _ selected: String) -> Bool {
    marker == "*" && selected.hasPrefix("**")
  }

  private static func isNestedAsterisk(
    _ marker: String, _ source: NSString, open: NSRange, close: NSRange
  ) -> Bool {
    guard marker == "*" else { return false }
    let before = open.location - 1
    let after = NSMaxRange(close)
    if before >= 0, source.substring(with: NSRange(location: before, length: 1)) == "*" {
      return true
    }
    if after < source.length, source.substring(with: NSRange(location: after, length: 1)) == "*" {
      return true
    }
    return false
  }

  // MARK: - 링크

  /// 라벨은 여러 줄을 허용한다(토글 대칭을 위해). URL 은 한 줄이다.
  private static let linkPattern = try! NSRegularExpression(
    pattern: #"\[([^\]]*)\]\(([^)\n]*)\)"#)

  private static func toggleLink(
    _ source: NSString, _ range: NSRange
  ) -> (text: String, selection: NSRange) {
    let whole = NSRange(location: 0, length: source.length)
    for match in linkPattern.matches(in: source as String, range: whole) {
      // 선택이 링크 **안쪽**에 있을 때만 푼다. 링크 전체를 잡고 눌렀으면 새로 감싼다.
      guard range.location > match.range.location,
        NSMaxRange(range) < NSMaxRange(match.range)
      else { continue }
      let label = source.substring(with: match.range(at: 1))
      return (
        applying([(match.range, label)], to: source),
        NSRange(location: match.range.location, length: (label as NSString).length)
      )
    }

    let label = source.substring(with: range)
    // 선택이 있으면 URL 자리, 없으면 라벨 자리에 커서를 둔다 — 둘 다 바로 타이핑할 곳이다.
    let caret =
      range.length > 0
      ? NSMaxRange(range) + 3  // `[` + 라벨 + `](`
      : range.location + 1
    return (
      applying([(range, "[\(label)]()")], to: source),
      NSRange(location: caret, length: 0)
    )
  }

  // MARK: - 줄 앞 기호 (헤딩·체크박스·리스트·인용)

  private static func editLines(
    _ action: MarkdownEditAction, _ source: NSString, _ range: NSRange
  ) -> (text: String, selection: NSRange) {
    let lines = affectedLines(source, range)
    let bodies = lines.map { source.substring(with: $0.content) }
    let owns = bodies.map { existingPrefixLength(action, $0) }

    let olds: [Int]
    let news: [String]
    if action == .heading {
      // 없음 → # → ## → ### → 없음. 기준은 첫 줄의 단계다.
      let next = headingLevel(bodies[0]) >= 3 ? 0 : headingLevel(bodies[0]) + 1
      let marker = next == 0 ? "" : String(repeating: "#", count: next) + " "
      olds = owns
      news = bodies.map { _ in marker }
    } else {
      // 전부 이미 붙어 있으면 뗀다. 하나라도 없으면 전부 붙인다.
      let removing = owns.allSatisfy { $0 > 0 }
      // 리스트 세 종류는 한 자리를 나눠 쓴다 — 글머리에 번호를 매기면 `1. - one` 이
      // 아니라 `1. one` 이 돼야 한다. 인용·헤딩은 리스트와 겹칠 수 있어 건드리지 않는다.
      olds =
        removing || !isList(action) ? owns : bodies.map { listPrefixLength($0) }
      news = bodies.indices.map { removing ? "" : marker(action, index: $0) }
    }

    var edits: [(NSRange, String)] = []
    var shifts: [Shift] = []
    var cumulative = 0
    for (index, line) in lines.enumerated() {
      let old = olds[index]
      let new = (news[index] as NSString).length
      edits.append((NSRange(location: line.start, length: old), news[index]))
      shifts.append(Shift(start: line.start, old: old, new: new, before: cumulative))
      cumulative += new - old
    }

    let start = move(range.location, shifts)
    let end = move(NSMaxRange(range), shifts)
    return (
      applying(edits, to: source),
      NSRange(location: start, length: max(0, end - start))
    )
  }

  private struct Shift {
    let start: Int
    let old: Int
    let new: Int
    /// 이 줄 앞에서 이미 밀린 양.
    let before: Int
  }

  /// 원문 오프셋 → 편집 후 오프셋. 지워진 기호 안에 있던 커서는 줄 시작으로 당긴다.
  private static func move(_ offset: Int, _ shifts: [Shift]) -> Int {
    guard let shift = shifts.last(where: { $0.start <= offset }) else { return offset }
    if offset <= shift.start + shift.old {
      return shift.start + shift.before + min(offset - shift.start, shift.new)
    }
    return offset + shift.before + (shift.new - shift.old)
  }

  private struct Line {
    /// 기호를 넣을 자리 — 들여쓰기 **다음**이다. 중첩 리스트에서 `- [ ]   - 항목`
    /// 이 되지 않게.
    let start: Int
    /// 들여쓰기와 개행을 뺀 줄 내용.
    let content: NSRange
  }

  private static func affectedLines(_ source: NSString, _ range: NSRange) -> [Line] {
    // 줄 시작에서 끝나는 선택이 다음 줄까지 물지 않게 한 글자 줄인다.
    var probe = range
    if probe.length > 0 { probe.length -= 1 }
    let block = source.lineRange(for: probe)

    var lines: [Line] = []
    var cursor = block.location
    repeat {
      var start = 0
      var end = 0
      var contentsEnd = 0
      source.getLineStart(
        &start, end: &end, contentsEnd: &contentsEnd,
        for: NSRange(location: cursor, length: 0))
      var anchor = start
      while anchor < contentsEnd,
        source.substring(with: NSRange(location: anchor, length: 1)) == " "
          || source.substring(with: NSRange(location: anchor, length: 1)) == "\t"
      {
        anchor += 1
      }
      lines.append(
        Line(start: anchor, content: NSRange(location: anchor, length: contentsEnd - anchor)))
      cursor = end
    } while cursor < NSMaxRange(block)
    return lines
  }

  private static func marker(_ action: MarkdownEditAction, index: Int) -> String {
    switch action {
    case .checkbox: return "- [ ] "
    case .bulletList: return "- "
    case .numberedList: return "\(index + 1). "
    case .quote: return "> "
    default: return ""
    }
  }

  private static let prefixPatterns: [MarkdownEditAction: NSRegularExpression] = [
    .heading: try! NSRegularExpression(pattern: #"^#{1,6} "#),
    .checkbox: try! NSRegularExpression(pattern: #"^- \[[ xX]\] "#),
    // 체크박스도 `- ` 로 시작한다 — 글머리 토글이 체크박스를 반쪽 내지 않게 뺀다.
    .bulletList: try! NSRegularExpression(pattern: #"^- (?!\[[ xX]\] )"#),
    .numberedList: try! NSRegularExpression(pattern: #"^\d+\. "#),
    .quote: try! NSRegularExpression(pattern: #"^> "#),
  ]

  private static let listPattern = try! NSRegularExpression(
    pattern: #"^(?:- \[[ xX]\] |- |\d+\. )"#)

  private static func isList(_ action: MarkdownEditAction) -> Bool {
    action == .bulletList || action == .numberedList || action == .checkbox
  }

  private static func existingPrefixLength(_ action: MarkdownEditAction, _ body: String) -> Int {
    guard let pattern = prefixPatterns[action] else { return 0 }
    return matchLength(pattern, body)
  }

  private static func listPrefixLength(_ body: String) -> Int {
    matchLength(listPattern, body)
  }

  private static func matchLength(_ pattern: NSRegularExpression, _ body: String) -> Int {
    let range = NSRange(location: 0, length: (body as NSString).length)
    guard let match = pattern.firstMatch(in: body, options: [.anchored], range: range) else {
      return 0
    }
    return match.range.length
  }

  private static func headingLevel(_ body: String) -> Int {
    let length = existingPrefixLength(.heading, body)
    return length > 0 ? length - 1 : 0
  }

  // MARK: - 도우미

  private static func clamped(_ range: NSRange, length: Int) -> NSRange {
    let location = min(max(0, range.location), length)
    return NSRange(location: location, length: min(max(0, range.length), length - location))
  }

  private static func applying(_ edits: [(NSRange, String)], to source: NSString) -> String {
    let result = NSMutableString(string: source)
    // 뒤에서부터 고쳐야 앞 편집이 뒤 범위를 밀지 않는다.
    for edit in edits.sorted(by: { $0.0.location > $1.0.location }) {
      result.replaceCharacters(in: edit.0, with: edit.1)
    }
    return result as String
  }
}
