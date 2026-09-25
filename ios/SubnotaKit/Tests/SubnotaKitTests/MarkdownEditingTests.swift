import Foundation
import Testing

@testable import SubnotaKit

// MARK: - 도우미

private func toggle(
  _ action: MarkdownEditAction, _ text: String, _ selection: NSRange
) -> (text: String, selection: NSRange) {
  MarkdownEditing.toggle(action, in: text, selection: selection)
}

/// 적용 → 해제 → 원문·selection 이 **정확히** 돌아오는지. 이게 이 파일의 본론이다.
///
/// `presses` 가 2 가 아닌 건 헤딩뿐이다(4단 순환).
private func expectRoundTrip(
  _ action: MarkdownEditAction,
  _ text: String,
  _ selection: NSRange,
  presses: Int = 2,
  _ comment: Comment? = nil,
  sourceLocation: SourceLocation = #_sourceLocation
) {
  var state = (text: text, selection: selection)
  for _ in 0..<presses {
    state = toggle(action, state.text, state.selection)
  }
  #expect(state.text == text, comment ?? "원문이 돌아오지 않았다", sourceLocation: sourceLocation)
  #expect(
    state.selection == selection, comment ?? "selection 이 돌아오지 않았다",
    sourceLocation: sourceLocation)
}

/// 모든 액션이 세 가지 선택 모양에서 왕복해야 한다.
private let selectionShapes: [(name: String, text: String, range: NSRange)] = [
  ("빈 선택", "안녕 세상\n둘째 줄", NSRange(location: 2, length: 0)),
  ("단어 선택", "안녕 세상\n둘째 줄", NSRange(location: 3, length: 2)),
  ("여러 줄 선택", "안녕 세상\n둘째 줄", NSRange(location: 1, length: 7)),
  // 들여쓴 줄은 기호를 들여쓰기 **뒤**에 넣는다.
  ("들여쓴 줄", "하나\n  둘\n  셋", NSRange(location: 5, length: 5)),
]

// MARK: - 왕복

@Suite("MarkdownEditing 토글 왕복")
struct MarkdownEditingRoundTripTests {
  @Test("모든 액션이 빈 선택·단어 선택·여러 줄 선택에서 원문으로 돌아온다")
  func everyAction() {
    for action in MarkdownEditAction.allCases {
      // 헤딩은 4단 순환이라 네 번 눌러야 제자리다.
      let presses = action == .heading ? 4 : 2
      for shape in selectionShapes {
        expectRoundTrip(
          action, shape.text, shape.range, presses: presses,
          "\(action.rawValue) / \(shape.name)")
      }
    }
  }

  @Test("이모지가 든 줄에서도 UTF-16 오프셋이 어긋나지 않는다")
  func emoji() {
    // 🙂 는 UTF-16 두 칸이다. 위치를 세는 코드가 Character 를 쓰면 여기서 깨진다.
    let text = "🙂 커피 ☕️ 한 잔\n둘째 🙂 줄"
    let shapes = [
      NSRange(location: 3, length: 0),
      NSRange(location: 3, length: 2),
      NSRange(location: 0, length: (text as NSString).length),
    ]
    for action in MarkdownEditAction.allCases {
      let presses = action == .heading ? 4 : 2
      for shape in shapes {
        expectRoundTrip(action, text, shape, presses: presses, "\(action.rawValue)")
      }
    }
  }

  @Test("빈 문서에서도 왕복한다")
  func empty() {
    for action in MarkdownEditAction.allCases {
      expectRoundTrip(
        action, "", NSRange(location: 0, length: 0),
        presses: action == .heading ? 4 : 2, "\(action.rawValue)")
    }
  }
}

// MARK: - 감싸는 기호

@Suite("MarkdownEditing 인라인 서식")
struct MarkdownEditingInlineTests {
  @Test("선택을 감싸고 선택은 안쪽 글자에 남는다")
  func wrapsSelection() {
    let result = toggle(.bold, "hello world", NSRange(location: 6, length: 5))
    #expect(result.text == "hello **world**")
    #expect(result.selection == NSRange(location: 8, length: 5))
  }

  @Test("선택이 없으면 기호 사이에 커서를 둔다")
  func caretBetweenMarkers() {
    let result = toggle(.bold, "hello ", NSRange(location: 6, length: 0))
    #expect(result.text == "hello ****")
    #expect(result.selection == NSRange(location: 8, length: 0))
  }

  @Test("두 번 누르면 `****` 가 남지 않는다")
  func noOrphanMarkers() {
    let once = toggle(.bold, "hello ", NSRange(location: 6, length: 0))
    let twice = toggle(.bold, once.text, once.selection)
    #expect(twice.text == "hello ")
    #expect(twice.selection == NSRange(location: 6, length: 0))
  }

  @Test("기호까지 통째로 선택해도 벗긴다")
  func unwrapsFullSelection() {
    let result = toggle(.bold, "a **bold** b", NSRange(location: 2, length: 8))
    #expect(result.text == "a bold b")
    #expect(result.selection == NSRange(location: 2, length: 4))
  }

  @Test("기울임 토글이 굵게를 반으로 쪼개지 않는다")
  func italicKeepsBold() {
    // 커서가 `**|**` 사이에 있어도 `*` 하나만 떼어 내면 안 된다.
    let result = toggle(.italic, "a ****", NSRange(location: 4, length: 0))
    #expect(result.text == "a ******")
  }

  @Test("취소선·인라인 코드도 같은 규칙을 쓴다")
  func otherMarkers() {
    #expect(toggle(.strikethrough, "abc", NSRange(location: 0, length: 3)).text == "~~abc~~")
    #expect(toggle(.inlineCode, "abc", NSRange(location: 0, length: 3)).text == "`abc`")
  }
}

// MARK: - 링크

@Suite("MarkdownEditing 링크")
struct MarkdownEditingLinkTests {
  @Test("선택을 라벨로 감싸고 커서를 URL 자리에 둔다")
  func wrapsLabel() {
    let result = toggle(.link, "see docs", NSRange(location: 4, length: 4))
    #expect(result.text == "see [docs]()")
    #expect(result.selection == NSRange(location: 11, length: 0))
  }

  @Test("URL 을 채운 링크도 다시 누르면 라벨만 남는다")
  func unwrapsFilledLink() {
    let text = "see [docs](https://x.dev) now"
    let result = toggle(.link, text, NSRange(location: 12, length: 0))
    #expect(result.text == "see docs now")
    #expect(result.selection == NSRange(location: 4, length: 4))
  }

  @Test("선택이 없으면 라벨 자리에 커서를 둔다")
  func caretInLabel() {
    let result = toggle(.link, "see ", NSRange(location: 4, length: 0))
    #expect(result.text == "see []()")
    #expect(result.selection == NSRange(location: 5, length: 0))
  }
}

// MARK: - 줄 앞 기호

@Suite("MarkdownEditing 줄 단위 서식")
struct MarkdownEditingLineTests {
  @Test("헤딩은 없음 → # → ## → ### → 없음 으로 순환한다")
  func headingCycle() {
    var state = (text: "제목", selection: NSRange(location: 2, length: 0))
    let expected = ["# 제목", "## 제목", "### 제목", "제목"]
    for want in expected {
      state = toggle(.heading, state.text, state.selection)
      #expect(state.text == want)
    }
    #expect(state.selection == NSRange(location: 2, length: 0))
  }

  @Test("커서가 줄 안에 있으면 기호 길이만큼 같이 밀린다")
  func caretShifts() {
    let result = toggle(.quote, "abc", NSRange(location: 2, length: 0))
    #expect(result.text == "> abc")
    #expect(result.selection == NSRange(location: 4, length: 0))
  }

  @Test("여러 줄 선택은 줄마다 붙고, 번호는 1 부터 센다")
  func numbersEachLine() {
    let result = toggle(.numberedList, "one\ntwo\nthree", NSRange(location: 0, length: 13))
    #expect(result.text == "1. one\n2. two\n3. three")
    #expect(result.selection == NSRange(location: 0, length: 22))
  }

  @Test("한 줄이라도 기호가 없으면 전부 붙인다 — 이미 있는 줄은 그대로 둔다")
  func mixedLinesGetPrefixed() {
    let result = toggle(.bulletList, "- one\ntwo", NSRange(location: 0, length: 9))
    #expect(result.text == "- one\n- two")
  }

  @Test("다른 줄 기호는 갈아 끼운다 — 글머리 줄에 번호를 매기면 번호가 된다")
  func replacesOtherPrefix() {
    let result = toggle(.numberedList, "- one\n- two", NSRange(location: 0, length: 11))
    #expect(result.text == "1. one\n2. two")
  }

  /// ICU 의 `\d` 는 Nd 범주 전체라 전각 숫자(`１`)도 먹는다. CommonMark 의 번호 목록은
  /// ASCII 0-9 뿐이므로 `１. ` 은 목록이 아니다 — 토글하면 떼는 게 아니라 붙여야 한다.
  /// 한글·일본어 IME 가 전각 숫자를 만들 수 있어 실제로 닿는 경로다.
  @Test("전각 숫자는 번호 목록이 아니다")
  func fullwidthDigitIsNotAList() {
    let text = "１. 항목"
    let result = toggle(.numberedList, text, NSRange(location: 0, length: (text as NSString).length))
    #expect(result.text == "1. １. 항목")
  }

  @Test("체크박스는 `- [x]` 도 알아보고 뗀다")
  func checkedBoxIsRemoved() {
    let result = toggle(.checkbox, "- [x] done", NSRange(location: 8, length: 0))
    #expect(result.text == "done")
    #expect(result.selection == NSRange(location: 2, length: 0))
  }

  @Test("글머리 토글이 체크박스를 반쪽 내지 않고 통째로 갈아 끼운다")
  func bulletReplacesCheckbox() {
    let result = toggle(.bulletList, "- [ ] task", NSRange(location: 6, length: 0))
    #expect(result.text == "- task")
    #expect(result.selection == NSRange(location: 2, length: 0))
  }

  @Test("들여쓴 줄은 기호가 들여쓰기 뒤에 붙는다")
  func prefixGoesAfterIndent() {
    let result = toggle(.checkbox, "  - 중첩", NSRange(location: 6, length: 0))
    #expect(result.text == "  - [ ] 중첩")
    #expect(result.selection == NSRange(location: 10, length: 0))
  }

  @Test("인용은 리스트와 겹칠 수 있어 리스트 기호를 지우지 않는다")
  func quoteKeepsList() {
    let result = toggle(.quote, "- one", NSRange(location: 5, length: 0))
    #expect(result.text == "> - one")
  }

  @Test("줄 시작에서 끝나는 선택은 다음 줄을 물지 않는다")
  func stopsAtLineBoundary() {
    let result = toggle(.quote, "one\ntwo", NSRange(location: 0, length: 4))
    #expect(result.text == "> one\ntwo")
  }

  @Test("지워진 기호 안에 있던 커서는 줄 시작으로 당겨진다")
  func caretInsideRemovedMarker() {
    let result = toggle(.quote, "> abc", NSRange(location: 1, length: 0))
    #expect(result.text == "abc")
    #expect(result.selection == NSRange(location: 0, length: 0))
  }
}
