import SwiftUI

struct MainTabView: View {
  @Environment(SessionStore.self) private var session
  /// 배지를 탭에 달아야 해서 수집함 상태는 여기서 들고 있는다.
  @State private var inbox: ScheduleInboxModel?

  var body: some View {
    TabView {
      MemoListView()
        .tabItem {
          Image(systemName: "note.text")
            .accessibilityLabel("메모")
        }

      CalendarView(inbox: inbox)
        .tabItem {
          Image(systemName: "calendar")
            .accessibilityLabel("캘린더")
        }
        .badge(inbox?.items.count ?? 0)

      PlaceholderTab(title: "링크")
        .tabItem {
          Image(systemName: "macwindow")
            .accessibilityLabel("링크")
        }
    }
    .tint(Palette.brand)
    // 수집함은 서버가 채운다. 앱을 열자마자 한 번 받아 와야 배지가 맞는다.
    .task {
      if inbox == nil, let ownerId = session.userId {
        inbox = ScheduleInboxModel(ownerId: ownerId)
      }
      await inbox?.refresh()
    }
  }
}

/// 링크 탭은 다음 Phase 에서 실제 화면으로 교체된다.
private struct PlaceholderTab: View {
  let title: String

  var body: some View {
    NavigationStack {
      VStack(spacing: 8) {
        Text(title).font(Typography.ui(15, weight: .semibold)).foregroundStyle(Palette.ink)
        Text("준비 중입니다").font(Typography.ui(13)).foregroundStyle(Palette.inkMuted)
      }
      .frame(maxWidth: .infinity, maxHeight: .infinity)
      .background(Palette.canvas)
      .navigationTitle(title)
    }
  }
}
