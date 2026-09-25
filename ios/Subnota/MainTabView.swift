import SubnotaKit
import SwiftUI

struct MainTabView: View {
  @Environment(SessionStore.self) private var session
  /// 배지를 탭에 달아야 해서 수집함 상태는 여기서 들고 있는다.
  @State private var inbox: ScheduleInboxModel?
  @Binding var deepLink: DeepLink?
  @State private var tab: Tab = .memos

  private enum Tab { case memos, calendar, links }

  var body: some View {
    TabView(selection: $tab) {
      MemoListView(deepLink: $deepLink)
        .tag(Tab.memos)
        .tabItem {
          Image(systemName: "note.text")
            .accessibilityLabel("메모")
        }

      CalendarView(inbox: inbox)
        .tag(Tab.calendar)
        .tabItem {
          Image(systemName: "calendar")
            .accessibilityLabel("캘린더")
        }
        .badge(inbox?.items.count ?? 0)

      InboxListView()
        .tag(Tab.links)
        .tabItem {
          Image(systemName: "macwindow")
            .accessibilityLabel("링크")
        }
    }
    .tint(Palette.brand)
    // 앱이 꺼져 있다가 위젯으로 열리면 링크가 이 뷰보다 먼저 와 있다 — `initial`.
    .onChange(of: deepLink, initial: true) { _, link in route(link) }
    // 수집함은 서버가 채운다. 앱을 열자마자 한 번 받아 와야 배지가 맞는다.
    .task {
      if inbox == nil, let ownerId = session.userId {
        inbox = ScheduleInboxModel(ownerId: ownerId)
      }
      await inbox?.refresh()
    }
  }

  /// 탭만 고른다. 메모를 여는 건 메모 모델을 쥔 `MemoListView` 가 하고 링크도 거기서 비운다.
  private func route(_ link: DeepLink?) {
    switch link {
    case .calendar:
      tab = .calendar
      deepLink = nil
    case .newMemo, .memo:
      tab = .memos
    case nil:
      break
    }
  }
}
