import SubnotaKit
import SwiftUI
import WidgetKit

/// 홈화면 `systemSmall` / `systemMedium` — 오늘 일정과 최근 메모.
/// 잠금화면과 달리 제 색이 나온다. 색은 `Palette` 토큰만 쓴다.
struct HomeWidget: Widget {
  var body: some WidgetConfiguration {
    StaticConfiguration(kind: "Home", provider: TodayProvider()) { entry in
      HomeWidgetView(entry: entry)
        .containerBackground(Palette.canvas, for: .widget)
        // 어디를 눌러도 캘린더. medium 의 메모 칸만 `Link` 가 제 주소로 덮어쓴다.
        .widgetURL(DeepLink.calendar.url)
    }
    .configurationDisplayName("오늘")
    .description("오늘 일정과 최근 메모를 봅니다.")
    .supportedFamilies([.systemSmall, .systemMedium])
  }
}

struct HomeWidgetView: View {
  @Environment(\.widgetFamily) private var family
  let entry: TodayEntry

  var body: some View {
    if let snapshot = entry.snapshot {
      if family == .systemMedium {
        HStack(alignment: .top, spacing: 12) {
          // medium 만 행에서 바로 체크한다. small 은 행이 너무 작아 위젯 탭과 헷갈린다.
          today(snapshot, interactive: true)
          Rectangle().fill(Palette.border).frame(width: 1)
          memoLink(snapshot)
        }
      } else {
        VStack(alignment: .leading, spacing: 0) {
          today(snapshot, interactive: false)
          Spacer(minLength: 6)
          memoTitle(snapshot).lineLimit(1)
        }
      }
    } else {
      // DB 도 캐시도 없다 — 재부팅 후 첫 잠금 해제 전이거나 앱을 아직 안 열었다.
      Text("잠금을 해제하면 표시됩니다")
        .font(.footnote)
        .foregroundStyle(Palette.inkMuted)
        .frame(maxWidth: .infinity, maxHeight: .infinity)
    }
  }

  private func today(_ snapshot: WidgetSnapshot, interactive: Bool) -> some View {
    VStack(alignment: .leading, spacing: 6) {
      header("오늘")
      if snapshot.todos.isEmpty {
        Text("오늘 할 일이 없습니다")
          .font(.subheadline)
          .foregroundStyle(Palette.inkMuted)
      } else {
        ForEach(snapshot.todos) { todo in
          if interactive {
            // 잠금화면과 같은 intent — 쓰기 경로를 하나로 둔다.
            Button(intent: ToggleTodoIntent(blockId: todo.id)) { row(todo) }
              .buttonStyle(.plain)
          } else {
            row(todo)
          }
        }
      }
    }
    .frame(maxWidth: .infinity, alignment: .leading)
  }

  /// 앱의 `DayDetailView` 행과 같은 규칙: 체크는 브랜드, 완료 제목은 흐리게 + 취소선.
  private func row(_ todo: WidgetSnapshot.Todo) -> some View {
    HStack(spacing: 6) {
      Image(systemName: todo.isCompleted ? "checkmark.circle.fill" : "circle")
        .foregroundStyle(todo.isCompleted ? Palette.brand : Palette.inkMuted)
      Text(todo.title)
        .font(.subheadline.weight(.medium))
        .foregroundStyle(todo.isCompleted ? Palette.inkMuted : Palette.ink)
        .strikethrough(todo.isCompleted, color: Palette.inkMuted)
        .lineLimit(1)
      Spacer(minLength: 0)
    }
    .contentShape(Rectangle())
  }

  @ViewBuilder
  private func memoLink(_ snapshot: WidgetSnapshot) -> some View {
    let content = VStack(alignment: .leading, spacing: 6) {
      header("최근 메모")
      memoTitle(snapshot).lineLimit(3)
      Spacer(minLength: 0)
    }
    .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
    .contentShape(Rectangle())

    if let link = memoDestination(snapshot) {
      Link(destination: link.url) { content }
    } else {
      content
    }
  }

  /// 메모가 있으면 그 메모, 하나도 없으면 새 메모. id 가 생기기 전의 캐시라
  /// 제목만 있으면 링크를 걸지 않는다 — 위젯 전체의 캘린더로 떨어진다. 새 메모를
  /// 만들어 버리면 사용자가 본 것과 다른 게 열린다.
  private func memoDestination(_ snapshot: WidgetSnapshot) -> DeepLink? {
    if let id = snapshot.latestMemoId { return .memo(id: id) }
    return snapshot.latestMemoTitle == nil ? .newMemo : nil
  }

  @ViewBuilder
  private func memoTitle(_ snapshot: WidgetSnapshot) -> some View {
    if let title = snapshot.latestMemoTitle {
      Label(title.isEmpty ? "제목 없음" : title, systemImage: "note.text")
        .font(.footnote)
        .foregroundStyle(family == .systemMedium ? Palette.ink : Palette.inkMuted)
    } else {
      Label("새 메모", systemImage: "square.and.pencil")
        .font(.footnote)
        .foregroundStyle(Palette.inkMuted)
    }
  }

  private func header(_ text: String) -> some View {
    Text(text)
      .font(.caption.weight(.semibold))
      .foregroundStyle(Palette.inkMuted)
  }
}
