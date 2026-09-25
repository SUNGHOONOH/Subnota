import SwiftUI

/// 저장 키는 데스크탑 `theme-toggle.tsx` 의 `THEME_STORAGE_KEY` 와 같은 이름이지만
/// **동기화하지 않는다** — 테마는 기기마다 다른 게 자연스럽다. 값이 없을 때 OS 를
/// 따르는 것도 데스크탑과 같은 규칙이다(`.system` 이 기본값이다).
enum ThemeSetting: String, CaseIterable, Identifiable {
  case system
  case light
  case dark

  static let storageKey = "subnota.theme"

  var id: Self { self }

  var label: String {
    switch self {
    case .system: "시스템"
    case .light: "라이트"
    case .dark: "다크"
    }
  }

  /// `nil` 은 SwiftUI 에게 "OS 설정을 따르라"는 뜻이다.
  var colorScheme: ColorScheme? {
    switch self {
    case .system: nil
    case .light: .light
    case .dark: .dark
    }
  }
}
