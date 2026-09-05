import SwiftUI

@main
struct SubnotaApp: App {
  var body: some Scene {
    WindowGroup {
      VStack(spacing: 12) {
        Text("Subnota").font(Typography.wordmark(28)).foregroundStyle(Palette.ink)
        Text("본문 13px").font(Typography.ui()).foregroundStyle(Palette.inkMuted)
        Text("브랜드").font(Typography.ui(15, weight: .semibold)).foregroundStyle(Palette.brand)
      }
      .frame(maxWidth: .infinity, maxHeight: .infinity)
      .background(Palette.canvas)
    }
  }
}
