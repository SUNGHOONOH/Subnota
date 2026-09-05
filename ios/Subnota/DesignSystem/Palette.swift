import SwiftUI

/// desktop/docs/design.md 의 색 체계를 옮긴 것.
/// 브랜드 색은 primary action / focus / selection 에만 쓴다. 장식으로 쓰지 않는다.
enum Palette {
  static let brand = Color(hex: 0x325496)        // 잉크 블루
  static let brandPetal = Color(hex: 0x0B6E4F)   // 로고 오른쪽 잎 전용
  static let ink = Color(hex: 0x2E2A26)          // 따뜻한 다크브라운 — 순흑 아님
  static let inkMuted = Color(hex: 0x6B635C)
  static let canvas = Color.white                // 전면 백색 워크스페이스
  static let chrome = Color(hex: 0xF4F2EF)       // 중성 회색 크롬
  static let border = Color(hex: 0xE3DFDA)       // 웜 뉴트럴 헤어라인
}

extension Color {
  init(hex: UInt32) {
    self.init(
      .sRGB,
      red: Double((hex >> 16) & 0xFF) / 255,
      green: Double((hex >> 8) & 0xFF) / 255,
      blue: Double(hex & 0xFF) / 255,
      opacity: 1
    )
  }
}
