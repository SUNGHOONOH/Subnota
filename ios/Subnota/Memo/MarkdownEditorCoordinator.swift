import SubnotaKit
import SwiftUI
import UIKit

/// 편집 → 재파싱 → 속성 재적용. 문자는 절대 건드리지 않는다.
final class MarkdownEditorCoordinator: NSObject, UITextViewDelegate {
  var text: Binding<String>
  /// 마지막으로 색을 입힌 테마. 다크로 바뀌면 다시 입혀야 한다.
  var styledScheme: ColorScheme?
  /// 툴바를 그리는 호스팅 컨트롤러. 여기서 안 잡으면 바로 해제돼 SwiftUI 가 갱신을 멈춘다.
  private var toolbarHost: UIHostingController<FormattingToolbar>?

  init(text: Binding<String>) {
    self.text = text
  }

  /// 키보드 위 서식 툴바.
  func toolbar(_ handle: EditorHandle) -> UIView {
    if let existing = toolbarHost?.view { return existing }
    let host = UIHostingController(rootView: FormattingToolbar { [weak handle] in
      handle?.apply($0)
    })
    host.sizingOptions = [.intrinsicContentSize]
    host.view.backgroundColor = .clear
    host.view.frame = CGRect(x: 0, y: 0, width: 0, height: FormattingToolbar.height)
    toolbarHost = host
    return host.view
  }

  func textViewDidChange(_ textView: UITextView) {
    // 자동저장이 이 한 줄에 달려 있다. 여기서 바인딩을 갱신하지 않으면
    // MemoEditorView 의 1초 디바운스가 영영 돌지 않는다 (커밋 80ae0a8).
    text.wrappedValue = textView.text
    // 한글 조합 중에는 속성을 다시 입히지 않는다 — 조합 중인 글자가 깨진다.
    guard textView.markedTextRange == nil else { return }
    // ponytail: 전체 재파싱. 큰 문서에서 렉이 측정되면 편집된 문단만 다시 계산할 것.
    restyle(textView)
  }

  func restyle(_ textView: UITextView) {
    let source = textView.text ?? ""
    let spans = MarkdownAttributes.spans(for: source)
    let storage = textView.textStorage
    // 속성 재적용이 선택을 건드리면 타이핑할 때마다 커서가 맨 앞으로 튄다.
    let selection = textView.selectedRange

    storage.beginEditing()
    MarkdownStyling(traits: textView.traitCollection).apply(spans, to: storage)
    storage.endEditing()

    if textView.selectedRange != selection {
      textView.selectedRange = selection
    }
  }
}

/// `MarkdownSpan` → `NSTextStorage` 속성. 문자열 길이를 바꾸는 속성은 쓰지 않는다.
///
/// 색은 전부 `Palette` 토큰이다. 하드코딩하면 다크에서 안 보인다. 그릴 때가 아니라
/// 여기서 현재 트레잇으로 해석해 두고, 테마가 바뀌면 통째로 다시 입힌다.
struct MarkdownStyling {
  let traits: UITraitCollection

  private static let bodySize: CGFloat = 16
  /// line-height 1.6 — SwiftUI `TextEditor` 시절과 같은 값이다.
  private static let lineSpacing: CGFloat = bodySize * 0.6
  private static let listIndent: CGFloat = 18

  func apply(_ spans: [MarkdownSpan], to storage: NSTextStorage) {
    storage.setAttributes(base, range: NSRange(location: 0, length: storage.length))
    // spans 는 앞에서 뒤로, 같은 위치면 바깥부터 정렬돼 있다. 그래서 안쪽 스타일과
    // 기호(syntaxMarker)가 바깥 스타일을 덮어쓴다.
    for span in spans {
      apply(span, to: storage)
    }
  }

  private var base: [NSAttributedString.Key: Any] {
    let paragraph = NSMutableParagraphStyle()
    paragraph.lineSpacing = Self.lineSpacing
    return [
      .font: EditorFont.body(Self.bodySize),
      .foregroundColor: color(Palette.ink),
      .paragraphStyle: paragraph,
    ]
  }

  private func apply(_ span: MarkdownSpan, to storage: NSTextStorage) {
    let range = span.range

    switch span.style {
    case .heading(let level):
      mapFont(storage, range) { _ in EditorFont.semibold(Self.headingSize(level)) }

    case .bold:
      mapFont(storage, range) { EditorFont.semibold($0.pointSize) }

    case .italic:
      // Pretendard 에 이탤릭 페이스가 없다. 다른 얼굴을 섞는 대신 기울인다.
      storage.addAttribute(.obliqueness, value: 0.2, range: range)

    case .strikethrough:
      storage.addAttribute(
        .strikethroughStyle, value: NSUnderlineStyle.single.rawValue, range: range)

    case .inlineCode:
      mapFont(storage, range) { EditorFont.mono($0.pointSize) }
      storage.addAttribute(.backgroundColor, value: color(Palette.chrome), range: range)

    case .codeBlock:
      // ponytail: 글자 뒤 배경. 문단 전체 폭을 칠하려면 커스텀 레이아웃 프래그먼트가
      // 필요하다 — 스펙의 "표시 전용"에는 고정폭+배경으로 충분하다.
      mapFont(storage, range) { EditorFont.mono($0.pointSize) }
      storage.addAttribute(.backgroundColor, value: color(Palette.chrome), range: range)

    case .link:
      storage.addAttribute(.foregroundColor, value: color(Palette.brand), range: range)
      storage.addAttribute(.underlineStyle, value: NSUnderlineStyle.single.rawValue, range: range)

    case .blockQuote(let depth):
      storage.addAttribute(.foregroundColor, value: color(Palette.inkMuted), range: range)
      mapParagraph(storage, range) {
        $0.firstLineHeadIndent = Self.listIndent * CGFloat(depth)
        $0.headIndent = Self.listIndent * CGFloat(depth)
      }

    case .listItem(_, let depth):
      // ponytail: 들여쓰기만. `NSTextList` 는 마커를 스스로 그리지 않아 여기서 얻을
      // 게 없고, 원문의 `- ` 와 겹칠 위험만 있다.
      mapParagraph(storage, range) {
        $0.firstLineHeadIndent = Self.listIndent * CGFloat(depth - 1)
        $0.headIndent = Self.listIndent * CGFloat(depth)
      }

    case .checkbox(let checked):
      // 기호 범위와 같다 — syntaxMarker 뒤에 와서 흐린 색을 덮는다.
      storage.addAttribute(
        .foregroundColor, value: color(checked ? Palette.success : Palette.brand), range: range)

    case .thematicBreak:
      storage.addAttribute(.foregroundColor, value: color(Palette.inkMuted), range: range)

    case .highlight:
      storage.addAttribute(.backgroundColor, value: color(Palette.textHighlight), range: range)

    case .dateHighlight:
      storage.addAttribute(.backgroundColor, value: color(Palette.dateHighlight), range: range)
      mapFont(storage, range) { EditorFont.semibold($0.pointSize) }

    case .frontmatter:
      mapFont(storage, range) { EditorFont.mono($0.pointSize) }
      storage.addAttribute(.foregroundColor, value: color(Palette.inkMuted), range: range)

    case .syntaxMarker:
      // 지우지 않고 흐리게만. 지우면 원문과 표시 길이가 어긋나 커서가 깨진다.
      storage.addAttribute(.foregroundColor, value: color(Palette.inkMuted), range: range)
    }
  }

  // MARK: - 도우미

  private func color(_ token: Color) -> UIColor {
    UIColor(token).resolvedColor(with: traits)
  }

  /// 이미 깔린 폰트를 바탕으로 바꾼다 — 헤딩 안의 굵게가 본문 크기로 줄어들지 않게.
  private func mapFont(
    _ storage: NSTextStorage, _ range: NSRange, _ transform: (UIFont) -> UIFont
  ) {
    storage.enumerateAttribute(.font, in: range) { value, sub, _ in
      let current = value as? UIFont ?? EditorFont.body(Self.bodySize)
      storage.addAttribute(.font, value: transform(current), range: sub)
    }
  }

  private func mapParagraph(
    _ storage: NSTextStorage, _ range: NSRange, _ edit: (NSMutableParagraphStyle) -> Void
  ) {
    storage.enumerateAttribute(.paragraphStyle, in: range) { value, sub, _ in
      let style =
        (value as? NSParagraphStyle)?.mutableCopy() as? NSMutableParagraphStyle
        ?? NSMutableParagraphStyle()
      edit(style)
      storage.addAttribute(.paragraphStyle, value: style, range: sub)
    }
  }

  private static func headingSize(_ level: Int) -> CGFloat {
    switch level {
    case 1: 26
    case 2: 22
    case 3: 19
    case 4: 17
    default: bodySize
    }
  }
}

/// 에디터가 쓰는 얼굴. `Typography` 는 SwiftUI `Font` 를 주는데 `NSAttributedString`
/// 에는 `UIFont` 가 필요하다. 이름은 같은 파일을 가리킨다.
enum EditorFont {
  static func body(_ size: CGFloat) -> UIFont {
    UIFont(name: "Pretendard-Regular", size: size) ?? .systemFont(ofSize: size)
  }

  static func semibold(_ size: CGFloat) -> UIFont {
    UIFont(name: "Pretendard-SemiBold", size: size) ?? .systemFont(ofSize: size, weight: .semibold)
  }

  static func mono(_ size: CGFloat) -> UIFont {
    .monospacedSystemFont(ofSize: size, weight: .regular)
  }
}
