import SwiftUI

@main
struct SubnotaApp: App {
  @State private var session = SessionStore()

  var body: some Scene {
    WindowGroup {
      RootView()
        .environment(session)
    }
  }
}
