import Network
import SubnotaKit
import SubnotaSearch
import SwiftUI

/// 검색 모델 상태. 설정 화면을 벗어나도 다운로드가 이어지도록 앱에 하나만 둔다.
@MainActor @Observable
final class SearchModelStore {
  static let shared = SearchModelStore()

  enum Phase: Equatable {
    case missing
    case downloading(Double)
    case ready
    case failed(String)
  }

  private(set) var phase: Phase
  /// 셀룰러·개인용 핫스팟. 135MB 라 받기 전에 알린다.
  private(set) var isExpensive = false
  private(set) var isOffline = false

  private var task: Task<Void, Never>?
  private let monitor = NWPathMonitor()

  /// 엔진은 앱에 하나 — 가중치를 한 번만 올린다. 처음 색인할 때 읽는다.
  private var indexerLoad: Task<MemoIndexer?, Never>?
  private var indexing: Task<Void, Never>?
  /// 모델이 없을 때 들어온 요청. 설치가 끝나면 이걸로 전체를 한 번 색인한다.
  private var indexTarget: (store: LocalStore, ownerId: String)?

  private init() {
    let installed = (try? EmbeddingModel.directory()).map { ModelDownloader.isInstalled(in: $0) } ?? false
    phase = installed ? .ready : .missing
    monitor.pathUpdateHandler = { [weak self] path in
      Task { @MainActor in
        self?.isExpensive = path.isExpensive
        self?.isOffline = path.status != .satisfied
      }
    }
    monitor.start(queue: .main)
  }

  func download() {
    guard task == nil else { return }
    phase = .downloading(0)
    task = Task {
      do {
        try await ModelDownloader.download(into: EmbeddingModel.directory()) { received, total in
          let fraction = Double(received) / Double(total)
          Task { @MainActor [weak self] in
            // 완료·취소 뒤에 늦게 도착한 진행률이 상태를 되돌리지 않게.
            guard let self, case .downloading = self.phase else { return }
            self.phase = .downloading(fraction)
          }
        }
        phase = .ready
        if let target = indexTarget {
          scheduleIndexing(store: target.store, ownerId: target.ownerId, after: .zero)
        }
      } catch is CancellationError {
        phase = .missing
      } catch {
        phase = .failed(error.localizedDescription)
      }
      task = nil
    }
  }

  /// 받은 만큼은 `.part` 로 남아 다음에 이어받는다.
  func cancel() {
    task?.cancel()
  }

  /// 메모가 바뀔 때마다 부른다. 조용해진 뒤 백그라운드에서 바뀐 메모만 색인한다
  /// (데스크탑 `LOCAL_INDEX_DEBOUNCE_MS` 와 같은 5초). 모델이 없으면 조용히 대상만 기억한다.
  func scheduleIndexing(store: LocalStore, ownerId: String, after delay: Duration = .seconds(5)) {
    indexTarget = (store, ownerId)
    guard phase == .ready else { return }
    // 앞 실행은 메모 사이에서 멈춘다. 끝낸 메모는 남으므로 다음 실행이 이어서 한다.
    indexing?.cancel()
    indexing = Task(priority: .background) {
      try? await Task.sleep(for: delay)
      guard !Task.isCancelled, let indexer = await loadIndexer() else { return }
      do {
        try await indexer.reconcile(store: store, ownerId: ownerId)
      } catch {
        // 다음 load 가 다시 시도한다. 색인 실패로 사용자를 방해하지 않는다.
        #if DEBUG
          if !(error is CancellationError) { print("[Subnota][index] \(String(reflecting: error))") }
        #endif
      }
    }
  }

  private func loadIndexer() async -> MemoIndexer? {
    if indexerLoad == nil {
      indexerLoad = Task {
        guard let directory = try? EmbeddingModel.directory(),
              let engine = try? await EmbeddingEngine(modelDirectory: directory)
        else { return nil }
        return MemoIndexer(engine: engine)
      }
    }
    let indexer = await indexerLoad?.value
    if indexer == nil { indexerLoad = nil }  // 다음에 다시 읽어 본다.
    return indexer
  }
}

/// 검색 모델을 받는 명시적 관문. 데스크탑 `EmbeddingModelGate` 와 같은 이유로 조용히
/// 받지 않는다 — 사용자가 이유도 모른 채 135MB 를 받게 되기 때문이다.
struct SearchModelView: View {
  private let store = SearchModelStore.shared
  private let sizeLabel = "약 \(EmbeddingModel.totalBytes / 1_000_000)MB"

  var body: some View {
    List {
      Section {
        Text("메모 사이에서 관련 문장을 찾는 데 필요한 파일을 한 번 내려받습니다. \(sizeLabel), 이 기기에만 저장되고 iCloud 백업에는 포함되지 않습니다.")
          .font(Typography.ui(14))
          .foregroundStyle(Palette.inkMuted)
      }
      .listRowBackground(Palette.chrome)

      Section { controls }
        .listRowBackground(Palette.chrome)
    }
    .scrollContentBackground(.hidden)
    .background(Palette.canvas)
    .navigationTitle("검색 모델")
    .navigationBarTitleDisplayMode(.inline)
  }

  @ViewBuilder private var controls: some View {
    switch store.phase {
    case .ready:
      Label("준비됨", systemImage: "checkmark.circle")
        .font(Typography.ui(15))
        .foregroundStyle(Palette.success)

    case .downloading(let fraction):
      VStack(alignment: .leading, spacing: 6) {
        ProgressView(value: fraction)
          .tint(Palette.brand)
        Text("받는 중 \(Int(fraction * 100))%")
          .font(Typography.ui(12))
          .foregroundStyle(Palette.inkMuted)
          .monospacedDigit()
      }
      Button("취소") { store.cancel() }
        .font(Typography.ui(15))
        .foregroundStyle(Palette.ink)

    case .missing, .failed:
      if case .failed(let message) = store.phase {
        warning(message, color: Palette.danger)
      }
      if store.isOffline {
        warning("네트워크에 연결한 뒤 다시 시도해 주세요. 검색 파일은 처음 한 번만 받으면 됩니다.", color: Palette.inkMuted)
      } else if store.isExpensive {
        warning("셀룰러 데이터로 \(sizeLabel)를 받습니다. Wi‑Fi 에서 받는 것을 권장합니다.", color: Palette.danger)
      }
      Button(store.phase == .missing ? "다운로드 (\(sizeLabel))" : "다시 시도") { store.download() }
        .font(Typography.ui(15))
        .foregroundStyle(store.isOffline ? Palette.brand.opacity(0.4) : Palette.brand)
        .disabled(store.isOffline)
    }
  }

  private func warning(_ text: String, color: Color) -> some View {
    Text(text)
      .font(Typography.ui(13))
      .foregroundStyle(color)
  }
}

extension SearchModelStore.Phase {
  /// 설정 행 오른쪽에 보이는 짧은 상태.
  var summary: String {
    switch self {
    case .missing: "받지 않음"
    case .downloading(let fraction): "받는 중 \(Int(fraction * 100))%"
    case .ready: "준비됨"
    case .failed: "실패"
    }
  }
}
