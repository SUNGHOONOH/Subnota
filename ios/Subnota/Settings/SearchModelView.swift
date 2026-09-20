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

  /// 자동 검색 토글. **기본 켜짐** — 데스크탑(`ambientAutoSearchEnabled`)과 맞춘다.
  /// 같은 계정으로 두 기기를 쓰는데 한쪽만 조용하면 고장으로 읽힌다.
  /// 문턱은 실제 크기 메모로 보정했다(`AmbientSearch.scoreThreshold`).
  static let autoSearchKey = "subnota.search.auto"

  /// 엔진은 앱에 하나 — 가중치를 한 번만 올린다. 색인과 검색이 같이 쓴다.
  private var engineLoad: Task<EmbeddingEngine?, Never>?
  private var indexer: MemoIndexer?
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

  /// 커서 문맥과 가까운 메모(전부, 가까운 순). 모델이 없으면 nil — 수동 🔍 는 게이트로
  /// 안내하고 자동은 조용히 넘어간다.
  func nearbyMemos(
    to text: String, excluding memoId: String, store: LocalStore, ownerId: String
  ) async throws -> [NearbyMemo]? {
    guard phase == .ready else { return nil }
    guard let engine = await loadEngine() else { throw EngineUnavailable() }
    // 임베딩과 스캔은 메인 밖에서 — 타이핑을 막지 않는다.
    let results = try await Task.detached(priority: .userInitiated) {
      // 색인이 정규화된 본문을 임베딩하므로 질의도 같은 규칙을 통과해야 한다.
      // 한쪽만 정규화하면 마크업이 섞인 만큼 벡터가 어긋난다.
      let query = try engine.embed(ChunkText.normalized(text), as: .query)
      return try await VectorStore(store: store, ownerId: ownerId)
        .nearbyMemos(to: query, excluding: memoId)
    }.value
    #if DEBUG
      // 문턱 캘리브레이션용 실측. 본문은 찍지 않는다.
      let top = results.prefix(AmbientSearch.candidateCount)
        .map { "\($0.memo.id.prefix(8)):\(String(format: "%.4f", $0.score))" }
      print("[Subnota][search] n=\(results.count) "
        + "surface=\(AmbientSearch.shouldSurface(results.map(\.score))) top=\(top)")
    #endif
    return results
  }

  private struct EngineUnavailable: Error {}

  private func loadIndexer() async -> MemoIndexer? {
    if let indexer { return indexer }
    guard let engine = await loadEngine() else { return nil }
    // 기다리는 사이 다른 호출이 먼저 만들었을 수 있다 — actor 가 둘이면 색인이 겹친다.
    if let indexer { return indexer }
    let made = MemoIndexer(engine: engine)
    indexer = made
    return made
  }

  private func loadEngine() async -> EmbeddingEngine? {
    if engineLoad == nil {
      engineLoad = Task {
        guard let directory = try? EmbeddingModel.directory() else { return nil }
        return try? await EmbeddingEngine(modelDirectory: directory)
      }
    }
    let engine = await engineLoad?.value
    if engine == nil { engineLoad = nil }  // 다음에 다시 읽어 본다.
    return engine
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
