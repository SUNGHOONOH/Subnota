import SubnotaKit
import SwiftUI

/// 비밀번호 확인 필드. 데스크탑 `PasswordConfirmInput.tsx` 를 그대로 옮긴 것이다.
///
/// 네이티브 입력의 글자는 감추고 그 위에 우리가 글자 행을 그린다 — 입력한 글자
/// 하나하나가 초록(그 자리가 맞음) 또는 빨강(틀림) 알약에 담긴다. 필드 전체가
/// 맞았는지가 아니라 **몇 번째 글자부터 어긋났는지**가 보이는 게 요점이다.
///
/// 원본 길이를 넘겨 입력하면 받지 않고 흔든다. 완전히 일치하면 테두리가
/// 브랜드색이 된다.
struct PasswordConfirmField: View {
  let passwordToMatch: String
  @Binding var value: String
  var showPassword = false
  var placeholder = "비밀번호를 한 번 더 입력"

  @State private var shake = false
  @FocusState private var isFocused: Bool

  /// 데스크탑 `.pw-confirm-*` 치수.
  private static let boxHeight: CGFloat = 44
  private static let corner: CGFloat = 8
  private static let pillMinWidth: CGFloat = 16
  private static let pillHeight: CGFloat = 24
  private static let pillCorner: CGFloat = 5
  private static let pillGap: CGFloat = 3
  private static let dotSize: CGFloat = 6

  private var matches: Bool {
    PasswordMatch.isComplete(typed: value, against: passwordToMatch)
  }

  /// 글자별 일치 여부. 판정은 SubnotaKit 의 순수 함수가 하고 뷰는 칠하기만 한다.
  private var marks: [Bool] {
    PasswordMatch.marks(typed: value, against: passwordToMatch)
  }

  var body: some View {
    ZStack(alignment: .leading) {
      // 캐럿만 보이는 실제 입력. 글자는 알약이 대신 그린다.
      //
      // Binding(get:set:) 으로 길이를 막으려 하면 Swift 6.3.3 의 IR 생성이
      // 크래시한다(@MainActor 격리 클로저의 리앱스트랙션 썽크). onChange 로
      // 되돌리는 쪽이 같은 결과를 내면서 컴파일된다.
      TextField("", text: $value)
        .textContentType(.newPassword)
        .textInputAutocapitalization(.never)
        .autocorrectionDisabled()
        .font(Typography.ui(15))
        .foregroundStyle(.clear)
        .tint(Palette.brand)
        .focused($isFocused)
        .padding(.horizontal, 12)
        .onChange(of: value) { previous, next in
          guard next.count > passwordToMatch.count else { return }
          value = previous
          shake = true
          Task {
            try? await Task.sleep(for: .milliseconds(500))
            shake = false
          }
        }

      if value.isEmpty {
        Text(placeholder)
          .font(Typography.ui(15))
          .foregroundStyle(Palette.inkMuted)
          .padding(.horizontal, 12)
          .allowsHitTesting(false)
      } else {
        pills.padding(.horizontal, 12).allowsHitTesting(false)
      }
    }
    .frame(height: Self.boxHeight)
    .background(Palette.chrome, in: RoundedRectangle(cornerRadius: Self.corner))
    .overlay(
      RoundedRectangle(cornerRadius: Self.corner)
        .stroke(matches ? Palette.brand : Palette.border)
    )
    .offset(x: shake ? 8 : 0)
    .animation(
      shake
        ? .default.repeatCount(4, autoreverses: true).speed(9)
        : .easeOut(duration: 0.3),
      value: shake
    )
    .animation(.easeOut(duration: 0.3), value: matches)
    .contentShape(Rectangle())
    .onTapGesture { isFocused = true }
    .accessibilityElement(children: .ignore)
    .accessibilityLabel("비밀번호 확인")
    .accessibilityValue(spokenState)
  }

  private var pills: some View {
    HStack(spacing: Self.pillGap) {
      ForEach(Array(zip(value, marks).enumerated()), id: \.offset) { index, pair in
        pill(character: pair.0, isCorrect: pair.1).id(index)
      }
      Spacer(minLength: 0)
    }
  }

  private func pill(character: Character, isCorrect: Bool) -> some View {
    Group {
      if showPassword {
        Text(String(character))
          .font(Typography.ui(13))
          .foregroundStyle(Palette.ink)
      } else {
        Circle()
          .fill(Palette.ink)
          .frame(width: Self.dotSize, height: Self.dotSize)
      }
    }
    .frame(minWidth: Self.pillMinWidth)
    .frame(height: Self.pillHeight)
    .padding(.horizontal, 4)
    .background(
      (isCorrect ? Palette.success : Palette.danger).opacity(0.22),
      in: RoundedRectangle(cornerRadius: Self.pillCorner)
    )
    .transition(.scale(scale: 0.6).combined(with: .opacity))
  }

  private var spokenState: String {
    if value.isEmpty { return "미입력" }
    if matches { return "비밀번호가 일치합니다" }
    if let wrong = PasswordMatch.firstMismatch(typed: value, against: passwordToMatch) {
      return "\(wrong + 1)번째 글자부터 일치하지 않습니다"
    }
    return "\(value.count)자 입력, 아직 다 입력하지 않았습니다"
  }
}
