import SwiftUI
import SubnotaKit

struct MemoEditorView: View {
  @Environment(\.scenePhase) private var scenePhase
  @State private var text: String
  @State private var lastSavedContent: String
  @State private var autosave: Task<Void, Never>?
  private let memo: Memo
  private let onSave: (Memo) -> Void

  /// 타이핑이 멎고 이만큼 지나면 저장한다. 데스크탑보다 짧게 잡는 이유는
  /// iOS 가 앱을 백그라운드 전환 없이 죽일 수 있어서다.
  private static let autosaveDelay = Duration.seconds(1)

  init(memo: Memo, onSave: @escaping (Memo) -> Void) {
    self.memo = memo
    self.onSave = onSave
    _text = State(initialValue: memo.content)
    _lastSavedContent = State(initialValue: memo.content)
  }

  var body: some View {
    // 폰트·줄간격·색은 원문에 입히는 속성이라 MarkdownStyling 이 갖는다.
    MarkdownTextView(text: $text)
      .background(Palette.canvas)
      .padding(.horizontal, 16)
      .navigationBarTitleDisplayMode(.inline)
      // 타이핑 중에도 주기적으로 쓴다. 아래 두 flush 만으로는 앱이 백그라운드를
      // 거치지 않고 죽을 때(크래시·강제 종료) 연 뒤 친 내용이 통째로 사라진다.
      .onChange(of: text) { _, _ in scheduleAutosave() }
      // 화면을 떠날 때와 백그라운드로 갈 때는 기다리지 않고 바로 쓴다.
      .onDisappear {
        autosave?.cancel()
        flush()
      }
      .onChange(of: scenePhase) { _, phase in
        guard phase != .active else { return }
        autosave?.cancel()
        flush()
      }
  }

  private func scheduleAutosave() {
    autosave?.cancel()
    autosave = Task {
      try? await Task.sleep(for: Self.autosaveDelay)
      guard !Task.isCancelled else { return }
      flush()
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
