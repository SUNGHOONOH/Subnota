import SwiftUI
import SubnotaKit

struct MemoEditorView: View {
  @Environment(\.scenePhase) private var scenePhase
  @AppStorage(SearchModelStore.autoSearchKey) private var autoSearch = false
  @State private var text: String
  @State private var lastSavedContent: String
  @State private var autosave: Task<Void, Never>?
  @State private var handle = EditorHandle()
  /// 수동 🔍 결과 시트.
  @State private var manual: NearbySearchState?
  @State private var showingGate = false
  /// 자동 검색이 조용히 띄운 한 건.
  @State private var ambientHit: NearbyMemo?
  @State private var ambientTask: Task<Void, Never>?
  @State private var lastAmbientQuery: String?
  private let memo: Memo
  private let onSave: (Memo) -> Void
  /// 커서 문맥 → 가까운 메모(전부). 모델이 없으면 nil.
  private let search: (String) async throws -> [NearbyMemo]?
  private let onOpen: (Memo) -> Void

  /// 타이핑이 멎고 이만큼 지나면 저장한다. 데스크탑보다 짧게 잡는 이유는
  /// iOS 가 앱을 백그라운드 전환 없이 죽일 수 있어서다.
  private static let autosaveDelay = Duration.seconds(1)
  /// 데스크탑 `AMBIENT_IDLE_DELAY_MS`.
  private static let ambientDelay = Duration.seconds(5)
  /// 데스크탑 더보기 목록과 같은 8건.
  private static let manualLimit = 8

  init(
    memo: Memo,
    onSave: @escaping (Memo) -> Void,
    search: @escaping (String) async throws -> [NearbyMemo]?,
    onOpen: @escaping (Memo) -> Void
  ) {
    self.memo = memo
    self.onSave = onSave
    self.search = search
    self.onOpen = onOpen
    _text = State(initialValue: memo.content)
    _lastSavedContent = State(initialValue: memo.content)
  }

  var body: some View {
    // 폰트·줄간격·색은 원문에 입히는 속성이라 MarkdownStyling 이 갖는다.
    MarkdownTextView(text: $text, handle: handle)
      .safeAreaInset(edge: .bottom) { bottomBar }
      .background(Palette.canvas)
      .padding(.horizontal, 16)
      .navigationBarTitleDisplayMode(.inline)
      // 타이핑 중에도 주기적으로 쓴다. 아래 두 flush 만으로는 앱이 백그라운드를
      // 거치지 않고 죽을 때(크래시·강제 종료) 연 뒤 친 내용이 통째로 사라진다.
      .onChange(of: text) { _, _ in
        scheduleAutosave()
        scheduleAmbient()
      }
      // 화면을 떠날 때와 백그라운드로 갈 때는 기다리지 않고 바로 쓴다.
      .onDisappear {
        autosave?.cancel()
        ambientTask?.cancel()
        flush()
      }
      .onChange(of: scenePhase) { _, phase in
        guard phase != .active else { return }
        autosave?.cancel()
        flush()
      }
      .sheet(item: $manual) { state in
        NearbyMemosView(state: state) { picked in
          manual = nil
          onOpen(picked)
        }
      }
      .sheet(isPresented: $showingGate) {
        NavigationStack {
          SearchModelView()
            .toolbar {
              ToolbarItem(placement: .cancellationAction) {
                Button("닫기") { showingGate = false }
                  .foregroundStyle(Palette.ink)
              }
            }
        }
      }
  }

  private var bottomBar: some View {
    HStack(alignment: .center, spacing: 8) {
      if let hit = ambientHit {
        AmbientSuggestion(hit: hit, onOpen: { onOpen(hit.memo) }, onDismiss: { ambientHit = nil })
      } else {
        Spacer()
      }
      Button(action: searchManually) {
        Image(systemName: "magnifyingglass")
          .font(.system(size: 16, weight: .medium))
          .foregroundStyle(Palette.ink)
          .frame(width: 40, height: 40)
          .background(Palette.chrome, in: Circle())
          .overlay(Circle().stroke(Palette.border))
      }
      .accessibilityLabel("관련 메모 찾기")
    }
    .padding(.bottom, 8)
  }

  /// 커서 위치. 뷰가 아직 없으면 끝.
  private var cursor: Int {
    handle.textView?.selectedRange.location ?? (text as NSString).length
  }

  /// 임계값 없이 **항상** 보여 준다 — 사용자가 직접 물었다.
  private func searchManually() {
    guard SearchModelStore.shared.phase == .ready else {
      showingGate = true
      return
    }
    guard let query = AmbientSearch.queryText(text, cursor: cursor) else {
      manual = .results([])
      return
    }
    manual = .loading
    Task {
      do {
        guard let results = try await search(query) else {
          manual = nil
          showingGate = true
          return
        }
        manual = .results(Array(results.prefix(Self.manualLimit)))
      } catch {
        manual = .failed
      }
    }
  }

  /// 타이핑이 멎으면 같은 계산을 하되, 1등이 후보 분포에서 뚜렷이 튈 때만 띄운다.
  /// 켜져 있지 않거나 모델이 없으면 아무것도 안 한다.
  private func scheduleAmbient() {
    ambientTask?.cancel()
    guard autoSearch, SearchModelStore.shared.phase == .ready else { return }
    ambientTask = Task {
      try? await Task.sleep(for: Self.ambientDelay)
      guard !Task.isCancelled,
        // IME 조합 중에는 묻지 않는다 — 반쯤 친 글자로 찾게 된다.
        handle.textView?.markedTextRange == nil,
        let query = AmbientSearch.queryText(text, cursor: cursor),
        query.utf16.count >= AmbientSearch.minimumQueryLength,
        // 같은 문맥은 한 번만 — 데스크탑 `lastAutomaticTargetKey`.
        query != lastAmbientQuery
      else { return }
      lastAmbientQuery = query
      // 실패도 조용히 — 묻지 않은 오류를 글 쓰는 중에 띄우지 않는다.
      guard let results = (try? await search(query)) ?? nil, !Task.isCancelled else { return }
      ambientHit = AmbientSearch.shouldSurface(results.map(\.score)) ? results.first : nil
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
