import SubnotaKit
import SwiftUI

/// 데스크탑 App.tsx 와 같은 규칙: 세션이 없으면 워크스페이스에 도달하지 못한다.
struct RootView: View {
  @Environment(SessionStore.self) private var session
  @Binding var deepLink: DeepLink?

  var body: some View {
    Group {
      if session.isRestoring {
        ProgressView().tint(Palette.brand)
      } else if session.userId != nil {
        MainTabView(deepLink: $deepLink)
      } else {
        AuthView()
      }
    }
    .task { await session.restore() }
  }
}
