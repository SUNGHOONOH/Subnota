import SwiftUI
import SubnotaKit

/// App Store 심사 지침 5.1.1(v) — 앱에서 계정을 만들 수 있으면 앱에서 지울 수도
/// 있어야 한다. 확인 절차는 데스크탑 `SettingsModal.tsx` 를 그대로 옮긴 것이다.
struct DeleteAccountSheet: View {
  /// 데스크탑 `SettingsModal.tsx:1547` — 한국어 UI 의 확인 단어.
  private static let confirmWord = "삭제"

  @Environment(SessionStore.self) private var session
  @Environment(\.dismiss) private var dismiss

  @State private var typed = ""
  @State private var isDeleting = false
  @State private var errorMessage: String?

  /// 앞뒤 공백만 걷어내고 정확히 일치해야 한다 — 비슷한 입력으로 열리면 확인
  /// 절차가 아니라 장식이다.
  private var confirmed: Bool {
    typed.trimmingCharacters(in: .whitespacesAndNewlines) == Self.confirmWord
  }

  private var canSubmit: Bool { confirmed && !isDeleting }

  var body: some View {
    NavigationStack {
      List {
        Section {
          Text("계정과 저장된 데이터를 삭제합니다. 이 작업은 되돌릴 수 없습니다.")
            .font(Typography.ui(15))
            .foregroundStyle(Palette.ink)
          Text("계속하려면 아래에 ‘\(Self.confirmWord)’를 입력하세요.")
            .font(Typography.ui(13))
            .foregroundStyle(Palette.inkMuted)
          TextField(Self.confirmWord, text: $typed)
            .font(Typography.ui(15))
            .foregroundStyle(Palette.ink)
            .autocorrectionDisabled()
            .textInputAutocapitalization(.never)
            .disabled(isDeleting)
            .accessibilityLabel("계정 삭제 확인")
          if let errorMessage {
            Text(errorMessage)
              .font(Typography.ui(13))
              .foregroundStyle(Palette.danger)
          }
        }
        .listRowBackground(Palette.chrome)

        Section {
          Button {
            Task { await submit() }
          } label: {
            Text(buttonLabel)
              .font(Typography.ui(15, weight: .semibold))
              // 파괴적 동작에는 브랜드색을 쓰지 않는다. 색을 직접 주면 비활성
              // 흐리기가 먹지 않으므로 여기서 같이 흐린다 — 안 그러면 눌리지도
              // 않는 버튼이 눌릴 것처럼 보인다.
              .foregroundStyle(canSubmit ? Palette.danger : Palette.danger.opacity(0.4))
          }
          .disabled(!canSubmit)
        }
        .listRowBackground(Palette.chrome)
      }
      .scrollContentBackground(.hidden)
      .background(Palette.canvas)
      .navigationTitle("계정 삭제")
      .navigationBarTitleDisplayMode(.inline)
      .toolbar {
        ToolbarItem(placement: .cancellationAction) {
          Button("취소") { dismiss() }
            .tint(Palette.inkMuted)
            .disabled(isDeleting)
        }
      }
    }
    // 진행 중에는 닫을 수 없다. 서버 삭제와 로컬 정리 사이에서 화면이 사라지면
    // 정리가 끝났는지 사용자가 알 방법이 없다.
    .interactiveDismissDisabled(isDeleting)
  }

  private var buttonLabel: String {
    if isDeleting { return "삭제 중…" }
    return errorMessage == nil ? "삭제" : "다시 시도"
  }

  /// 순서가 계약이다 (데스크탑 `App.tsx` 의 `handleDeleteAccount`):
  /// 서버 삭제 → 로컬 전삭제 → 로컬 로그아웃. 로컬을 먼저 지우고 서버 호출이
  /// 실패하면 계정은 살아 있는데 이 기기의 데이터만 사라진다.
  ///
  /// 데스크탑의 첫 단계(진행 중인 색인·동기화 취소)에 해당하는 것은 이 시트로
  /// 들어오는 문(`SettingsView`)에 있다 — 동기화 중에는 아예 들어올 수 없고,
  /// 설정 화면이 떠 있는 동안에는 새 동기화가 시작되지 않는다.
  private func submit() async {
    guard confirmed, !isDeleting, let ownerId = session.userId else { return }
    isDeleting = true
    errorMessage = nil

    do {
      try await AccountService().deleteAccount()
    } catch {
      // 서버가 못 지웠으면 로컬은 손대지 않는다. 그대로 다시 시도할 수 있다.
      isDeleting = false
      errorMessage = (error as? AccountError ?? .temporarilyUnavailable).localizedDescription
      return
    }

    // 계정은 이미 없다. 로컬 정리가 실패해도 로그아웃은 그대로 하고 안내만 바꾼다.
    // 새 핸들을 여는 이유: 목록 화면의 LocalStore 는 여기서 닿지 않고, 지금은
    // 동기화가 돌지 않는 것이 보장돼 있어 같은 파일을 두 번 열어도 다투지 않는다.
    var cleanupFailed = false
    do {
      try LocalStore(path: AppGroup.databaseURL()).clearOwner(ownerId)
    } catch {
      cleanupFailed = true
    }

    session.noticeMessage = cleanupFailed
      ? "계정은 삭제되었지만 이 기기의 일부 데이터 정리에 문제가 있습니다. 앱을 다시 시작해 주세요."
      : "계정과 데이터가 삭제되었습니다."
    await session.signOutAfterAccountDeletion()
  }
}
