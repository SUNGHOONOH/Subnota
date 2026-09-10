import SwiftUI
import SubnotaKit

@main
struct SubnotaApp: App {
  @State private var session = SessionStore()
  @AppStorage(ThemeSetting.storageKey) private var theme: ThemeSetting = .system
  @Environment(\.scenePhase) private var scenePhase
  /// 위젯이 연 목적지. `MainTabView` 가 소비하고 비운다. 로그인 전에 들어온 것은
  /// 로그인 화면을 건너뛰지 않는다 — `MainTabView` 가 없으니 그대로 기다렸다가
  /// 로그인 뒤에 처리된다.
  @State private var deepLink: DeepLink?

  var body: some Scene {
    WindowGroup {
      RootView(deepLink: $deepLink)
        .environment(session)
        // `subnota://` 는 OAuth 콜백과 같은 스킴이다. 그 콜백은 supabase-swift 의
        // ASWebAuthenticationSession 이 스스로 받아 여기로 오지 않지만, 혹시 와도
        // `DeepLink(url:)` 이 `auth` 호스트를 `nil` 로 버려 아무 일도 없다.
        .onOpenURL { url in
          if let link = DeepLink(url: url) { deepLink = link }
        }
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
