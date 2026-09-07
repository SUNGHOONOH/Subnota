import SwiftUI
import SubnotaKit

/// 링크 탭. 공유하거나 데스크탑에서 담은 링크의 요약 목록이다.
struct InboxListView: View {
  @Environment(SessionStore.self) private var session
  @State private var model: InboxListModel?
  @State private var opened: InboxSession?

  var body: some View {
    NavigationStack {
      Group {
        if let model {
          content(model)
        } else {
          ProgressView().tint(Palette.brand)
        }
      }
      .frame(maxWidth: .infinity, maxHeight: .infinity)
      .background(Palette.canvas)
      .navigationTitle("링크")
      .navigationDestination(item: $opened) { session in
        if let model { InboxDetailView(model: model, id: session.id) }
      }
    }
    // 첫 진입에서 한 번 맞춘다. 빈 상태에는 당길 목록이 없어서 새로고침 제스처만
    // 두면 새 기기가 서버 링크를 영영 못 받는다.
    .task {
      if model == nil, let ownerId = session.userId {
        model = InboxListModel(ownerId: ownerId)
      }
      model?.load()
      await model?.refresh()
    }
  }

  @ViewBuilder
  private func content(_ model: InboxListModel) -> some View {
    if model.sessions.isEmpty {
      empty(model)
    } else {
      list(model)
    }
  }

  private func empty(_ model: InboxListModel) -> some View {
    VStack(spacing: 6) {
      Text("아직 담은 링크가 없습니다")
        .font(Typography.ui(15, weight: .medium))
        .foregroundStyle(Palette.ink)
      Text("공유 시트에서 Subnota 를 고르면 여기로 모입니다")
        .font(Typography.ui(13))
        .foregroundStyle(Palette.inkMuted)
      if let notice = model.loadError {
        Text(notice).font(Typography.ui(12)).foregroundStyle(Palette.inkMuted).padding(.top, 4)
      }
    }
    .multilineTextAlignment(.center)
    .padding(24)
  }

  private func list(_ model: InboxListModel) -> some View {
    List {
      if let notice = model.loadError {
        Text(notice)
          .font(Typography.ui(12))
          .foregroundStyle(Palette.inkMuted)
          .listRowBackground(Color.clear)
      }
      ForEach(model.sessions) { session in
        row(model, session)
          // 행 전체를 Button 으로 감싸면 안쪽 재시도 버튼이 탭을 못 받는다.
          .contentShape(Rectangle())
          .onTapGesture { opened = session }
          .listRowBackground(Color.clear)
      }
    }
    .listStyle(.plain)
    // List 가 제 배경을 칠하면 다크에서 순흑이 되어 Palette.canvas 를 덮는다.
    .scrollContentBackground(.hidden)
    .refreshable { await model.refresh() }
  }

  private func row(_ model: InboxListModel, _ session: InboxSession) -> some View {
    VStack(alignment: .leading, spacing: 5) {
      HStack(spacing: 6) {
        Label(session.sourceType.label, systemImage: session.sourceType.icon)
          .font(Typography.ui(11))
          .foregroundStyle(Palette.inkMuted)
          .labelStyle(.titleAndIcon)
        if let domain = session.domain, !domain.isEmpty {
          Text(domain).font(Typography.ui(11)).foregroundStyle(Palette.inkMuted).lineLimit(1)
        }
        Spacer(minLength: 4)
        if session.liked {
          Image(systemName: "heart.fill")
            .font(.system(size: 11))
            .foregroundStyle(Palette.brand)
            .accessibilityLabel("좋아요")
        }
      }
      Text(session.listTitle)
        .font(Typography.ui(15, weight: .medium))
        .foregroundStyle(Palette.ink)
        .lineLimit(2)
      if let line = session.summaryOneLiner ?? session.summary, !line.isEmpty {
        Text(line).font(Typography.ui(12)).foregroundStyle(Palette.inkMuted).lineLimit(2)
      }
      HStack(spacing: 8) {
        if let chip = session.summaryStatus.chip {
          Text(chip.text)
            .font(Typography.ui(11))
            .foregroundStyle(chip.tint)
            .padding(.horizontal, 6)
            .padding(.vertical, 2)
            .background(Palette.chrome, in: Capsule())
        }
        if session.summaryStatus == .failed {
          Button("재시도") { Task { await model.retrySummary(session) } }
            .font(Typography.ui(11, weight: .medium))
            .buttonStyle(.borderless)
            .tint(Palette.brand)
            .disabled(model.busyId == session.id)
        }
        Spacer(minLength: 0)
        Text(session.createdAt.formatted(date: .abbreviated, time: .shortened))
          .font(Typography.ui(11))
          .foregroundStyle(Palette.inkMuted)
      }
    }
    .padding(.vertical, 4)
  }
}

extension InboxSourceType {
  var label: String {
    switch self {
    case .youtube: "유튜브"
    case .instagram: "인스타그램"
    case .url: "웹"
    case .image: "이미지"
    }
  }

  var icon: String {
    switch self {
    case .youtube: "play.rectangle"
    case .instagram: "camera"
    case .url: "link"
    case .image: "photo"
    }
  }
}

extension InboxSummaryStatus {
  /// `ready` 는 칩이 없다 — 다 된 것에 라벨을 붙이면 목록이 시끄럽다.
  var chip: (text: String, tint: Color)? {
    switch self {
    case .ready: nil
    case .pending: ("요약 중", Palette.inkMuted)
    case .partial: ("일부만 요약됨", Palette.inkMuted)
    case .unsupported: ("요약할 수 없는 링크", Palette.inkMuted)
    case .failed: ("요약 실패", Palette.danger)
    }
  }
}

/// 링크 목록 상태. 서버가 정본이라 좋아요·삭제·재시도는 **백엔드가 성공한 뒤에만**
/// 캐시에 반영한다 — 낙관적으로 먼저 바꿔 놓으면 되돌리는 코드가 따라붙는다.
@MainActor
@Observable
final class InboxListModel {
  private(set) var sessions: [InboxSession] = []
  /// 요청이 도는 항목. 같은 버튼을 연타해 요청이 엇갈리는 걸 막는다(데스크탑은
  /// 여기에 keyed mutation queue 를 쓴다 — 버튼 하나짜리 화면에는 과하다).
  private(set) var busyId: String?
  var loadError: String?

  private let store: InboxStore?
  private let remote = InboxRemote()

  init(ownerId: String) {
    do {
      store = InboxStore(store: try LocalStore(path: try AppGroup.databaseURL()), ownerId: ownerId)
    } catch {
      store = nil
      loadError = "로컬 저장소를 열지 못했습니다."
    }
  }

  func load() {
    guard let store else { return }
    do {
      sessions = try store.sessions()
    } catch {
      log(error)
      loadError = "링크를 불러오지 못했습니다."
    }
  }

  /// 네트워크가 없어도 로컬 캐시는 그대로다 — 새로고침 실패가 목록을 비우지 않는다.
  func refresh() async {
    do {
      try store?.replace(with: try await remote.list())
      loadError = nil
    } catch {
      log(error)
      loadError = (error as? InboxError)?.errorDescription ?? "링크를 가져오지 못했습니다."
    }
    load()
  }

  func retrySummary(_ session: InboxSession) async {
    await mutate(session, failureMessage: "요약을 다시 시도하지 못했습니다.") {
      try self.store?.upsert(try await self.remote.retrySummary(id: session.id))
    }
  }

  /// **좋아요는 반드시 백엔드를 지나간다.** `inbox_sessions` 에 클라이언트 RLS
  /// 정책이 없어서 Supabase 직접 호출은 조용히 실패한다.
  func setLiked(_ session: InboxSession, liked: Bool) async {
    await mutate(session, failureMessage: "좋아요를 저장하지 못했습니다.") {
      try await self.remote.setLiked(id: session.id, liked: liked)
      var updated = session
      updated.liked = liked
      try self.store?.upsert(updated)
    }
  }

  func delete(_ session: InboxSession) async -> Bool {
    await mutate(session, failureMessage: "링크를 삭제하지 못했습니다.") {
      try await self.remote.delete(id: session.id)
      try self.store?.delete(id: session.id)
    }
  }

  @discardableResult
  private func mutate(
    _ session: InboxSession,
    failureMessage: String,
    _ body: @escaping () async throws -> Void
  ) async -> Bool {
    guard busyId == nil else { return false }
    busyId = session.id
    defer { busyId = nil }
    do {
      try await body()
      loadError = nil
      load()
      return true
    } catch {
      log(error)
      loadError = failureMessage
      return false
    }
  }

  private func log(_ error: Error) {
    #if DEBUG
      print("[Subnota][inbox] \(String(reflecting: error))")
    #endif
  }
}
