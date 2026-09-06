import SwiftUI
import UIKit

/// 원문 마크다운을 **그대로 두고** 표시 속성만 입히는 에디터.
///
/// `textView.text` 는 언제나 사용자가 친 원문이다. 파싱 결과로 문자열을 다시 만들지
/// 않는다 — 그 순간 파서가 모르는 문법에서 왕복 손실이 난다. `**`, `#` 같은 기호도
/// 지우지 않고 흐리게만 한다. 지우면 표시 길이가 원문과 어긋나 커서가 깨진다.
struct MarkdownTextView: UIViewRepresentable {
  @Binding var text: String
  /// 키보드 위 툴바가 이 뷰를 붙잡는 손잡이.
  let handle: EditorHandle
  @Environment(\.colorScheme) private var colorScheme

  func makeCoordinator() -> MarkdownEditorCoordinator {
    MarkdownEditorCoordinator(text: $text)
  }

  func makeUIView(context: Context) -> UITextView {
    // TextKit 2 (iOS 16+). TextKit 1 로 떨어지면 긴 문서에서 레이아웃이 느려진다.
    let view = UITextView(usingTextLayoutManager: true)
    view.delegate = context.coordinator
    view.backgroundColor = .clear
    view.textContainerInset = UIEdgeInsets(top: 12, left: 0, bottom: 32, right: 0)
    view.textContainer.lineFragmentPadding = 0
    view.alwaysBounceVertical = true
    view.keyboardDismissMode = .interactive
    // OS 가 마크다운 기호를 고쳐 쓰면 원문이 조용히 바뀐다: `--` → em dash, `"` → 곡선 따옴표.
    view.smartQuotesType = .no
    view.smartDashesType = .no
    view.smartInsertDeleteType = .no
    view.text = text  // 원문 그대로. 렌더링 결과를 넣지 않는다.
    handle.textView = view
    // 서식 툴바는 SwiftUI `.toolbar(placement: .keyboard)` 로는 뜨지 않았다 —
    // 첫 응답자가 UIKit 텍스트 뷰라 SwiftUI 가 키보드 세션을 잡지 못한다.
    // 텍스트 뷰가 직접 들고 있는 `inputAccessoryView` 는 하드웨어 키보드에서도 뜬다.
    view.inputAccessoryView = context.coordinator.toolbar(handle)
    context.coordinator.restyle(view)
    return view
  }

  func updateUIView(_ view: UITextView, context: Context) {
    context.coordinator.text = $text
    if view.text != text {
      // 바깥에서 바뀐 경우에만 다시 넣는다. 타이핑마다 넣으면 IME 조합과 커서가 깨진다.
      let caret = view.selectedRange
      view.text = text
      let limit = (text as NSString).length
      view.selectedRange = NSRange(location: min(caret.location, limit), length: 0)
      context.coordinator.restyle(view)
    } else if context.coordinator.styledScheme != colorScheme {
      // Palette 색을 그릴 때 해석하므로 테마가 바뀌면 다시 입혀야 한다.
      context.coordinator.restyle(view)
    }
    context.coordinator.styledScheme = colorScheme
  }
}
