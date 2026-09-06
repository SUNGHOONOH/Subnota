import Foundation
import Testing

@testable import SubnotaKit

// MARK: - 도우미

/// span 이 원문의 **바로 그 토큰**을 가리키는지 확인하려면 잘라 봐야 한다.
private func slice(_ text: String, _ span: MarkdownSpan) -> String {
  (text as NSString).substring(with: span.range)
}

private func spans(_ text: String) -> [MarkdownSpan] {
  MarkdownAttributes.spans(for: text, now: Date(timeIntervalSince1970: 1_788_000_000))
}

private func slices(_ text: String, _ style: MarkdownStyle) -> [String] {
  spans(text).filter { $0.style == style }.map { slice(text, $0) }
}

// MARK: - 소스 위치 → UTF-16 오프셋

/// 이게 틀리면 모든 스타일이 한 글자씩 밀리는데 눈으로는 알아채기 어렵다.
/// 그래서 변환표만 따로 못박는다.
@Suite("SourceOffsetTable")
struct SourceOffsetTableTests {
  @Test("1-기반 줄/열이 ASCII 에서 그대로 오프셋이 된다")
  func ascii() {
    let table = SourceOffsetTable("abc\ndef\n")
    #expect(table.offset(line: 1, column: 1) == 0)
    #expect(table.offset(line: 1, column: 4) == 3)  // 배타적 끝
    #expect(table.offset(line: 2, column: 1) == 4)
    #expect(table.offset(line: 2, column: 4) == 7)
    #expect(table.offset(line: 3, column: 1) == 8)  // 마지막 개행 뒤의 빈 줄
  }

  @Test("열은 UTF-8 바이트, 오프셋은 UTF-16 코드 유닛이다")
  func multibyte() {
    // 🙂 = UTF-8 4바이트 / UTF-16 2유닛, 가 = 3바이트 / 1유닛.
    let text = "🙂가a"
    let table = SourceOffsetTable(text)
    #expect(table.offset(line: 1, column: 1) == 0)
    #expect(table.offset(line: 1, column: 5) == 2)  // 🙂 뒤
    #expect(table.offset(line: 1, column: 8) == 3)  // 가 뒤
    #expect(table.offset(line: 1, column: 9) == 4)  // a 뒤 = 끝
    #expect(table.utf16Length == 4)
  }

  @Test("CRLF 는 한 줄로 세고 다음 줄 시작이 두 유닛 뒤다")
  func crlf() {
    let table = SourceOffsetTable("ab\r\ncd\r\n")
    #expect(table.offset(line: 2, column: 1) == 4)
    #expect(table.offset(line: 3, column: 1) == 8)
  }

  @Test("단독 CR 도 줄바꿈이다")
  func loneCR() {
    // cmark 가 단독 \r 을 줄바꿈으로 센다 — 실측했다.
    let table = SourceOffsetTable("ab\rcd\r")
    #expect(table.offset(line: 2, column: 1) == 3)
    #expect(table.offset(line: 3, column: 1) == 6)
  }

  @Test("범위를 벗어난 줄·열은 클램프한다")
  func clamps() {
    // 탭을 들여쓴 코드블록에서 cmark 가 줄 길이를 넘는 열을 줄 수 있다.
    let table = SourceOffsetTable("ab\ncd")
    #expect(table.offset(line: 1, column: 99) == 2)
    #expect(table.offset(line: 99, column: 1) == 5)
    #expect(table.offset(line: 0, column: 0) == 0)
  }

  @Test("빈 문자열도 안전하다")
  func empty() {
    let table = SourceOffsetTable("")
    #expect(table.utf16Length == 0)
    #expect(table.offset(line: 1, column: 1) == 0)
  }
}

// MARK: - 계약

@Suite("MarkdownAttributes 계약")
struct MarkdownAttributesContractTests {
  /// 이 모듈은 표시 속성 계산기다. 문자열을 돌려주는 API 가 생기면 왕복 손실이 난다.
  @Test("원문을 바꾸지 않는다")
  func doesNotRewriteTheSource() {
    for text in Corpus.all {
      let before = text
      _ = MarkdownAttributes.spans(for: text)
      #expect(text == before)
    }
  }

  @Test("모든 span 이 원문 길이 안에 있다")
  func spansStayInBounds() {
    for text in Corpus.all {
      let limit = (text as NSString).length
      for span in MarkdownAttributes.spans(for: text) {
        #expect(span.range.location >= 0, "\(text.debugDescription) \(span)")
        #expect(span.range.length > 0, "\(text.debugDescription) \(span)")
        #expect(NSMaxRange(span.range) <= limit, "\(text.debugDescription) \(span)")
      }
    }
  }

  @Test("빈 문서는 span 이 없다")
  func emptyDocument() {
    #expect(MarkdownAttributes.spans(for: "").isEmpty)
  }
}

// MARK: - 스타일별

@Suite("MarkdownAttributes 스타일")
struct MarkdownAttributesStyleTests {
  @Test("헤딩과 그 기호")
  func heading() {
    let text = "## 제목\n"
    #expect(slices(text, .heading(level: 2)) == ["## 제목"])
    #expect(slices(text, .syntaxMarker) == ["## "])
  }

  @Test("굵게·기울임·취소선의 범위가 기호를 포함한다")
  func inlineEmphasis() {
    #expect(slices("a **bd** c", .bold) == ["**bd**"])
    #expect(slices("a *i* c", .italic) == ["*i*"])
    #expect(slices("a ~~s~~ c", .strikethrough) == ["~~s~~"])
    #expect(slices("a **bd** c", .syntaxMarker) == ["**", "**"])
  }

  @Test("인라인 코드는 백틱까지 한 덩어리다")
  func inlineCode() {
    #expect(slices("a `x` b", .inlineCode) == ["`x`"])
  }

  @Test("링크는 목적지를 들고 기호를 따로 낸다")
  func link() {
    let text = "see [x](https://e.com) end"
    #expect(slices(text, .link(destination: "https://e.com")) == ["[x](https://e.com)"])
    #expect(slices(text, .syntaxMarker) == ["[", "](https://e.com)"])
  }

  @Test("인용문 깊이는 1 부터 중첩마다 늘어난다")
  func blockQuote() {
    let text = "> q1\n>> q2\n"
    #expect(slices(text, .blockQuote(depth: 1)).count == 1)
    // 바깥 인용문이 첫 `>` 를 먹으므로 안쪽 범위는 `> q2` 다.
    #expect(slices(text, .blockQuote(depth: 2)) == ["> q2"])
  }

  @Test("불릿·번호 리스트와 중첩 깊이")
  func lists() {
    let unordered = "- a\n  - b\n"
    #expect(slices(unordered, .listItem(ordered: false, depth: 1)).count == 1)
    #expect(slices(unordered, .listItem(ordered: false, depth: 2)) == ["- b"])

    let ordered = "1. one\n2. two\n"
    #expect(slices(ordered, .listItem(ordered: true, depth: 1)).count == 2)
    #expect(slices(ordered, .syntaxMarker) == ["1. ", "2. "])
  }

  @Test("체크박스는 기호 범위를 가리키고 지워지지 않는다")
  func checkbox() {
    let text = "- [ ] todo\n- [x] done\n"
    #expect(slices(text, .checkbox(checked: false)) == ["- [ ] "])
    #expect(slices(text, .checkbox(checked: true)) == ["- [x] "])
  }

  @Test("수평선")
  func thematicBreak() {
    #expect(slices("a\n\n---\n\nb\n", .thematicBreak).count == 1)
  }

  @Test("코드블록은 울타리까지 한 덩어리다")
  func codeBlock() {
    let text = "```swift\nlet x = 1\n```\n"
    // 닫는 울타리까지. 마지막 개행은 블록 밖이다.
    #expect(slices(text, .codeBlock) == ["```swift\nlet x = 1\n```"])
  }

  @Test("==하이라이트== 와 <mark> 둘 다")
  func highlight() {
    #expect(slices("a ==hi== b", .highlight) == ["==hi=="])
    #expect(slices("a ==hi== b", .syntaxMarker) == ["==", "=="])

    let mark = "a <mark data-color=\"#ff0\">hi</mark> b"
    #expect(slices(mark, .highlight) == ["<mark data-color=\"#ff0\">hi</mark>"])
    #expect(slices(mark, .syntaxMarker) == ["<mark data-color=\"#ff0\">", "</mark>"])
  }

  @Test("== 하나짜리·빈 것은 매치하지 않는다")
  func highlightNonMatches() {
    #expect(slices("a = b == c", .highlight).isEmpty)
    #expect(slices("====", .highlight).isEmpty)
  }

  @Test("날짜가 강조되고 오탐 후보는 강조되지 않는다")
  func dateHighlight() {
    #expect(slices("내일 3시 회의", .dateHighlight) == ["내일 3시"])
    #expect(slices("보낼게 끝낼게", .dateHighlight).isEmpty)
  }
}

// MARK: - 회귀

@Suite("MarkdownAttributes 회귀")
struct MarkdownAttributesRegressionTests {
  /// 열이 UTF-8 바이트라 UTF-16 으로 옮기지 않으면 여기서 밀린다.
  @Test("이모지·한글이 섞여도 범위가 정확히 그 토큰이다")
  func multibyteTokens() {
    let text = "🙂 가나 **굵게🙂** 다라 ==강조가== 끝"
    #expect(slices(text, .bold) == ["**굵게🙂**"])
    #expect(slices(text, .highlight) == ["==강조가=="])

    let heading = "# 🙂제목\n\n본문 `코드🙂` 끝\n"
    #expect(slices(heading, .heading(level: 1)) == ["# 🙂제목"])
    #expect(slices(heading, .inlineCode) == ["`코드🙂`"])
  }

  @Test("CRLF 원문에서도 범위가 밀리지 않는다")
  func crlfSource() {
    let text = "# 🙂제목\r\n\r\n- [x] 가나 **굵게**\r\n"
    #expect(slices(text, .heading(level: 1)) == ["# 🙂제목"])
    #expect(slices(text, .bold) == ["**굵게**"])
    #expect(slices(text, .checkbox(checked: true)) == ["- [x] "])
  }

  /// 정규식을 통째로 돌리면 여기서 틀린다.
  @Test("코드블록 안의 # 제목·==강조==·날짜는 렌더링되지 않는다")
  func codeFenceIsInert() {
    let text = """
      ```
      # not a heading
      ==nope==
      내일 3시
      ```
      """
    let all = spans(text)
    #expect(all.contains { $0.style == .codeBlock })
    #expect(!all.contains { $0.style == .highlight })
    #expect(!all.contains { $0.style == .dateHighlight })
    #expect(!all.contains { if case .heading = $0.style { return true } else { return false } })
  }

  @Test("인라인 코드 안의 ==강조== 도 렌더링되지 않는다")
  func inlineCodeIsInert() {
    let text = "a `==nope==` b ==yes=="
    #expect(slices(text, .highlight) == ["==yes=="])
  }

  @Test("들여쓴 코드블록 안도 마찬가지다")
  func indentedCodeIsInert() {
    let text = "본문\n\n    ==nope==\n"
    #expect(slices(text, .highlight).isEmpty)
  }

  @Test("맨 앞 --- 는 thematicBreak 이 아니라 frontmatter 다")
  func frontmatter() {
    let text = "---\ntitle: x\ntags: [a]\n---\n\n# 제목\n"
    let all = spans(text)
    #expect(slices(text, .frontmatter) == ["---\ntitle: x\ntags: [a]\n---\n"])
    #expect(!all.contains { $0.style == .thematicBreak })
    // frontmatter 안쪽을 setext heading 으로 읽던 span 은 버려야 한다.
    #expect(slices(text, .heading(level: 1)) == ["# 제목"])
  }

  @Test("중간에 나오는 --- 는 여전히 thematicBreak 이다")
  func midDocumentRuleStaysABreak() {
    let text = "본문\n\n---\n\n뒤\n"
    #expect(spans(text).contains { $0.style == .thematicBreak })
    #expect(slices(text, .frontmatter).isEmpty)
  }

  @Test("frontmatter 안의 ==강조== 는 렌더링되지 않는다")
  func frontmatterIsInert() {
    let text = "---\nname: ==nope==\n---\n\n==yes==\n"
    #expect(slices(text, .highlight) == ["==yes=="])
  }

  @Test("표·이미지는 원문 그대로 둔다 — 범위를 늘리지 않는다")
  func outOfScopeSyntaxIsUntouched() {
    let table = "| a | b |\n| - | - |\n| 1 | 2 |\n"
    #expect(spans(table).isEmpty)
    #expect(spans("![alt](https://e.com/a.png)").isEmpty)
  }
}

// MARK: - 코퍼스

private enum Corpus {
  static let all: [String] = [
    "",
    "\n",
    "\r\n\r\n",
    "plain text without any markup",
    "# H1\n## H2\n### H3\n",
    "**b** *i* ~~s~~ `c` [l](https://e.com)\n",
    "> q\n>> qq\n>>> qqq\n",
    "- a\n- b\n  - c\n1. one\n2. two\n",
    "- [ ] todo\n- [x] done\n",
    "---\n",
    "---\ntitle: x\n---\n\n본문\n",
    "```\n# nope\n==nope==\n```\n",
    "    indented code\n",
    "🙂가나다 **굵게🙂** ==강조🙂== `코드🙂`\n",
    "# 🙂\r\n\r\n- [x] 🙂 **가**\r\n",
    "a\rb\r\rc **d**\r",
    "\t\tdeep tab\n",
    "<div>\n# nope\n</div>\n",
    "a <mark data-color=\"#ff0\">hi</mark> b\n",
    "내일 3시에 회의, 다음 주 월요일까지 보낼게\n",
    "==",
    "====",
    "**",
    "[",
    "```",
    "---\n---\n",
    String(repeating: "가나다 **굵게** ==강조== 🙂\n", count: 50),
  ]
}
