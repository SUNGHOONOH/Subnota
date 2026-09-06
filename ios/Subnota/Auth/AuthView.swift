import AuthenticationServices
import Supabase
import SwiftUI

struct AuthView: View {
  @Environment(SessionStore.self) private var session
  @State private var email = ""
  @State private var password = ""
  @State private var passwordConfirmation = ""
  @State private var isSignUp = false

  /// 데스크탑 `.oauth-custom-btn` 과 같은 치수 (subnota-workspace.scss).
  private static let buttonHeight: CGFloat = 44
  private static let corner: CGFloat = 8

  private var passwordsMatch: Bool { password == passwordConfirmation }

  private var canSubmit: Bool {
    guard !email.isEmpty, !password.isEmpty, !session.isBusy else { return false }
    guard isSignUp else { return true }
    return SessionStore.isStrongPassword(password) && passwordsMatch
  }

  var body: some View {
    ScrollView {
      VStack(spacing: 24) {
        brand
        socialButtons
        divider
        emailForm
        modeToggle
        legalNotice
      }
      .padding(24)
      .frame(maxWidth: 420)
      .frame(maxWidth: .infinity)
    }
    .scrollBounceBehavior(.basedOnSize)
    .scrollDismissesKeyboard(.interactively)
    .background(Palette.canvas)
  }

  private var brand: some View {
    VStack(spacing: 10) {
      Image("SubnotaGlassMark")
        .resizable()
        .scaledToFit()
        .frame(width: 68, height: 68)
        .accessibilityHidden(true)
      Text("Subnota")
        .font(Typography.wordmark(30))
        .foregroundStyle(Palette.ink)
      Text(isSignUp ? "Subnota 시작하기" : "정리하지 말고, 작성만 하세요.")
        .font(Typography.ui(13))
        .foregroundStyle(Palette.inkMuted)
    }
    .padding(.top, 40)
  }

  private var socialButtons: some View {
    VStack(spacing: 10) {
      Button {
        Task { await session.signIn(with: .google) }
      } label: {
        socialLabel("Google 계정으로 로그인", icon: GoogleGlyph(), tint: Palette.ink)
      }
      .background(Color.white, in: RoundedRectangle(cornerRadius: Self.corner))
      .overlay(RoundedRectangle(cornerRadius: Self.corner).stroke(Palette.border))

      Button {
        Task { await session.signIn(with: .kakao) }
      } label: {
        socialLabel("카카오로 로그인", icon: KakaoGlyph(), tint: Color(hex: 0x191600))
      }
      .background(Color(hex: 0xFEE500), in: RoundedRectangle(cornerRadius: Self.corner))

      appleButton
    }
    .disabled(session.isBusy)
  }

  /// Apple 로그인은 자리만 잡아두고 아직 연결하지 않는다 (2026-09-06 결정).
  /// 활성화하려면 Supabase 에 Apple provider 를 설정하고 이 버튼을
  /// `session.signIn(with: .apple)` 로 잇는다.
  private var appleButton: some View {
    SignInWithAppleButton(.signIn) { _ in } onCompletion: { _ in }
      .signInWithAppleButtonStyle(.black)
      .frame(height: Self.buttonHeight)
      .clipShape(RoundedRectangle(cornerRadius: Self.corner))
      .disabled(true)
      .opacity(0.4)
      .accessibilityLabel("Apple로 로그인 — 준비 중")
  }

  private func socialLabel(
    _ title: String,
    icon: some View,
    tint: Color
  ) -> some View {
    HStack(spacing: 10) {
      icon
      Text(title).font(Typography.ui(14, weight: .medium))
    }
    .foregroundStyle(tint)
    .frame(maxWidth: .infinity)
    .frame(height: Self.buttonHeight)
  }

  private var divider: some View {
    HStack(spacing: 12) {
      Rectangle().fill(Palette.border).frame(height: 1)
      Text("또는").font(Typography.ui(11)).foregroundStyle(Palette.inkMuted)
      Rectangle().fill(Palette.border).frame(height: 1)
    }
  }

  /// 비밀번호 확인 필드의 상태. 색만으로 알리면 색각 이상 사용자가 못 보므로
  /// 아이콘과 접근성 라벨을 함께 붙인다.
  private enum ConfirmationState {
    case empty, matching, mismatched

    var tint: Color? {
      switch self {
      case .empty: nil
      case .matching: Palette.success
      case .mismatched: Palette.danger
      }
    }

    var icon: String? {
      switch self {
      case .empty: nil
      case .matching: "checkmark.circle.fill"
      case .mismatched: "exclamationmark.circle.fill"
      }
    }

    var spokenState: String {
      switch self {
      case .empty: "미입력"
      case .matching: "비밀번호가 일치합니다"
      case .mismatched: "비밀번호가 일치하지 않습니다"
      }
    }
  }

  private var confirmationState: ConfirmationState {
    if passwordConfirmation.isEmpty { return .empty }
    return passwordsMatch ? .matching : .mismatched
  }

  private var emailForm: some View {
    VStack(spacing: 12) {
      VStack(spacing: 10) {
        TextField("이메일", text: $email)
          .textContentType(.emailAddress)
          .keyboardType(.emailAddress)
          .textInputAutocapitalization(.never)
          .autocorrectionDisabled()
        SecureField(
          isSignUp ? "비밀번호 (8자 이상)" : "비밀번호",
          text: $password
        )
        .textContentType(isSignUp ? .newPassword : .password)
      }
      .font(Typography.ui(15))
      .padding(12)
      .background(Palette.chrome, in: RoundedRectangle(cornerRadius: Self.corner))
      .overlay(RoundedRectangle(cornerRadius: Self.corner).stroke(Palette.border))

      if isSignUp {
        confirmationField
      }
      if isSignUp, !password.isEmpty {
        passwordChecklist
      }
      if let message = session.errorMessage {
        hint(message, colour: Palette.danger)
      }
      if let notice = session.noticeMessage {
        hint(notice, colour: Palette.inkMuted)
      }

      Button {
        Task {
          if isSignUp {
            await session.signUp(email: email, password: password)
          } else {
            await session.signIn(email: email, password: password)
          }
        }
      } label: {
        Text(isSignUp ? "이메일로 가입" : "로그인")
          .font(Typography.ui(15, weight: .semibold))
          .frame(maxWidth: .infinity)
          .frame(height: Self.buttonHeight)
      }
      .background(Palette.brand, in: RoundedRectangle(cornerRadius: Self.corner))
      .foregroundStyle(.white)
      .opacity(canSubmit ? 1 : 0.5)
      .disabled(!canSubmit)
    }
  }

  /// 일치하면 초록, 어긋나면 빨강으로 옅게 덮는다. 워시는 아주 낮은 불투명도라
  /// 브랜드색과 경쟁하지 않고, 테두리와 아이콘이 실제 신호를 담당한다.
  private var confirmationField: some View {
    let state = confirmationState
    return HStack(spacing: 8) {
      SecureField("비밀번호 확인", text: $passwordConfirmation)
        .textContentType(.newPassword)
        .font(Typography.ui(15))
      if let icon = state.icon, let tint = state.tint {
        Image(systemName: icon)
          .font(.system(size: 15))
          .foregroundStyle(tint)
          .transition(.opacity)
      }
    }
    .padding(12)
    .background(
      (state.tint ?? Palette.chrome).opacity(state.tint == nil ? 1 : 0.08),
      in: RoundedRectangle(cornerRadius: Self.corner)
    )
    .overlay(
      RoundedRectangle(cornerRadius: Self.corner)
        .stroke(state.tint ?? Palette.border)
    )
    .animation(.easeOut(duration: 0.15), value: state.spokenState)
    .accessibilityElement(children: .combine)
    .accessibilityLabel("비밀번호 확인")
    .accessibilityValue(state.spokenState)
  }

  /// 데스크탑과 같은 네 가지 조건을 그대로 보여준다.
  private var passwordChecklist: some View {
    VStack(alignment: .leading, spacing: 4) {
      requirement("8자 이상", met: password.count >= 8)
      requirement("소문자 포함", met: password.contains(where: \.isLowercase))
      requirement("대문자 포함", met: password.contains(where: \.isUppercase))
      requirement("숫자 포함", met: password.contains(where: \.isNumber))
    }
    .frame(maxWidth: .infinity, alignment: .leading)
  }

  private func requirement(_ text: String, met: Bool) -> some View {
    HStack(spacing: 6) {
      Image(systemName: met ? "checkmark.circle.fill" : "circle")
        .font(.system(size: 11))
      Text(text).font(Typography.ui(11))
    }
    .foregroundStyle(met ? Palette.brand : Palette.inkMuted)
    .accessibilityLabel("\(text) — \(met ? "충족" : "미충족")")
  }

  private func hint(_ text: String, colour: Color) -> some View {
    Text(text)
      .font(Typography.ui(12))
      .foregroundStyle(colour)
      .frame(maxWidth: .infinity, alignment: .leading)
  }

  /// 데스크탑 AuthScreen 의 `.auth-legal-notice` 와 같은 문구·같은 URL 을 쓴다.
  /// App Store 심사 지침 5.1.1 은 앱 안에서 개인정보 처리방침에 접근할 수 있을 것을
  /// 요구한다 — 설정에만 두지 않고 가입 지점에도 둔다.
  private var legalNotice: some View {
    let terms = URL(string: "https://subnota.com/terms")!
    let privacy = URL(string: "https://subnota.com/privacy")!
    return Group {
      Text("계속하면 ")
        + Text(AttributedString("서비스 이용약관", attributes: linkStyle(terms)))
        + Text("에 동의하며, ")
        + Text(AttributedString("개인정보 처리방침", attributes: linkStyle(privacy)))
        + Text("에 따라 개인정보가 처리됩니다.")
    }
    .font(Typography.ui(11))
    .foregroundStyle(Palette.inkMuted)
    .multilineTextAlignment(.center)
    .padding(.top, 4)
    .padding(.bottom, 24)
  }

  private func linkStyle(_ url: URL) -> AttributeContainer {
    var container = AttributeContainer()
    container.link = url
    container.foregroundColor = Palette.inkMuted
    container.underlineStyle = .single
    return container
  }

  private var modeToggle: some View {
    Button {
      isSignUp.toggle()
      passwordConfirmation = ""
      session.errorMessage = nil
      session.noticeMessage = nil
    } label: {
      Text(isSignUp ? "이미 계정이 있으신가요? 로그인" : "계정이 없으신가요? 회원가입")
        .font(Typography.ui(13))
        .foregroundStyle(Palette.brand)
    }
    .disabled(session.isBusy)
  }
}
