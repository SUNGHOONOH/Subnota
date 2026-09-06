import SwiftUI

/// Google·Kakao 브랜드 마크. 데스크탑 AuthScreen.tsx 의 인라인 SVG 를 그대로
/// 옮긴 것이라 두 플랫폼의 로고가 같다. 좌표는 스크립트로 변환했다 —
/// 상대 좌표(c/h/v/s)를 손으로 옮기면 글리프가 틀어진다.
///
/// 원본 viewBox 는 둘 다 `0 0 24 24`.
private enum BrandPath {
  static let viewBox: CGFloat = 24

  // googleBlue — #4285F4
  static func googleBlue(_ path: inout Path) {
    path.move(to: CGPoint(x: 22.56, y: 12.25))
    path.addCurve(to: CGPoint(x: 22.36, y: 10), control1: CGPoint(x: 22.56, y: 11.47), control2: CGPoint(x: 22.49, y: 10.72))
    path.addLine(to: CGPoint(x: 12, y: 10))
    path.addLine(to: CGPoint(x: 12, y: 14.26))
    path.addLine(to: CGPoint(x: 17.92, y: 14.26))
    path.addCurve(to: CGPoint(x: 15.71, y: 17.57), control1: CGPoint(x: 17.66, y: 15.63), control2: CGPoint(x: 16.88, y: 16.79))
    path.addLine(to: CGPoint(x: 15.71, y: 20.34))
    path.addLine(to: CGPoint(x: 19.28, y: 20.34))
    path.addCurve(to: CGPoint(x: 22.56, y: 12.25), control1: CGPoint(x: 21.36, y: 18.42), control2: CGPoint(x: 22.56, y: 15.6))
    path.closeSubpath()
  }

  // googleGreen — #34A853
  static func googleGreen(_ path: inout Path) {
    path.move(to: CGPoint(x: 12, y: 23))
    path.addCurve(to: CGPoint(x: 19.28, y: 20.34), control1: CGPoint(x: 14.97, y: 23), control2: CGPoint(x: 17.46, y: 22.02))
    path.addLine(to: CGPoint(x: 15.71, y: 17.57))
    path.addCurve(to: CGPoint(x: 12, y: 18.63), control1: CGPoint(x: 14.73, y: 18.23), control2: CGPoint(x: 13.48, y: 18.63))
    path.addCurve(to: CGPoint(x: 5.84, y: 14.1), control1: CGPoint(x: 9.14, y: 18.63), control2: CGPoint(x: 6.71, y: 16.7))
    path.addLine(to: CGPoint(x: 2.18, y: 14.1))
    path.addLine(to: CGPoint(x: 2.18, y: 16.94))
    path.addCurve(to: CGPoint(x: 12, y: 23), control1: CGPoint(x: 3.99, y: 20.53), control2: CGPoint(x: 7.7, y: 23))
    path.closeSubpath()
  }

  // googleYellow — #FBBC05
  static func googleYellow(_ path: inout Path) {
    path.move(to: CGPoint(x: 5.84, y: 14.09))
    path.addCurve(to: CGPoint(x: 5.49, y: 12), control1: CGPoint(x: 5.62, y: 13.43), control2: CGPoint(x: 5.49, y: 12.73))
    path.addCurve(to: CGPoint(x: 5.84, y: 9.91), control1: CGPoint(x: 5.49, y: 11.27), control2: CGPoint(x: 5.62, y: 10.57))
    path.addLine(to: CGPoint(x: 5.84, y: 7.06))
    path.addLine(to: CGPoint(x: 2.18, y: 7.06))
    path.addCurve(to: CGPoint(x: 1, y: 12), control1: CGPoint(x: 1.43, y: 8.55), control2: CGPoint(x: 1, y: 10.22))
    path.addCurve(to: CGPoint(x: 2.18, y: 16.94), control1: CGPoint(x: 1, y: 13.78), control2: CGPoint(x: 1.43, y: 15.45))
    path.addLine(to: CGPoint(x: 5.03, y: 14.72))
    path.addLine(to: CGPoint(x: 5.84, y: 14.09))
    path.closeSubpath()
  }

  // googleRed — #EA4335
  static func googleRed(_ path: inout Path) {
    path.move(to: CGPoint(x: 12, y: 5.38))
    path.addCurve(to: CGPoint(x: 16.21, y: 7.02), control1: CGPoint(x: 13.62, y: 5.38), control2: CGPoint(x: 15.06, y: 5.94))
    path.addLine(to: CGPoint(x: 19.36, y: 3.87))
    path.addCurve(to: CGPoint(x: 12, y: 1), control1: CGPoint(x: 17.45, y: 2.09), control2: CGPoint(x: 14.97, y: 1))
    path.addCurve(to: CGPoint(x: 2.18, y: 7.06), control1: CGPoint(x: 7.7, y: 1), control2: CGPoint(x: 3.99, y: 3.47))
    path.addLine(to: CGPoint(x: 5.84, y: 9.9))
    path.addCurve(to: CGPoint(x: 12, y: 5.38), control1: CGPoint(x: 6.71, y: 7.3), control2: CGPoint(x: 9.14, y: 5.38))
    path.closeSubpath()
  }

  // kakaoBubble — #191600
  static func kakaoBubble(_ path: inout Path) {
    path.move(to: CGPoint(x: 12, y: 3))
    path.addCurve(to: CGPoint(x: 3, y: 10.115), control1: CGPoint(x: 7.03, y: 3), control2: CGPoint(x: 3, y: 6.185))
    path.addCurve(to: CGPoint(x: 7.27, y: 16.169), control1: CGPoint(x: 3, y: 12.672), control2: CGPoint(x: 4.707, y: 14.915))
    path.addCurve(to: CGPoint(x: 6.126, y: 20.114), control1: CGPoint(x: 6.993, y: 17.115), control2: CGPoint(x: 6.273, y: 19.594))
    path.addCurve(to: CGPoint(x: 6.581, y: 20.594), control1: CGPoint(x: 5.942, y: 20.76), control2: CGPoint(x: 6.342, y: 20.752))
    path.addCurve(to: CGPoint(x: 10.806, y: 17.784), control1: CGPoint(x: 8.464, y: 19.346), control2: CGPoint(x: 9.599, y: 18.586))
    path.addCurve(to: CGPoint(x: 14.22, y: 18.23), control1: CGPoint(x: 11.883, y: 18.074), control2: CGPoint(x: 13.028, y: 18.23))
    path.addCurve(to: CGPoint(x: 23.22, y: 11.115), control1: CGPoint(x: 19.19, y: 18.23), control2: CGPoint(x: 23.22, y: 15.045))
    path.addCurve(to: CGPoint(x: 12, y: 3), control1: CGPoint(x: 21, y: 6.185), control2: CGPoint(x: 16.97, y: 3))
    path.closeSubpath()
  }
}

/// 24×24 원본을 주어진 크기로 그린다.
private struct BrandGlyph: View {
  let size: CGFloat
  let layers: [(build: (inout Path) -> Void, colour: Color)]

  var body: some View {
    Canvas { context, canvasSize in
      let scale = min(canvasSize.width, canvasSize.height) / BrandPath.viewBox
      context.scaleBy(x: scale, y: scale)
      for layer in layers {
        var path = Path()
        layer.build(&path)
        context.fill(path, with: .color(layer.colour))
      }
    }
    .frame(width: size, height: size)
    .accessibilityHidden(true)
  }
}

struct GoogleGlyph: View {
  var size: CGFloat = 16

  var body: some View {
    BrandGlyph(
      size: size,
      layers: [
        (BrandPath.googleBlue, Color(hex: 0x4285F4)),
        (BrandPath.googleGreen, Color(hex: 0x34A853)),
        (BrandPath.googleYellow, Color(hex: 0xFBBC05)),
        (BrandPath.googleRed, Color(hex: 0xEA4335)),
      ]
    )
  }
}

struct KakaoGlyph: View {
  var size: CGFloat = 16

  var body: some View {
    BrandGlyph(
      size: size,
      layers: [(BrandPath.kakaoBubble, Color(hex: 0x191600))]
    )
  }
}
