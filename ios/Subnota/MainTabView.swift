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

      InboxListView()
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
