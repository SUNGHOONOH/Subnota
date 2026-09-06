import SubnotaKit
import SwiftUI
import UIKit

/// 툴바가 붙잡는 편집 중인 텍스트 뷰.
///
/// 툴바는 selection 을 알아야 하는데 그건 `UITextView` 안에만 있다. 바인딩으로 복제하면
/// 두 벌이 어긋난다 — 그래서 뷰를 그대로 들고 있고, 원문 계산은 `MarkdownEditing` 이 한다.
@MainActor final class EditorHandle {
  weak var textView: UITextView?

  var isEditing: Bool { textView?.isFirstResponder ?? false }

  func apply(_ action: MarkdownEditAction) {
    guard let view = textView else { return }
    let result = MarkdownEditing.toggle(
      action, in: view.text ?? "", selection: view.selectedRange)

    // `textStorage` 를 직접 고치지 않고 UITextInput 을 거친다 — 실행 취소가 등록된다.
    guard
      let whole = view.textRange(from: view.beginningOfDocument, to: view.endOfDocument)
    else { return }
    view.replace(whole, withText: result.text)
    view.selectedRange = result.selection

    // 자동저장은 이 델리게이트 호출에 달려 있다. 바인딩을 갱신하고 다시 파싱한다.
    view.delegate?.textViewDidChange?(view)
  }
}

/// 키보드 위 서식 툴바. 아이콘만 두고 이름은 VoiceOver 로 준다.
struct FormattingToolbar: View {
  let apply: (MarkdownEditAction) -> Void

  /// `inputAccessoryView` 는 높이를 스스로 못 정한다 — 여기서 못박는다.
  static let height: CGFloat = 44

  private static let buttons: [(action: MarkdownEditAction, icon: String, name: String)] = [
    (.bold, "bold", "굵게"),
    (.italic, "italic", "기울임"),
    (.strikethrough, "strikethrough", "취소선"),
    (.inlineCode, "chevron.left.forwardslash.chevron.right", "인라인 코드"),
    (.heading, "textformat.size", "제목"),
    (.checkbox, "checklist", "체크박스"),
    (.bulletList, "list.bullet", "글머리 기호"),
    (.numberedList, "list.number", "번호 매기기"),
    (.quote, "text.quote", "인용"),
    (.link, "link", "링크"),
  ]

  var body: some View {
    // 버튼 열 개는 좁은 화면을 넘친다. 잘라 내는 대신 가로로 민다.
    ScrollView(.horizontal, showsIndicators: false) {
      HStack(spacing: 2) {
        ForEach(Self.buttons, id: \.action) { button in
          Button {
            apply(button.action)
          } label: {
            Image(systemName: button.icon)
              .font(.system(size: 16, weight: .medium))
              .frame(width: 42, height: Self.height)
              .contentShape(.rect)
          }
          .accessibilityLabel(button.name)
        }
      }
      .padding(.horizontal, 8)
    }
    .frame(height: Self.height)
    // 색은 전부 토큰이다 — 하드코딩하면 다크에서 안 보인다.
    .foregroundStyle(Palette.ink)
    .background(Palette.chrome)
    .overlay(alignment: .top) { Palette.border.frame(height: 0.5) }
  }
}
