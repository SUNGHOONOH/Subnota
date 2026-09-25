import SwiftUI
import UIKit

/// desktop/docs/design.md 의 색 체계를 옮긴 것.
/// 브랜드 색은 primary action / focus / selection 에만 쓴다. 장식으로 쓰지 않는다.
///
/// 다크 값은 지어낸 것이 아니라 데스크탑 `desktop/src/styles/_color-tokens.scss` 의
/// `html.dark` 블록에서 읽은 것이다. 다른 다크를 만들면 두 앱이 다른 제품처럼 보인다.
enum Palette {
  /// --app-color-brand-500 / -400 (= action-primary)
  static let brand = Color(light: 0x325496, dark: 0x83A5E2)
  /// 브랜드 위에 얹는 글자. 다크의 밝은 액센트에 흰 글씨는 대비 2.49로 미달한다
  /// — 데스크탑 `--app-color-action-primary-text` 가 검은 글씨를 쓰는 이유다.
  static let onBrand = Color(light: 0xFFFFFF, dark: 0x141413)
  /// --app-color-brand-petal. 로고 오른쪽 잎 전용.
  static let brandPetal = Color(light: 0x0B6E4F, dark: 0x3D9C74)
  /// --app-color-text. 따뜻한 다크브라운 — 순흑 아님.
  static let ink = Color(light: 0x2E2A26, dark: 0xECE7DD)
  /// --app-color-muted
  static let inkMuted = Color(light: 0x6B635C, dark: 0x9A948A)
  /// --app-color-bg-canvas. 전면 백색 워크스페이스.
  static let canvas = Color(light: .white, dark: Color(hex: 0x1B1A17))
  /// --app-color-chrome-bg. 캔버스보다 한 단계 떨어진 별개의 면.
  static let chrome = Color(light: 0xF4F2EF, dark: 0x24221E)
  /// --app-color-border. 다크는 불투명 회색이 아니라 바탕 위에 얹는 반투명이다.
  static let border = Color(light: Color(hex: 0xE3DFDA), dark: Color(hex: 0xFAF9F5).opacity(0.12))

  // 상태 색. 브랜드색과 경쟁하지 않도록 채도를 낮췄다. brandPetal(#0b6e4f)은
  // 로고 잎 전용이라 성공색으로 쓰지 않는다.
  /// `_color-tokens.scss` 에는 success 토큰이 없다. 데스크탑의 성공색은
  /// `subnota-workspace.scss` 의 `--legacy-success` 다 — 다크 오버라이드가 #4caf7d.
  static let success = Color(light: 0x2E7D57, dark: 0x4CAF7D)
  /// --app-color-danger
  static let danger = Color(light: 0xB3382F, dark: 0xF97066)

  /// --app-color-data-1 … -5. 월간 리포트 잔디의 5단계. 데이터에 브랜드색을 쓰지
  /// 않으려고 데스크탑이 따로 둔 색이다 — 단계는 투명도가 아니라 색으로 구분한다.
  /// index 0 = 기록 없음.
  static let dataLevels: [Color] = [
    Color(light: 0xE7F2EA, dark: 0x1B2A21),
    Color(light: 0xC4E3CD, dark: 0x244631),
    Color(light: 0x98D2AA, dark: 0x2F6644),
    Color(light: 0x61BB82, dark: 0x3D8B5B),
    Color(light: 0x1DAD64, dark: 0x4FB87A),
  ]

  // 에디터 하이라이트. 데스크탑에는 다크 값이 없어서(라이트 값을 그대로 쓴다)
  // 다크는 같은 색상을 불투명도만 올려 잡았다 — 어두운 바탕에서 안 보이면 안 된다.
  /// `==하이라이트==` 배경. 데스크탑 `mark` = rgba(112, 177, 124, 0.34).
  static let textHighlight = Color(
    light: Color(hex: 0x70B17C).opacity(0.34), dark: Color(hex: 0x70B17C).opacity(0.30))
  /// 날짜 토큰 배경. 데스크탑 `simple-editor.scss` `.date-token` = rgba(102, 112, 90, 0.16).
  static let dateHighlight = Color(
    light: Color(hex: 0x66705A).opacity(0.16), dark: Color(hex: 0xBFCBA8).opacity(0.22))
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

  /// 라이트/다크 한 쌍. `UIColor` 의 dynamic provider 를 감싸므로 루트의
  /// `.preferredColorScheme` 만 바꿔도 이 색을 쓰는 모든 뷰가 따라온다.
  init(light: Color, dark: Color) {
    self.init(uiColor: UIColor { traits in
      UIColor(traits.userInterfaceStyle == .dark ? dark : light)
    })
  }

  init(light: UInt32, dark: UInt32) {
    self.init(light: Color(hex: light), dark: Color(hex: dark))
  }
}
