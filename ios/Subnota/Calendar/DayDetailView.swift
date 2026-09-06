import SwiftUI
import SubnotaKit

/// 하루치 Todo 목록. 추가 · 체크 토글 · 제목/메모 편집 · 삭제.
/// 체크는 로컬 `isCompleted` 만 바꾼다 — 완료 이벤트 기록은 Phase 5 Task 4 다.
struct DayDetailView: View {
  let model: CalendarModel
  let date: Date

  @State private var draft = ""
  @State private var editing: CalendarBlock?
  @FocusState private var composerFocused: Bool

  private var blocks: [CalendarBlock] { model.blocks(on: date) }

  var body: some View {
    VStack(spacing: 0) {
      if blocks.isEmpty {
        emptyState
      } else {
        list
      }
      composer
    }
    .background(Palette.canvas)
    .navigationTitle(date.formatted(.dateTime.month().day().weekday(.abbreviated)))
    .navigationBarTitleDisplayMode(.inline)
    .sheet(item: $editing) { block in
      BlockEditSheet(block: block) { model.save($0) }
    }
  }

  private var emptyState: some View {
    VStack(spacing: 6) {
      Text("이 날에는 일정이 없습니다")
        .font(Typography.ui(15, weight: .medium))
        .foregroundStyle(Palette.ink)
      Text("아래에 적어서 추가하세요")
        .font(Typography.ui(13))
        .foregroundStyle(Palette.inkMuted)
    }
    .frame(maxWidth: .infinity, maxHeight: .infinity)
  }

  private var list: some View {
    List {
      ForEach(blocks) { block in
        row(block).listRowBackground(Color.clear)
      }
      .onDelete { offsets in
        offsets.map { blocks[$0] }.forEach(model.delete)
      }
    }
    .listStyle(.plain)
    // List 가 제 배경을 칠하면 다크에서 순흑이 되어 Palette.canvas 를 덮는다.
    .scrollContentBackground(.hidden)
  }

  private func row(_ block: CalendarBlock) -> some View {
    HStack(spacing: 12) {
      Button { model.toggle(block) } label: {
        Image(systemName: block.isCompleted ? "checkmark.circle.fill" : "circle")
          .font(.system(size: 20))
          .foregroundStyle(block.isCompleted ? Palette.brand : Palette.inkMuted)
      }
      .buttonStyle(.borderless)
      .accessibilityLabel(block.isCompleted ? "완료 해제" : "완료")

      Button { editing = block } label: {
        VStack(alignment: .leading, spacing: 3) {
          Text(block.title)
            .font(Typography.ui(15, weight: .medium))
            .foregroundStyle(block.isCompleted ? Palette.inkMuted : Palette.ink)
            .strikethrough(block.isCompleted, color: Palette.inkMuted)
            .lineLimit(1)
          if let detail = subtitle(block) {
            Text(detail)
              .font(Typography.ui(11))
              .foregroundStyle(Palette.inkMuted)
              .lineLimit(1)
          }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .contentShape(Rectangle())
      }
      .buttonStyle(.borderless)
    }
  }

  /// 시각이 있으면 시각을, 없으면 메모 첫 줄을 보여준다.
  private func subtitle(_ block: CalendarBlock) -> String? {
    if !block.allDay {
      return block.startDate.formatted(date: .omitted, time: .shortened)
    }
    let note = block.note?.trimmingCharacters(in: .whitespacesAndNewlines) ?? ""
    return note.isEmpty ? nil : note
  }

  private var composer: some View {
    VStack(spacing: 0) {
      Divider().overlay(Palette.border)
      HStack(spacing: 10) {
        TextField("할 일 추가", text: $draft)
          .font(Typography.ui(15))
          .foregroundStyle(Palette.ink)
          .focused($composerFocused)
          .submitLabel(.done)
          .onSubmit(add)
        Button(action: add) {
          Image(systemName: "plus.circle.fill")
            .font(.system(size: 22))
            .foregroundStyle(draft.isEmpty ? Palette.inkMuted : Palette.brand)
        }
        .disabled(draft.trimmingCharacters(in: .whitespaces).isEmpty)
        .accessibilityLabel("추가")
      }
      .padding(.horizontal, 16)
      .padding(.vertical, 10)
    }
    .background(Palette.chrome)
  }

  private func add() {
    model.add(title: draft, on: date)
    draft = ""
    // 연달아 여러 개를 적는 경우가 흔하다. 키보드를 내리지 않는다.
    composerFocused = true
  }
}

/// 제목·메모 편집. 시각 편집은 아직 없다 — 만드는 일정이 전부 종일 Todo 다.
private struct BlockEditSheet: View {
  let block: CalendarBlock
  let onSave: (CalendarBlock) -> Void

  @Environment(\.dismiss) private var dismiss
  @State private var title: String
  @State private var note: String

  init(block: CalendarBlock, onSave: @escaping (CalendarBlock) -> Void) {
    self.block = block
    self.onSave = onSave
    _title = State(initialValue: block.title)
    _note = State(initialValue: block.note ?? "")
  }

  var body: some View {
    NavigationStack {
      VStack(alignment: .leading, spacing: 12) {
        TextField("제목", text: $title)
          .font(Typography.ui(17, weight: .medium))
          .foregroundStyle(Palette.ink)
        Divider().overlay(Palette.border)
        TextEditor(text: $note)
          .font(Typography.editor())
          .foregroundStyle(Palette.ink)
          .scrollContentBackground(.hidden)
          .overlay(alignment: .topLeading) {
            if note.isEmpty {
              Text("메모")
                .font(Typography.editor())
                .foregroundStyle(Palette.inkMuted)
                .padding(.top, 8)
                .allowsHitTesting(false)
            }
          }
        Spacer(minLength: 0)
      }
      .padding(16)
      .background(Palette.canvas)
      .navigationTitle("일정 편집")
      .navigationBarTitleDisplayMode(.inline)
      .toolbar {
        ToolbarItem(placement: .topBarLeading) {
          Button("취소") { dismiss() }.tint(Palette.inkMuted)
        }
        ToolbarItem(placement: .topBarTrailing) {
          Button("저장") {
            var next = block
            next.title = title
            let trimmed = note.trimmingCharacters(in: .whitespacesAndNewlines)
            next.note = trimmed.isEmpty ? nil : trimmed
            onSave(next)
            dismiss()
          }
          .tint(Palette.brand)
        }
      }
    }
  }
}
