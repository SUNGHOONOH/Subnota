import SwiftUI
import SubnotaKit

/// 메모에서 뽑아낸 일정 후보 목록. 수락하면 캘린더 블록이 되고, 무시하면 사라진다.
/// **드래그로 옮기는 동작은 스펙에서 뺐다 — 넣지 말 것.**
struct ScheduleInboxView: View {
  @Environment(\.dismiss) private var dismiss
  let model: ScheduleInboxModel

  var body: some View {
    NavigationStack {
      Group {
        if model.items.isEmpty {
          empty
        } else {
          list
        }
      }
      .frame(maxWidth: .infinity, maxHeight: .infinity)
      .background(Palette.canvas)
      .navigationTitle("일정 수집함")
      .navigationBarTitleDisplayMode(.inline)
      .toolbar {
        ToolbarItem(placement: .topBarTrailing) {
          Button("닫기") { dismiss() }.font(Typography.ui(15)).tint(Palette.brand)
        }
      }
    }
    .task { await model.refresh() }
  }

  private var empty: some View {
    VStack(spacing: 6) {
      if let notice = model.loadError {
        Text(notice).font(Typography.ui(13)).foregroundStyle(Palette.inkMuted)
      } else {
        Text("들어온 일정 후보가 없습니다")
          .font(Typography.ui(15, weight: .medium))
          .foregroundStyle(Palette.ink)
        Text("메모에 날짜를 적으면 여기로 모입니다")
          .font(Typography.ui(13))
          .foregroundStyle(Palette.inkMuted)
      }
    }
    .padding(24)
  }

  private var list: some View {
    List {
      if let notice = model.loadError {
        Text(notice)
          .font(Typography.ui(12))
          .foregroundStyle(Palette.inkMuted)
          .listRowBackground(Color.clear)
      }
      ForEach(model.items) { item in
        row(item).listRowBackground(Color.clear)
      }
    }
    .listStyle(.plain)
    // List 가 제 배경을 칠하면 다크에서 순흑이 되어 Palette.canvas 를 덮는다.
    .scrollContentBackground(.hidden)
    .refreshable { await model.refresh() }
  }

  private func row(_ item: ScheduleInboxItem) -> some View {
    VStack(alignment: .leading, spacing: 6) {
      HStack(spacing: 6) {
        Text(scheduleLabel(item))
          .font(Typography.ui(12, weight: .medium))
          .foregroundStyle(Palette.brand)
        if let label = confidenceLabel(item) {
          Text(label)
            .font(Typography.ui(11))
            .foregroundStyle(Palette.inkMuted)
            .padding(.horizontal, 6)
            .padding(.vertical, 2)
            .background(Palette.chrome, in: Capsule())
        }
      }
      Text(item.title.isEmpty ? CalendarBlock.defaultTitle : item.title)
        .font(Typography.ui(15, weight: .medium))
        .foregroundStyle(Palette.ink)
      if !item.sourceText.isEmpty {
        Text(item.sourceText)
          .font(Typography.ui(12))
          .foregroundStyle(Palette.inkMuted)
          .lineLimit(2)
      }
      HStack(spacing: 8) {
        Button("수락") { model.accept(item) }
          .font(Typography.ui(13, weight: .medium))
          .buttonStyle(.borderedProminent)
          .tint(Palette.brand)
        Button("무시") { model.dismiss(item) }
          .font(Typography.ui(13))
          .buttonStyle(.bordered)
          .tint(Palette.inkMuted)
      }
      // List 행 전체가 버튼 하나로 묶이지 않게 한다 — 안 그러면 어느 쪽을 눌러도
      // 두 동작이 같이 불린다.
      .buttonStyle(.borderless)
      .padding(.top, 2)
    }
    .padding(.vertical, 4)
  }

  /// 데스크탑 `formatScheduleDate`. 시각 표현을 못 찾았으면 날짜만 보여준다.
  private func scheduleLabel(_ item: ScheduleInboxItem) -> String {
    let day = item.scheduledAt.formatted(.dateTime.month().day().weekday(.abbreviated))
    guard item.hasTime else { return "\(day) · 시간 미정" }
    return "\(day) \(item.scheduledAt.formatted(.dateTime.hour().minute()))"
  }

  private func confidenceLabel(_ item: ScheduleInboxItem) -> String? {
    switch item.confidence {
    case "auto": "자동 감지"
    case "candidate": "후보"
    default: nil
    }
  }
}

/// 수집함 상태. 서버가 정본이지만 목록·배지·수락은 로컬에서 먼저 끝난다 —
/// 오프라인에서 수락한 항목은 아웃박스에 남았다가 다음 새로고침에 올라간다.
@MainActor
@Observable
final class ScheduleInboxModel {
  private(set) var items: [ScheduleInboxItem] = []
  var loadError: String?

  private let inbox: ScheduleInboxStore?
  private let calendar: CalendarStore?
  private let remote: CalendarRemote

  /// 데스크탑 `DEFAULT_CALENDAR_EVENT_DURATION_MS`.
  private static let defaultDuration: TimeInterval = 60 * 60

  init(ownerId: String) {
    remote = CalendarRemote(client: SupabaseClientProvider.shared, userId: ownerId)
    do {
      let local = try LocalStore(path: try AppGroup.databaseURL())
      inbox = ScheduleInboxStore(store: local, ownerId: ownerId)
      calendar = CalendarStore(store: local, ownerId: ownerId)
    } catch {
      inbox = nil
      calendar = nil
      loadError = "로컬 저장소를 열지 못했습니다."
    }
  }

  func load() {
    guard let inbox else { return }
    do {
      items = try inbox.items()
    } catch {
      loadError = "일정 후보를 불러오지 못했습니다."
    }
  }

  /// 밀린 수락·무시를 먼저 올리고 서버 목록으로 캐시를 갈아끼운다. 네트워크가
  /// 없으면 로컬 캐시가 그대로 남는다.
  func refresh() async {
    load()
    await pushActions()
    do {
      let rows = try await remote.fetchScheduleInbox()
      try inbox?.replace(with: rows.compactMap { $0.toItem() })
      loadError = nil
    } catch {
      log(error)
      loadError = "일정 후보를 받아오지 못했습니다."
    }
    load()
  }

  /// 데스크탑 `placeScheduleInboxItem`. 시각을 못 찾은 후보는 그 날 종일 일정으로
  /// 놓는다 — 데스크탑은 여기서 날짜 선택기를 띄우지만 iOS 에는 그 화면이 없다.
  func accept(_ item: ScheduleInboxItem) {
    guard let calendar else { return }
    do {
      let allDay = !item.hasTime
      _ = try calendar.create(
        title: item.title,
        startDate: item.scheduledAt,
        endDate: allDay ? nil : item.scheduledAt.addingTimeInterval(Self.defaultDuration),
        allDay: allDay,
        note: item.sourceText
      )
      handle(item, status: ScheduleInboxAction.accepted)
    } catch {
      log(error)
      loadError = "일정을 만들지 못했습니다."
    }
  }

  func dismiss(_ item: ScheduleInboxItem) {
    handle(item, status: ScheduleInboxAction.dismissed)
  }

  private func handle(_ item: ScheduleInboxItem, status: String) {
    guard let inbox else { return }
    do {
      try inbox.handle(id: item.id, status: status)
      load()
      Task { await pushActions() }
    } catch {
      log(error)
      loadError = "처리 결과를 저장하지 못했습니다."
    }
  }

  /// 올린 것만 아웃박스에서 지운다. 실패한 것은 남아서 다음 새로고침에 다시 나간다.
  private func pushActions() async {
    guard let inbox else { return }
    for action in (try? inbox.pendingActions()) ?? [] {
      do {
        try await remote.updateScheduleInbox(id: action.id, status: action.status)
        try inbox.clearAction(id: action.id)
      } catch {
        log(error)
      }
    }
  }

  private func log(_ error: Error) {
    #if DEBUG
      print("[Subnota][schedule-inbox] \(String(reflecting: error))")
    #endif
  }
}
