import SwiftUI
import UIKit

/// 본문은 Pretendard, 워드마크만 Alegreya Sans. 같은 얼굴을 쓰면 로고가 아니라
/// 큰 라벨로 읽힌다 (desktop/docs/design.md).
/// 폰트 파일이 아직 없으면 시스템 폰트로 떨어진다 — 레이아웃은 그대로 동작한다.
enum Typography {
  private static func resolve(_ name: String, _ size: CGFloat, fallback: Font) -> Font {
    UIFont(name: name, size: size) == nil ? fallback : .custom(name, size: size)
  }

  static func ui(_ size: CGFloat = 13, weight: Font.Weight = .regular) -> Font {
    let name = switch weight {
      case .semibold, .bold: "Pretendard-SemiBold"
      case .medium: "Pretendard-Medium"
      default: "Pretendard-Regular"
    }
    return resolve(name, size, fallback: .system(size: size, weight: weight))
  }

  /// 에디터 본문 16px / line-height 1.6 (line spacing 은 뷰에서 준다)
  static func editor() -> Font {
    resolve("Pretendard-Regular", 16, fallback: .system(size: 16))
  }

  static func wordmark(_ size: CGFloat = 22) -> Font {
    resolve("AlegreyaSans-Bold", size, fallback: .system(size: size, weight: .bold, design: .serif))
  }
}
