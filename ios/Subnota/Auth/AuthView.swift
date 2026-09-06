import AuthenticationServices
import Supabase
import SwiftUI

struct AuthView: View {
  @Environment(SessionStore.self) private var session
  @State private var email = ""
  @State private var password = ""

  /// 데스크탑 `.oauth-custom-btn` 과 같은 치수 (subnota-workspace.scss).
  private static let socialButtonHeight: CGFloat = 44
  private static let corner: CGFloat = 8

  var body: some View {
    ScrollView {
      VStack(spacing: 24) {
        brand
        socialButtons
        divider
        emailForm
      }
      .padding(24)
      .frame(maxWidth: 420)
      .frame(maxWidth: .infinity)
    }
    .scrollBounceBehavior(.basedOnSize)
    .background(Palette.canvas)
  }

  private var brand: some View {
    VStack(spacing: 10) {
      SubnotaMark(size: 44)
      Text("Subnota")
        .font(Typography.wordmark(30))
        .foregroundStyle(Palette.ink)
      Text("정리하지 말고, 작성만 하세요.")
        .font(Typography.ui(13))
        .foregroundStyle(Palette.inkMuted)
    }
    .padding(.top, 48)
    .padding(.bottom, 4)
  }

  private var socialButtons: some View {
    VStack(spacing: 10) {
      Button {
        Task { await session.signIn(with: .google) }
      } label: {
        socialLabel("Google 계정으로 로그인", icon: GoogleGlyph(), tint: Palette.ink)
      }
      .background(Color.white, in: RoundedRectangle(cornerRadius: Self.corner))
      .overlay(
        RoundedRectangle(cornerRadius: Self.corner).stroke(Palette.border)
      )

      Button {
        Task { await session.signIn(with: .kakao) }
      } label: {
        socialLabel("카카오로 로그인", icon: KakaoGlyph(), tint: Color(hex: 0x191600))
      }
      .background(Color(hex: 0xFEE500), in: RoundedRectangle(cornerRadius: Self.corner))

      appleButton
    }
    .disabled(session.isLoading)
  }

  /// Apple 로그인은 자리만 잡아두고 아직 연결하지 않는다 (2026-09-06 결정).
  /// 활성화하려면 Supabase 에 Apple provider 를 설정하고 이 버튼을
  /// `session.signIn(with: .apple)` 로 잇는다.
  private var appleButton: some View {
    SignInWithAppleButton(.signIn) { _ in } onCompletion: { _ in }
      .signInWithAppleButtonStyle(.black)
      .frame(height: Self.socialButtonHeight)
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
    .frame(height: Self.socialButtonHeight)
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
        SecureField("비밀번호", text: $password)
          .textContentType(.password)
      }
      .font(Typography.ui(15))
      .padding(12)
      .background(Palette.chrome, in: RoundedRectangle(cornerRadius: Self.corner))
      .overlay(
        RoundedRectangle(cornerRadius: Self.corner).stroke(Palette.border)
      )

      if let message = session.errorMessage {
        Text(message)
          .font(Typography.ui(12))
          .foregroundStyle(.red)
          .frame(maxWidth: .infinity, alignment: .leading)
      }

      Button {
        Task { await session.signIn(email: email, password: password) }
      } label: {
        Text("로그인")
          .font(Typography.ui(15, weight: .semibold))
          .frame(maxWidth: .infinity)
          .frame(height: Self.socialButtonHeight)
      }
      .background(Palette.brand, in: RoundedRectangle(cornerRadius: Self.corner))
      .foregroundStyle(.white)
      .disabled(email.isEmpty || password.isEmpty || session.isLoading)
    }
  }
}
