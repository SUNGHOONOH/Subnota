import SwiftUI

struct MainTabView: View {
  var body: some View {
    TabView {
      MemoListView()
        .tabItem { Label("메모", systemImage: "note.text") }

      PlaceholderTab(title: "캘린더")
        .tabItem { Label("캘린더", systemImage: "calendar") }

      PlaceholderTab(title: "링크")
        .tabItem { Label("링크", systemImage: "macwindow") }
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

// 임시 — Task 7 에서 실제 구현으로 교체한다.
struct MemoListView: View {
  var body: some View { PlaceholderTab(title: "메모") }
}
