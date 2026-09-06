import SwiftUI

struct MainTabView: View {
  var body: some View {
    TabView {
      MemoListView()
        .tabItem {
          Image(systemName: "note.text")
            .accessibilityLabel("메모")
        }

      PlaceholderTab(title: "캘린더")
        .tabItem {
          Image(systemName: "calendar")
            .accessibilityLabel("캘린더")
        }

      PlaceholderTab(title: "링크")
        .tabItem {
          Image(systemName: "macwindow")
            .accessibilityLabel("링크")
        }
    }
    .tint(Palette.brand)
  }
}

/// Phase 4·5 에서 실제 화면으로 교체된다.
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
