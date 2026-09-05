import SwiftUI

struct AuthView: View {
  @Environment(SessionStore.self) private var session
  @State private var email = ""
  @State private var password = ""

  var body: some View {
    VStack(spacing: 20) {
      Text("Subnota")
        .font(Typography.wordmark(30))
        .foregroundStyle(Palette.ink)

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
      .background(Palette.chrome, in: RoundedRectangle(cornerRadius: 8))
      .overlay(RoundedRectangle(cornerRadius: 8).stroke(Palette.border))

      if let message = session.errorMessage {
        Text(message)
          .font(Typography.ui(12))
          .foregroundStyle(.red)
      }

      Button {
        Task { await session.signIn(email: email, password: password) }
      } label: {
        Text("로그인")
          .font(Typography.ui(15, weight: .semibold))
          .frame(maxWidth: .infinity)
          .padding(.vertical, 12)
      }
      .background(Palette.brand, in: RoundedRectangle(cornerRadius: 8))
      .foregroundStyle(.white)
      .disabled(email.isEmpty || password.isEmpty)
    }
    .padding(24)
    .frame(maxHeight: .infinity)
    .background(Palette.canvas)
  }
}
