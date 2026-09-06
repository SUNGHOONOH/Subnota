import SwiftUI

@main
struct SubnotaApp: App {
  @State private var session = SessionStore()
  @AppStorage(ThemeSetting.storageKey) private var theme: ThemeSetting = .system

  var body: some Scene {
    WindowGroup {
      RootView()
        .environment(session)
        // Palette 의 모든 토큰이 dynamic UIColor 라 이 한 줄이 앱 전체를 바꾼다.
        .preferredColorScheme(theme.colorScheme)
    }
  }
}
