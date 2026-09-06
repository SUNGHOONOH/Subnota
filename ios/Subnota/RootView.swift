import SwiftUI

/// 데스크탑 App.tsx 와 같은 규칙: 세션이 없으면 워크스페이스에 도달하지 못한다.
struct RootView: View {
  @Environment(SessionStore.self) private var session

  var body: some View {
    Group {
      if session.isRestoring {
        ProgressView().tint(Palette.brand)
      } else if session.userId != nil {
        MainTabView()
      } else {
        AuthView()
      }
    }
    .task { await session.restore() }
  }
}
