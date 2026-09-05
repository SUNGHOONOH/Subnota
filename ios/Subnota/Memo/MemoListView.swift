import SwiftUI
import SubnotaKit

struct MemoListView: View {
  @Environment(SessionStore.self) private var session
  @State private var model: MemoListModel?
  @State private var openedMemo: Memo?

  var body: some View {
    NavigationStack {
      Group {
        if let model {
          content(model)
        } else {
          ProgressView().tint(Palette.brand)
        }
      }
      .background(Palette.canvas)
      .navigationTitle("메모")
      .toolbar {
        ToolbarItem(placement: .topBarTrailing) {
          Button {
            if let created = model?.create() { openedMemo = created }
          } label: {
            Image(systemName: "square.and.pencil")
          }
          .tint(Palette.brand)
        }
        ToolbarItem(placement: .topBarLeading) {
          Button {
            Task { await session.signOut() }
          } label: {
            Image(systemName: "gearshape")
          }
          .tint(Palette.inkMuted)
        }
      }
      .navigationDestination(item: $openedMemo) { memo in
        MemoEditorView(memo: memo) { edited in
          model?.save(edited)
        }
      }
    }
    .onAppear {
      if model == nil, let ownerId = session.userId {
        model = MemoListModel(ownerId: ownerId)
      }
      model?.load()
    }
  }

  @ViewBuilder
  private func content(_ model: MemoListModel) -> some View {
    VStack(spacing: 0) {
      if let loadError = model.loadError {
        Text(loadError)
          .font(Typography.ui(12))
          .foregroundStyle(Palette.inkMuted)
          .padding(.horizontal, 16)
          .padding(.vertical, 8)
      }
      listOrEmptyState(model)
    }
  }

  @ViewBuilder
  private func listOrEmptyState(_ model: MemoListModel) -> some View {
    if model.memos.isEmpty {
      VStack(spacing: 6) {
        Text("아직 메모가 없습니다").font(Typography.ui(15, weight: .medium)).foregroundStyle(Palette.ink)
        Text("오른쪽 위 버튼으로 시작하세요").font(Typography.ui(13)).foregroundStyle(Palette.inkMuted)
      }
      .frame(maxWidth: .infinity, maxHeight: .infinity)
    } else {
      List {
        ForEach(model.memos) { memo in
          Button { openedMemo = memo } label: { row(memo) }
        }
        .onDelete { offsets in
          offsets.map { model.memos[$0] }.forEach(model.delete)
        }
      }
      .listStyle(.plain)
    }
  }

  private func row(_ memo: Memo) -> some View {
    VStack(alignment: .leading, spacing: 3) {
      Text(title(of: memo))
        .font(Typography.ui(15, weight: .medium))
        .foregroundStyle(Palette.ink)
        .lineLimit(1)
      Text(memo.contentUpdatedAt.formatted(date: .abbreviated, time: .shortened))
        .font(Typography.ui(11))
        .foregroundStyle(Palette.inkMuted)
    }
    .frame(maxWidth: .infinity, alignment: .leading)
  }

  private func title(of memo: Memo) -> String {
    let firstLine = memo.content.split(separator: "\n", omittingEmptySubsequences: false).first ?? ""
    let trimmed = firstLine.trimmingCharacters(in: .whitespaces)
    return trimmed.isEmpty ? "제목 없음" : trimmed
  }
}
