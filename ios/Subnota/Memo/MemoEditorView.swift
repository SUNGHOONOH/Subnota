import SwiftUI
import SubnotaKit

struct MemoEditorView: View {
  @Environment(\.scenePhase) private var scenePhase
  @State private var text: String
  @State private var lastSavedContent: String
  private let memo: Memo
  private let onSave: (Memo) -> Void

  init(memo: Memo, onSave: @escaping (Memo) -> Void) {
    self.memo = memo
    self.onSave = onSave
    _text = State(initialValue: memo.content)
    _lastSavedContent = State(initialValue: memo.content)
  }

  var body: some View {
    TextEditor(text: $text)
      .font(Typography.editor())
      .lineSpacing(16 * 0.6)          // line-height 1.6
      .foregroundStyle(Palette.ink)
      .scrollContentBackground(.hidden)
      .background(Palette.canvas)
      .padding(.horizontal, 16)
      .navigationBarTitleDisplayMode(.inline)
      // iOS 는 앱을 임의로 종료한다. 화면을 떠날 때와 백그라운드로 갈 때 반드시 쓴다.
      .onDisappear { flush() }
      .onChange(of: scenePhase) { _, phase in
        if phase != .active { flush() }
      }
  }

  private func flush() {
    guard text != lastSavedContent else { return }
    var updated = memo
    updated.content = text
    lastSavedContent = text
    onSave(updated)
  }
}
