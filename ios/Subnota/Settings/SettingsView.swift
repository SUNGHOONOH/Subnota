import SwiftUI

struct SettingsView: View {
  @Environment(SessionStore.self) private var session
  @AppStorage(ThemeSetting.storageKey) private var theme: ThemeSetting = .system

  var body: some View {
    List {
      Section("계정") {
        LabeledContent("이메일") {
          // OAuth 로 들어온 계정도 이메일은 온다. 그래도 비어 있을 수 있으니
          // 빈 줄 대신 자리를 표시한다.
          Text(session.email ?? "—")
            .font(Typography.ui(15))
            .foregroundStyle(Palette.inkMuted)
        }
        .font(Typography.ui(15))
        .foregroundStyle(Palette.ink)
      }
      .listRowBackground(Palette.chrome)

      Section("화면") {
        Picker("테마", selection: $theme) {
          ForEach(ThemeSetting.allCases) { setting in
            Text(setting.label).tag(setting)
          }
        }
        .font(Typography.ui(15))
        .foregroundStyle(Palette.ink)
        .tint(Palette.brand)
      }
      .listRowBackground(Palette.chrome)

      Section {
        Button("로그아웃") {
          Task { await session.signOut() }
        }
        .font(Typography.ui(15))
        .foregroundStyle(Palette.ink)

        // 계정 삭제 자리. 동작은 Task 4 에서 붙인다. 그때까지는 누를 수 없는
        // 행으로 두어 "눌러도 아무 일이 없는 버튼"을 남기지 않는다.
        LabeledContent {
          Text("준비 중")
            .font(Typography.ui(13))
            .foregroundStyle(Palette.inkMuted)
        } label: {
          Text("계정 삭제")
            .font(Typography.ui(15))
            .foregroundStyle(Palette.danger.opacity(0.5))
        }
      }
      .listRowBackground(Palette.chrome)
    }
    .scrollContentBackground(.hidden)
    .background(Palette.canvas)
    .navigationTitle("설정")
    .navigationBarTitleDisplayMode(.inline)
  }
}
