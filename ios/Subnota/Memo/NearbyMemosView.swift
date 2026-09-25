import SubnotaKit
import SwiftUI

/// 수동 🔍 시트의 상태. 시트는 하나라 id 가 고정이다 — 로딩에서 결과로 바뀌어도
/// 다시 올라오지 않고 내용만 바뀐다.
enum NearbySearchState: Identifiable {
  case loading
  case results([NearbyMemo])
  case failed

  var id: Int { 0 }
}

/// 수동 🔍 결과. 가까운 순, 메모마다 한 줄.
struct NearbyMemosView: View {
  let state: NearbySearchState
  let onOpen: (Memo) -> Void

  var body: some View {
    NavigationStack {
      content
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .background(Palette.canvas)
        .navigationTitle("관련 메모")
        .navigationBarTitleDisplayMode(.inline)
    }
    .presentationDetents([.medium, .large])
  }

  @ViewBuilder private var content: some View {
    switch state {
    case .loading:
      ProgressView().tint(Palette.brand)
    case .failed:
      // 데스크탑 `LOCAL_SEARCH_ERROR_MESSAGE`.
      message("검색하지 못했어요")
    case .results(let results) where results.isEmpty:
      // 데스크탑 `LOCAL_SEARCH_EMPTY_MESSAGE`.
      message("비슷한 문장이 아직은 없네요!")
    case .results(let results):
      List(results, id: \.memo.id) { item in
        Button { onOpen(item.memo) } label: { row(item) }
          .listRowBackground(Palette.canvas)
      }
      .listStyle(.plain)
      .scrollContentBackground(.hidden)
    }
  }

  private func row(_ item: NearbyMemo) -> some View {
    VStack(alignment: .leading, spacing: 4) {
      Text(item.memo.listTitle)
        .font(Typography.ui(15, weight: .medium))
        .foregroundStyle(Palette.ink)
        .lineLimit(1)
      // 왜 걸렸는지 — 가장 가까운 문장.
      Text(item.chunkText)
        .font(Typography.ui(13))
        .foregroundStyle(Palette.inkMuted)
        .lineLimit(2)
    }
    .frame(maxWidth: .infinity, alignment: .leading)
  }

  private func message(_ text: String) -> some View {
    Text(text)
      .font(Typography.ui(14))
      .foregroundStyle(Palette.inkMuted)
  }
}

/// 자동 검색이 조용히 띄우는 한 줄. 데스크탑 고스트처럼 한 건만(`AMBIENT_MAX_RESULT_COUNT`).
struct AmbientSuggestion: View {
  let hit: NearbyMemo
  let onOpen: () -> Void
  let onDismiss: () -> Void

  var body: some View {
    HStack(spacing: 8) {
      Button(action: onOpen) {
        VStack(alignment: .leading, spacing: 2) {
          Text("관련 메모")
            .font(Typography.ui(11))
            .foregroundStyle(Palette.inkMuted)
          Text(hit.memo.listTitle)
            .font(Typography.ui(14, weight: .medium))
            .foregroundStyle(Palette.ink)
            .lineLimit(1)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
      }
      Button(action: onDismiss) {
        Image(systemName: "xmark")
          .font(.system(size: 12, weight: .medium))
          .foregroundStyle(Palette.inkMuted)
          .frame(width: 28, height: 28)
      }
      .accessibilityLabel("닫기")
    }
    .padding(.leading, 12)
    .padding(.vertical, 6)
    .background(Palette.chrome, in: RoundedRectangle(cornerRadius: 10))
    .overlay(RoundedRectangle(cornerRadius: 10).stroke(Palette.border))
  }
}
