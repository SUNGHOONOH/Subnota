import SwiftUI

/// 물망초 마크. desktop/src/components/SubnotaMark.tsx 를 그대로 옮긴 것이다.
///
/// 잎의 위치·각도·크기는 로고 원본 그대로다. 균등한 72°가 아니라 미세하게
/// 어긋난 배치가 이 마크의 성격이라 손대지 않는다 — 데스크탑 원본의 주석과
/// 같은 이유다. 값을 바꾸면 두 플랫폼의 로고가 갈린다.
struct SubnotaMark: View {
  /// 오른쪽 잎 하나만 강조색이다. 로고는 켠다.
  var accent = true
  var size: CGFloat = 34

  /// [translate x, translate y, rotate deg, scale]
  private static let placements: [(CGFloat, CGFloat, CGFloat, CGFloat)] = [
    (49.7, 47, -6, 1.04),
    (52.8, 48.9, 68, 0.97),
    (51.7, 52.5, 145, 1.06),
    (48.5, 52.6, 210, 0.98),
    (47.2, 48.9, 292, 1.02),
  ]

  /// 데스크탑과 같은 잎 하나의 윤곽.
  /// `M0,-4 C-10,-11 -15,-30 -11,-41 C-8,-48 8,-48 11,-41 C15,-30 10,-11 0,-4`
  private static var petal: Path {
    var path = Path()
    path.move(to: CGPoint(x: 0, y: -4))
    path.addCurve(
      to: CGPoint(x: -11, y: -41),
      control1: CGPoint(x: -10, y: -11),
      control2: CGPoint(x: -15, y: -30)
    )
    path.addCurve(
      to: CGPoint(x: 11, y: -41),
      control1: CGPoint(x: -8, y: -48),
      control2: CGPoint(x: 8, y: -48)
    )
    path.addCurve(
      to: CGPoint(x: 0, y: -4),
      control1: CGPoint(x: 15, y: -30),
      control2: CGPoint(x: 10, y: -11)
    )
    path.closeSubpath()
    return path
  }

  private static let accentIndex = 1
  private static let viewBox: CGFloat = 100

  var body: some View {
    Canvas { context, canvasSize in
      // viewBox 0 0 100 100 을 실제 크기로 맞춘다.
      let scale = min(canvasSize.width, canvasSize.height) / Self.viewBox
      context.scaleBy(x: scale, y: scale)

      for (index, placement) in Self.placements.enumerated() {
        let (x, y, degrees, petalScale) = placement
        // SVG 의 transform="translate() rotate() scale()" 과 같은 순서로 곱한다.
        let transform = CGAffineTransform.identity
          .translatedBy(x: x, y: y)
          .rotated(by: degrees * .pi / 180)
          .scaledBy(x: petalScale, y: petalScale)

        let colour = (accent && index == Self.accentIndex)
          ? Palette.brandPetal
          : Palette.brand
        context.fill(Self.petal.applying(transform), with: .color(colour))
      }
    }
    .frame(width: size, height: size)
    .accessibilityHidden(true)
  }
}
