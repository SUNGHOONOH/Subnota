import SwiftUI

struct SettingsView: View {
  /// 계정 삭제의 사전 조건을 읽는 데만 쓴다. 로컬 저장소를 못 연 기기에서는
  /// nil 이고, 그때는 낙관적으로 열어 둔다 — 서버가 먼저이므로 오프라인이면
  /// 삭제가 실패할 뿐 데이터가 사라지지는 않는다.
  let sync: SyncService?

  @Environment(SessionStore.self) private var session
  @AppStorage(ThemeSetting.storageKey) private var theme: ThemeSetting = .system
  @State private var showingDelete = false

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

      Section("검색") {
        NavigationLink {
          SearchModelView()
        } label: {
          LabeledContent("검색 모델") {
            Text(SearchModelStore.shared.phase.summary)
              .font(Typography.ui(15))
              .foregroundStyle(Palette.inkMuted)
          }
          .font(Typography.ui(15))
          .foregroundStyle(Palette.ink)
        }
      }
      .listRowBackground(Palette.chrome)

      Section {
        Button("로그아웃") {
          Task { await session.signOut() }
        }
        .font(Typography.ui(15))
        .foregroundStyle(Palette.ink)

        Button("계정 삭제") { showingDelete = true }
          .font(Typography.ui(15))
          // 색을 직접 주면 비활성 흐리기가 먹지 않는다 — 막혀 있을 때도 눌릴
          // 것처럼 보이면 아래 안내를 아무도 읽지 않는다.
          .foregroundStyle(deleteBlockReason == nil ? Palette.danger : Palette.danger.opacity(0.4))
          .disabled(deleteBlockReason != nil)
      } footer: {
        Text(deleteBlockReason ?? "계정, 서버 데이터, 이 기기의 로컬 데이터를 모두 삭제합니다.")
          .font(Typography.ui(12))
          .foregroundStyle(Palette.inkMuted)
      }
      .listRowBackground(Palette.chrome)
    }
    .scrollContentBackground(.hidden)
    .background(Palette.canvas)
    .navigationTitle("설정")
    .navigationBarTitleDisplayMode(.inline)
    .sheet(isPresented: $showingDelete) { DeleteAccountSheet() }
  }

  /// 삭제를 막아야 하는 이유. nil 이면 열어 준다.
  private var deleteBlockReason: String? {
    // 데스크탑은 삭제 전에 진행 중인 색인·동기화를 취소한다. 여기서는 취소 대신
    // 들여보내지 않는다 — 삭제 뒤에 pull 이 끝나면 지운 메모가 다시 깔리고,
    // push 가 끝나면 이미 없는 계정으로 메모를 올린다. 설정 화면이 떠 있는 동안
    // 새 동기화는 시작되지 않으므로 여기만 막으면 충분하다.
    if sync?.isSyncing == true { return "동기화가 끝난 뒤에 삭제할 수 있습니다." }
    // 로컬만 지우고 서버가 남으면 다음 로그인에서 계정이 되살아난다.
    if sync?.isOnline == false { return "계정 삭제는 인터넷 연결이 필요합니다." }
    if BackendConfig.baseURL == nil { return AccountError.notConfigured.localizedDescription }
    return nil
  }
}
