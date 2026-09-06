import Foundation
import Markdown

/// 원문 마크다운의 한 구간과 거기 입힐 표시 스타일.
///
/// `range` 는 **원문 문자열 기준 UTF-16 오프셋**(`NSRange`)이다. `NSAttributedString`
/// 과 `UITextView.textStorage` 가 UTF-16 을 쓰기 때문이다.
public struct MarkdownSpan: Sendable, Equatable {
  public let range: NSRange
  public let style: MarkdownStyle

  public init(range: NSRange, style: MarkdownStyle) {
    self.range = range
    self.style = style
  }
}

public enum MarkdownStyle: Sendable, Equatable {
  case heading(level: Int)
  case bold
  case italic
  case strikethrough
  case inlineCode
  case link(destination: String)
  /// 1 이 바깥쪽. 중첩 인용문마다 1 씩 늘어난다.
  case blockQuote(depth: Int)
  /// 1 이 최상위 리스트. 중첩마다 1 씩 늘어난다.
  case listItem(ordered: Bool, depth: Int)
  case checkbox(checked: Bool)
  case thematicBreak
  case codeBlock
  case highlight
  case frontmatter
  case dateHighlight
  /// `**`, `#`, `- [ ]`, `[`, `](url)` 같은 기호의 범위.
  /// 표시할 때 **흐리게** 한다 — 지우면 표시 길이가 원문과 어긋나 커서가 깨진다.
  case syntaxMarker
}

/// 원문 마크다운 문자열 → 표시용 속성 범위 계산기.
///
/// **이 모듈은 문자열을 돌려주지 않는다.** 원문이 진실의 원천이고 여기서는 범위만
/// 계산한다. 문자열을 재생성하는 순간 파서가 모르는 문법에서 왕복 손실이 난다.
///
/// UIKit 을 모른다 — `NSAttributedString` 조립은 앱 타겟이 한다.
public enum MarkdownAttributes {
  public static func spans(for text: String, now: Date = Date()) -> [MarkdownSpan] {
    guard !text.isEmpty else { return [] }

    let table = SourceOffsetTable(text)
    var spans: [MarkdownSpan] = []
    // 코드블록·인라인코드·HTML 블록. 여기 겹치는 정규식/날짜 오버레이는 버린다.
    var rawRanges: [NSRange] = []

    for child in Document(parsing: text).children {
      visit(child, table: table, listDepth: 0, quoteDepth: 0, spans: &spans, raw: &rawRanges)
    }

    let frontmatter = frontmatterRange(in: text)
    if let frontmatter {
      // cmark 는 맨 앞 `---` 를 thematicBreak + setext heading 으로 읽는다.
      // frontmatter 로 덮고 그 안의 AST span 은 버린다.
      spans.removeAll { NSIntersectionRange($0.range, frontmatter).length > 0 }
      rawRanges.append(frontmatter)
      spans.append(MarkdownSpan(range: frontmatter, style: .frontmatter))
    }

    func isRaw(_ range: NSRange) -> Bool {
      rawRanges.contains { NSIntersectionRange($0, range).length > 0 }
    }

    for overlay in highlightSpans(in: text) where !isRaw(overlay.range) {
      spans.append(overlay)
    }

    for match in DateParser.parseDates(text, baseTimestamp: now) {
      let range = NSRange(location: match.index, length: match.length)
      guard !isRaw(range) else { continue }
      spans.append(MarkdownSpan(range: range, style: .dateHighlight))
    }

    let limit = table.utf16Length
    let valid = spans.filter { $0.range.length > 0 && NSMaxRange($0.range) <= limit }
    // 결정적인 순서: 앞에서 뒤로, 같은 위치면 바깥(긴 것)부터. 나머지는 삽입 순서.
    return valid.enumerated().sorted { a, b in
      if a.element.range.location != b.element.range.location {
        return a.element.range.location < b.element.range.location
      }
      if a.element.range.length != b.element.range.length {
        return a.element.range.length > b.element.range.length
      }
      return a.offset < b.offset
    }.map(\.element)
  }

  // MARK: - AST

  private static func visit(
    _ markup: Markup,
    table: SourceOffsetTable,
    listDepth: Int,
    quoteDepth: Int,
    spans: inout [MarkdownSpan],
    raw: inout [NSRange]
  ) {
    let range = markup.range.flatMap { table.range($0) }
    var childListDepth = listDepth
    var childQuoteDepth = quoteDepth

    switch markup {
    case let node as Heading:
      if let range {
        spans.append(MarkdownSpan(range: range, style: .heading(level: node.level)))
        appendLeadingMarker(of: node, range: range, table: table, into: &spans)
      }

    case is Strong:
      emit(.bold, markup, range, table, &spans)

    case is Emphasis:
      emit(.italic, markup, range, table, &spans)

    case is Strikethrough:
      emit(.strikethrough, markup, range, table, &spans)

    case is InlineCode:
      if let range {
        // 백틱까지 통째로 고정폭으로 둔다 — 백틱 개수는 AST 로 알 수 없다.
        spans.append(MarkdownSpan(range: range, style: .inlineCode))
        raw.append(range)
      }

    case is CodeBlock:
      if let range {
        spans.append(MarkdownSpan(range: range, style: .codeBlock))
        raw.append(range)
      }

    case is HTMLBlock:
      // 스타일은 주지 않는다(원문 보존). 오버레이만 막는다.
      if let range { raw.append(range) }

    case let node as Link:
      if let range {
        spans.append(MarkdownSpan(range: range, style: .link(destination: node.destination ?? "")))
        appendDelimiters(of: node, range: range, table: table, into: &spans)
      }

    case is BlockQuote:
      childQuoteDepth += 1
      if let range {
        spans.append(MarkdownSpan(range: range, style: .blockQuote(depth: childQuoteDepth)))
      }

    case is UnorderedList, is OrderedList:
      childListDepth += 1

    case let node as ListItem:
      if let range {
        let ordered = node.parent is OrderedList
        spans.append(
          MarkdownSpan(range: range, style: .listItem(ordered: ordered, depth: max(listDepth, 1)))
        )
        // `- `, `1. `, `- [x] ` — 첫 자식이 시작하기 전까지가 기호다.
        if let bounds = childBounds(node, table), bounds.start > range.location {
          let marker = NSRange(location: range.location, length: bounds.start - range.location)
          spans.append(MarkdownSpan(range: marker, style: .syntaxMarker))
          if let checkbox = node.checkbox {
            spans.append(
              MarkdownSpan(range: marker, style: .checkbox(checked: checkbox == .checked))
            )
          }
        }
      }

    case is ThematicBreak:
      if let range {
        spans.append(MarkdownSpan(range: range, style: .thematicBreak))
      }

    default:
      break
    }

    for child in markup.children {
      visit(
        child, table: table, listDepth: childListDepth, quoteDepth: childQuoteDepth,
        spans: &spans, raw: &raw)
    }
  }

  private static func emit(
    _ style: MarkdownStyle,
    _ markup: Markup,
    _ range: NSRange?,
    _ table: SourceOffsetTable,
    _ spans: inout [MarkdownSpan]
  ) {
    guard let range else { return }
    spans.append(MarkdownSpan(range: range, style: style))
    appendDelimiters(of: markup, range: range, table: table, into: &spans)
  }

  /// `**bd**` 의 앞뒤 `**`, `[x](url)` 의 `[` 와 `](url)`.
  private static func appendDelimiters(
    of markup: Markup, range: NSRange, table: SourceOffsetTable, into spans: inout [MarkdownSpan]
  ) {
    guard let bounds = childBounds(markup, table) else { return }
    if bounds.start > range.location {
      spans.append(
        MarkdownSpan(
          range: NSRange(location: range.location, length: bounds.start - range.location),
          style: .syntaxMarker))
    }
    let end = NSMaxRange(range)
    if end > bounds.end {
      spans.append(
        MarkdownSpan(
          range: NSRange(location: bounds.end, length: end - bounds.end), style: .syntaxMarker))
    }
  }

  /// `# ` 처럼 앞쪽에만 붙는 기호.
  private static func appendLeadingMarker(
    of markup: Markup, range: NSRange, table: SourceOffsetTable, into spans: inout [MarkdownSpan]
  ) {
    guard let bounds = childBounds(markup, table), bounds.start > range.location else { return }
    spans.append(
      MarkdownSpan(
        range: NSRange(location: range.location, length: bounds.start - range.location),
        style: .syntaxMarker))
  }

  private static func childBounds(_ markup: Markup, _ table: SourceOffsetTable) -> (
    start: Int, end: Int
  )? {
    // SoftBreak 처럼 range 가 nil 인 노드가 있다 — 실측했다.
    let ranges = markup.children.compactMap { $0.range.flatMap { table.range($0) } }
    guard let first = ranges.first, let last = ranges.last else { return nil }
    return (first.location, NSMaxRange(last))
  }

  // MARK: - 정규식 오버레이

  /// `==text==` 와 `<mark …>text</mark>`. `cmark-gfm` 확장에 없어서 정규식으로 얹는다.
  private static let highlightPatterns: [NSRegularExpression] = {
    // `==` 는 한 줄 안에서만. `.` 는 기본으로 개행을 매치하지 않는다.
    let equals = try! NSRegularExpression(pattern: "==(?!=)(.+?)==")
    let mark = try! NSRegularExpression(
      pattern: "<mark\\b[^>]*>(.*?)</mark>", options: [.caseInsensitive])
    return [equals, mark]
  }()

  private static func highlightSpans(in text: String) -> [MarkdownSpan] {
    let ns = text as NSString
    let full = NSRange(location: 0, length: ns.length)
    var out: [MarkdownSpan] = []
    for pattern in highlightPatterns {
      for match in pattern.matches(in: text, range: full) {
        let whole = match.range
        let inner = match.range(at: 1)
        out.append(MarkdownSpan(range: whole, style: .highlight))
        guard inner.location != NSNotFound else { continue }
        if inner.location > whole.location {
          out.append(
            MarkdownSpan(
              range: NSRange(location: whole.location, length: inner.location - whole.location),
              style: .syntaxMarker))
        }
        if NSMaxRange(whole) > NSMaxRange(inner) {
          out.append(
            MarkdownSpan(
              range: NSRange(
                location: NSMaxRange(inner), length: NSMaxRange(whole) - NSMaxRange(inner)),
              style: .syntaxMarker))
        }
      }
    }
    return out
  }

  /// 문서 **맨 앞** `---\n…\n---` 일 때만. 중간에 나오는 `---` 는 thematicBreak 이다.
  private static let frontmatterPattern = try! NSRegularExpression(
    pattern: "---[ \\t]*\\r?\\n[\\s\\S]*?\\r?\\n?---[ \\t]*(?:\\r?\\n|$)")

  static func frontmatterRange(in text: String) -> NSRange? {
    let ns = text as NSString
    let match = frontmatterPattern.firstMatch(
      in: text, options: [.anchored], range: NSRange(location: 0, length: ns.length))
    return match?.range
  }
}

/// `swift-markdown` 의 `SourceLocation` → 원문 UTF-16 오프셋.
///
/// **실측 결과**(`swift-markdown` 0.8.0 / `swift-cmark` 0.8.0):
/// - `line`, `column` 모두 **1-기반**이다.
/// - `column` 의 단위는 **UTF-8 바이트**다. `🙂 ` 로 시작하는 문단의 `Text` 가
///   `1:1 – 1:6` 으로 나온다 — 5 = 4(이모지 UTF-8) + 1(공백). UTF-16 이면 1–4,
///   스칼라면 1–3 이었을 것이다.
/// - `upperBound` 는 **배타적**이다 (`"a "` → `1:1 – 1:3`).
/// - 줄바꿈은 `\n`, `\r\n`, **단독 `\r`** 셋 다 한 줄로 센다 — 실측했다.
/// - 탭은 문단 안에서 1 열이지만, 들여쓴 코드블록에서는 cmark 가 탭을 확장해
///   줄 길이를 넘는 열을 줄 수 있다. 그래서 클램프한다.
struct SourceOffsetTable {
  private struct Line {
    let utf16Start: Int
    let bytes: [UInt8]
  }

  private let lines: [Line]
  let utf16Length: Int

  init(_ text: String) {
    let bytes = Array(text.utf8)
    var lines: [Line] = []
    var lineStart = 0
    var utf16 = 0
    var i = 0

    while i < bytes.count {
      let byte = bytes[i]
      guard byte == 0x0A || byte == 0x0D else {
        i += 1
        continue
      }
      let content = Array(bytes[lineStart..<i])
      lines.append(Line(utf16Start: utf16, bytes: content))
      utf16 += Self.utf16Count(content[...])
      if byte == 0x0D, i + 1 < bytes.count, bytes[i + 1] == 0x0A {
        i += 2
        utf16 += 2
      } else {
        i += 1
        utf16 += 1
      }
      lineStart = i
    }
    lines.append(Line(utf16Start: utf16, bytes: Array(bytes[lineStart...])))

    self.lines = lines
    self.utf16Length = text.utf16.count
  }

  func offset(line: Int, column: Int) -> Int {
    guard line >= 1 else { return 0 }
    guard line <= lines.count else { return utf16Length }
    let record = lines[line - 1]
    let byteIndex = min(max(column - 1, 0), record.bytes.count)
    return record.utf16Start + Self.utf16Count(record.bytes[0..<byteIndex])
  }

  func range(_ source: SourceRange) -> NSRange? {
    let lower = offset(line: source.lowerBound.line, column: source.lowerBound.column)
    let upper = min(offset(line: source.upperBound.line, column: source.upperBound.column), utf16Length)
    guard upper > lower else { return nil }
    return NSRange(location: lower, length: upper - lower)
  }

  /// UTF-8 바이트 열이 만드는 UTF-16 코드 유닛 개수.
  /// 이어지는 바이트(`10xxxxxx`)는 0, 4바이트 시퀀스의 선두는 서로게이트 쌍이라 2.
  private static func utf16Count(_ bytes: ArraySlice<UInt8>) -> Int {
    var count = 0
    for byte in bytes where byte & 0xC0 != 0x80 {
      count += byte >= 0xF0 ? 2 : 1
    }
    return count
  }
}
