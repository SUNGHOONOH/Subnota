import SwiftUI
import SubnotaKit

/// 링크 하나의 요약. 모델에서 매번 다시 찾아 읽으므로 좋아요·재시도 결과가
/// 목록과 갈리지 않는다.
struct InboxDetailView: View {
  @Environment(\.dismiss) private var dismiss
  let model: InboxListModel
  let id: String

  @State private var confirmingDelete = false

  private var session: InboxSession? { model.sessions.first { $0.id == id } }

  var body: some View {
    ScrollView {
      if let session {
        body(session)
      }
    }
    .background(Palette.canvas)
    .navigationTitle(session?.sourceType.label ?? "링크")
    .navigationBarTitleDisplayMode(.inline)
    .toolbar {
      if let session {
        ToolbarItem(placement: .topBarTrailing) {
          Button {
            Task { await model.setLiked(session, liked: !session.liked) }
          } label: {
            Image(systemName: session.liked ? "heart.fill" : "heart")
              .accessibilityLabel(session.liked ? "좋아요 취소" : "좋아요")
          }
          .tint(Palette.brand)
          .disabled(model.busyId == id)
        }
        ToolbarItem(placement: .topBarTrailing) {
          Button {
            confirmingDelete = true
          } label: {
            Image(systemName: "trash").accessibilityLabel("삭제")
          }
          .tint(Palette.inkMuted)
          .disabled(model.busyId == id)
        }
      }
    }
    // 삭제는 서버에서도 지운다 — 되돌릴 휴지통이 없으니 한 번 묻는다.
    .confirmationDialog("이 링크를 삭제할까요?", isPresented: $confirmingDelete, titleVisibility: .visible) {
      Button("삭제", role: .destructive) {
        guard let session else { return }
        Task { if await model.delete(session) { dismiss() } }
      }
      Button("취소", role: .cancel) {}
    }
  }

  @ViewBuilder
  private func body(_ session: InboxSession) -> some View {
    VStack(alignment: .leading, spacing: 14) {
      header(session)
      if let notice = model.loadError {
        Text(notice).font(Typography.ui(12)).foregroundStyle(Palette.danger)
      }
      summary(session)
      if !session.keywords.isEmpty {
        keywords(session.keywords)
      }
      section("내가 남긴 메모", session.userNote)
      section("공유한 문장", session.selectedText)
      if let url = session.linkURL {
        Link(destination: url) {
          Label("원문 열기", systemImage: "safari")
            .font(Typography.ui(14, weight: .medium))
        }
        .tint(Palette.brand)
        .padding(.top, 4)
      }
      if let provider = session.summaryProvider ?? session.summaryBasis {
        Text("요약 출처: \(provider)").font(Typography.ui(11)).foregroundStyle(Palette.inkMuted)
      }
    }
    .frame(maxWidth: .infinity, alignment: .leading)
    .padding(16)
  }

  private func header(_ session: InboxSession) -> some View {
    VStack(alignment: .leading, spacing: 6) {
      Text(session.listTitle)
        .font(Typography.ui(19, weight: .semibold))
        .foregroundStyle(Palette.ink)
      let facts = [session.channelTitle, session.domain, session.duration, session.publishedAt]
        .compactMap { $0 }
        .filter { !$0.isEmpty }
      if !facts.isEmpty {
        Text(facts.joined(separator: " · "))
          .font(Typography.ui(12))
          .foregroundStyle(Palette.inkMuted)
      }
      Text(session.createdAt.formatted(date: .abbreviated, time: .shortened))
        .font(Typography.ui(11))
        .foregroundStyle(Palette.inkMuted)
    }
  }

  /// 요약이 아직 없거나 실패한 상태도 화면에 드러나야 한다 — 빈 화면은 고장으로 읽힌다.
  @ViewBuilder
  private func summary(_ session: InboxSession) -> some View {
    let text = [session.summaryDetail, session.summary, session.summaryOneLiner, session.description]
      .compactMap { $0 }
      .first { !$0.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty }

    if let text {
      Text(text)
        .font(Typography.editor())
        .lineSpacing(16 * 0.6)
        .foregroundStyle(Palette.ink)
        .textSelection(.enabled)
    }

    switch session.summaryStatus {
    case .pending:
      status("요약을 만들고 있습니다. 잠시 뒤 당겨서 새로고침해 주세요.", tint: Palette.inkMuted)
    case .partial where text == nil:
      status("일부만 요약되었습니다.", tint: Palette.inkMuted)
    case .unsupported:
      status("이 링크는 요약할 수 없습니다. 원문을 열어 보세요.", tint: Palette.inkMuted)
    case .failed:
      VStack(alignment: .leading, spacing: 8) {
        status("요약에 실패했습니다.", tint: Palette.danger)
        Button("요약 다시 시도") { Task { await model.retrySummary(session) } }
          .font(Typography.ui(14, weight: .medium))
          .buttonStyle(.borderedProminent)
          .tint(Palette.brand)
          .disabled(model.busyId == id)
      }
    default:
      EmptyView()
    }
  }

  private func status(_ text: String, tint: Color) -> some View {
    Text(text).font(Typography.ui(13)).foregroundStyle(tint)
  }

  private func keywords(_ keywords: [String]) -> some View {
    // 줄이 넘치면 알아서 다음 줄로 간다 — 키워드 개수를 서버가 정하기 때문이다.
    ViewThatFits(in: .horizontal) {
      HStack(spacing: 6) { ForEach(keywords, id: \.self, content: chip) }
      VStack(alignment: .leading, spacing: 6) {
        ForEach(keywords, id: \.self, content: chip)
      }
    }
  }

  private func chip(_ keyword: String) -> some View {
    Text(keyword)
      .font(Typography.ui(11))
      .foregroundStyle(Palette.inkMuted)
      .padding(.horizontal, 8)
      .padding(.vertical, 3)
      .background(Palette.chrome, in: Capsule())
  }

  @ViewBuilder
  private func section(_ title: String, _ text: String?) -> some View {
    if let text, !text.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty {
      VStack(alignment: .leading, spacing: 4) {
        Text(title).font(Typography.ui(11, weight: .medium)).foregroundStyle(Palette.inkMuted)
        Text(text).font(Typography.ui(13)).foregroundStyle(Palette.ink)
      }
      .padding(10)
      .frame(maxWidth: .infinity, alignment: .leading)
      .background(Palette.chrome, in: RoundedRectangle(cornerRadius: 8))
    }
  }
}
