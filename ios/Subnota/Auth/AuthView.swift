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
        if isSignUp {
          SecureField("비밀번호 확인", text: $passwordConfirmation)
            .textContentType(.newPassword)
        }
      }
      .font(Typography.ui(15))
      .padding(12)
      .background(Palette.chrome, in: RoundedRectangle(cornerRadius: Self.corner))
      .overlay(RoundedRectangle(cornerRadius: Self.corner).stroke(Palette.border))

      if isSignUp, !password.isEmpty {
        passwordChecklist
      }
      if isSignUp, !passwordConfirmation.isEmpty, !passwordsMatch {
        hint("비밀번호가 일치하지 않습니다.", colour: .red)
      }
      if let message = session.errorMessage {
        hint(message, colour: .red)
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
