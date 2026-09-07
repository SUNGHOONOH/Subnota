import SwiftUI
import SubnotaKit

@main
struct SubnotaApp: App {
  @State private var session = SessionStore()
  @AppStorage(ThemeSetting.storageKey) private var theme: ThemeSetting = .system
  @Environment(\.scenePhase) private var scenePhase

  var body: some Scene {
    WindowGroup {
      RootView()
        .environment(session)
        // Palette 의 모든 토큰이 dynamic UIColor 라 이 한 줄이 앱 전체를 바꾼다.
        .preferredColorScheme(theme.colorScheme)
        .onChange(of: scenePhase) { _, phase in
          // `LocalStore` 가 켜 둔 `observesSuspensionNotifications` 는 이 알림이
          // 없으면 아무 일도 하지 않는다. 백그라운드로 갈 때 DB 잠금을 놓아야
          // 위젯 확장이 쓰기를 잡을 수 있고, 잠금을 쥔 채 정지돼 0xDEAD10CC 로
          // 죽는 것도 막는다. 자세한 근거는 `LocalStore.init` 의 ③.
          if phase == .background {
            LocalStoreSuspension.suspend()
          } else if phase == .active {
            LocalStoreSuspension.resume()
          }
        }
    }
  }
}
