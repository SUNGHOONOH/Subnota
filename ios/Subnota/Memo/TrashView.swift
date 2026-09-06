import SwiftUI
import SubnotaKit

struct TrashView: View {
  let model: MemoListModel
  @State private var confirmingEmpty = false
  @State private var showingOfflineNotice = false

  var body: some View {
    Group {
      if model.trashed.isEmpty {
        emptyState
      } else {
        list
      }
    }
    .background(Palette.canvas)
    .navigationTitle("휴지통")
    .navigationBarTitleDisplayMode(.inline)
    .toolbar {
      ToolbarItem(placement: .topBarTrailing) {
        Button("비우기") {
          // 오프라인이면 아무것도 지우지 않는다. 로컬만 지우면 사용자가 없앤 줄
          // 아는 내용이 서버에 계속 남는다.
          if model.isOnline { confirmingEmpty = true } else { showingOfflineNotice = true }
        }
        .font(Typography.ui(15))
        .tint(Palette.danger)
        .disabled(model.trashed.isEmpty || model.isSyncing)
      }
    }
    .confirmationDialog(
      "휴지통을 비울까요?", isPresented: $confirmingEmpty, titleVisibility: .visible
    ) {
      Button("메모 \(model.trashed.count)개 영구 삭제", role: .destructive) {
        Task { await model.emptyTrash() }
      }
      Button("취소", role: .cancel) {}
    } message: {
      Text("이 기기와 서버에서 완전히 사라집니다. 되돌릴 수 없습니다.")
    }
    .alert("오프라인입니다", isPresented: $showingOfflineNotice) {
      Button("확인", role: .cancel) {}
    } message: {
      Text("영구 삭제는 서버에서도 지워야 합니다. 연결된 뒤에 다시 시도해 주세요.")
    }
  }

  private var emptyState: some View {
    VStack(spacing: 6) {
      Text("휴지통이 비어 있습니다")
        .font(Typography.ui(15, weight: .medium))
        .foregroundStyle(Palette.ink)
      Text("지운 메모가 여기에 모입니다")
        .font(Typography.ui(13))
        .foregroundStyle(Palette.inkMuted)
    }
    .frame(maxWidth: .infinity, maxHeight: .infinity)
  }

  private var list: some View {
    VStack(spacing: 0) {
      if let notice = model.notice {
        Text(notice)
          .font(Typography.ui(12))
          .foregroundStyle(Palette.inkMuted)
          .padding(.horizontal, 16)
          .padding(.vertical, 8)
      }
      List(model.trashed) { memo in
        HStack(spacing: 12) {
          VStack(alignment: .leading, spacing: 3) {
            Text(memo.listTitle)
              .font(Typography.ui(15, weight: .medium))
              .foregroundStyle(Palette.ink)
              .lineLimit(1)
            Text(memo.contentUpdatedAt.formatted(date: .abbreviated, time: .shortened))
              .font(Typography.ui(11))
              .foregroundStyle(Palette.inkMuted)
          }
          Spacer(minLength: 0)
          Button("되돌리기") { model.restore(memo) }
            .font(Typography.ui(13))
            .buttonStyle(.borderless)
            .tint(Palette.ink)
        }
      }
      .listStyle(.plain)
    }
  }
}
