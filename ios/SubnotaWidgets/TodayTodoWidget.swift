import SubnotaKit
import SwiftUI
import WidgetKit

/// 잠금화면 `accessoryRectangular` — 오늘 남은 일 1~2줄. 행을 누르면 체크가
/// 바뀐다(`ToggleTodoIntent`) — 잠금 해제 없이.
struct TodayTodoWidget: Widget {
  var body: some WidgetConfiguration {
    StaticConfiguration(kind: "TodayTodo", provider: TodayProvider()) { entry in
      TodayTodoView(entry: entry)
        .containerBackground(.clear, for: .widget)
    }
    .configurationDisplayName("오늘 할 일")
    .description("오늘 남은 일정을 잠금화면에서 봅니다.")
    .supportedFamilies([.accessoryRectangular])
  }
}

struct TodayTodoView: View {
  let entry: TodayEntry

  var body: some View {
    VStack(alignment: .leading, spacing: 1) {
      if let snapshot = entry.snapshot {
        if snapshot.todos.isEmpty {
          Text("오늘 할 일이 없습니다").font(.caption)
        } else {
          ForEach(snapshot.todos) { row($0) }
        }
      } else {
        // DB 도 못 읽고 캐시도 없다 — 재부팅 후 첫 잠금 해제 전이거나, 앱을 아직
        // 한 번도 열지 않았다. 빈 화면 대신 왜 비었는지 말해 준다.
        Text("잠금을 해제하면 표시됩니다").font(.caption)
      }
    }
    .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .leading)
  }

  private func row(_ todo: WidgetSnapshot.Todo) -> some View {
    // 잠금화면은 vibrant 렌더링이라 색을 지정해도 명도만 남는다 — 어두운
    // `Palette.ink` 를 그대로 주면 오히려 흐려진다. 시스템이 주는 전경색을 쓰고,
    // 완료는 색이 아니라 취소선과 아이콘으로 구분한다.
    // 행 전체가 버튼이다 — 잠금화면 두 줄짜리에서 원 아이콘만 누르게 하면 너무 작다.
    Button(intent: ToggleTodoIntent(blockId: todo.id)) {
      HStack(spacing: 4) {
        Image(systemName: todo.isCompleted ? "checkmark.circle.fill" : "circle")
          .imageScale(.small)
        Text(todo.title)
          .font(.system(size: 14, weight: .medium))
          .strikethrough(todo.isCompleted)
          .lineLimit(1)
        Spacer(minLength: 0)
      }
      .opacity(todo.isCompleted ? 0.6 : 1)
    }
    .buttonStyle(.plain)
  }
}
