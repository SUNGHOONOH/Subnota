import SwiftUI
import SubnotaKit

struct MemoListView: View {
  @Environment(SessionStore.self) private var session
  @State private var model: MemoListModel?
  @State private var openedMemo: Memo?
  @State private var showingTrash = false
  @State private var showingSettings = false

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
        ToolbarItem(placement: .topBarTrailing) {
          Button {
            showingTrash = true
          } label: {
            Image(systemName: "trash").accessibilityLabel("휴지통")
          }
          .tint(Palette.inkMuted)
          .disabled(model == nil)
        }
        ToolbarItem(placement: .topBarLeading) {
          Button {
            showingSettings = true
          } label: {
            Image(systemName: "gearshape").accessibilityLabel("설정")
          }
          .tint(Palette.inkMuted)
        }
      }
      .navigationDestination(item: $openedMemo) { memo in
        MemoEditorView(memo: memo) { edited in
          model?.save(edited)
        }
      }
      .navigationDestination(isPresented: $showingTrash) {
        if let model { TrashView(model: model) }
      }
      .navigationDestination(isPresented: $showingSettings) {
        SettingsView(sync: model?.sync)
      }
    }
    // 첫 진입에서 한 번 맞춘다. 빈 상태에는 당길 목록이 없어서 새로고침 제스처만
    // 두면 새 기기가 서버 메모를 영영 못 받는다.
    .task {
      if model == nil, let ownerId = session.userId {
        model = MemoListModel(ownerId: ownerId)
      }
      model?.load()
      await model?.syncNow()
    }
    // 에디터에서 돌아왔을 때 목록을 다시 읽는다.
    .onAppear { model?.load() }
  }

  @ViewBuilder
  private func content(_ model: MemoListModel) -> some View {
    VStack(spacing: 0) {
      if let notice = model.notice {
        Text(notice)
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
        .listRowBackground(Color.clear)
      }
      .listStyle(.plain)
      // List 가 제 배경을 칠하면 다크에서 순흑이 되어 Palette.canvas 를 덮는다
      // — 제목 영역과 목록 사이에 이음매가 보인다. 에디터도 같은 이유로 숨긴다.
      .scrollContentBackground(.hidden)
      .refreshable { await model.syncNow() }
    }
  }

  private func row(_ memo: Memo) -> some View {
    VStack(alignment: .leading, spacing: 3) {
      Text(memo.listTitle)
        .font(Typography.ui(15, weight: .medium))
        .foregroundStyle(Palette.ink)
        .lineLimit(1)
      Text(memo.contentUpdatedAt.formatted(date: .abbreviated, time: .shortened))
        .font(Typography.ui(11))
        .foregroundStyle(Palette.inkMuted)
    }
    .frame(maxWidth: .infinity, alignment: .leading)
  }
}

extension Memo {
  /// 목록 행 제목 — 첫 줄. 데스크탑 사이드바와 같은 규칙이다. 휴지통도 같이 쓴다.
  var listTitle: String {
    let firstLine = content.split(separator: "\n", omittingEmptySubsequences: false).first ?? ""
    let trimmed = firstLine.trimmingCharacters(in: .whitespaces)
    return trimmed.isEmpty ? "제목 없음" : trimmed
  }
}
