import SubnotaKit
import SwiftUI
import WidgetKit

/// 잠금화면 `accessoryCircular` — 브랜드 마크만. 누르면 새 메모가 열린다.
struct QuickMemoWidget: Widget {
  var body: some WidgetConfiguration {
    StaticConfiguration(kind: "QuickMemo", provider: QuickMemoProvider()) { _ in
      QuickMemoView()
        .containerBackground(.clear, for: .widget)
        .widgetURL(DeepLink.newMemo.url)
    }
    .configurationDisplayName("빠른 메모")
    .description("잠금화면에서 새 메모로 갑니다.")
    .supportedFamilies([.accessoryCircular])
  }
}

/// 그릴 게 마크뿐이라 읽을 데이터가 없다. 타임라인도 한 장이면 끝난다.
struct QuickMemoProvider: TimelineProvider {
  func placeholder(in context: Context) -> TodayEntry {
    TodayEntry(date: Date(), snapshot: nil)
  }

  func getSnapshot(in context: Context, completion: @escaping (TodayEntry) -> Void) {
    completion(placeholder(in: context))
  }

  func getTimeline(in context: Context, completion: @escaping (Timeline<TodayEntry>) -> Void) {
    completion(Timeline(entries: [placeholder(in: context)], policy: .never))
  }
}

struct QuickMemoView: View {
  var body: some View {
    ZStack {
      // 잠금화면 vibrant 에서 마크만 떠 있으면 무엇에 얹힌 건지 안 읽힌다.
      // 시스템이 주는 accessory 배경이 대비를 만들어 준다.
      AccessoryWidgetBackground()
      // 마크는 브랜드색(`Palette`)으로 그리지만 vibrant 에서는 명도만 남는다.
      // 홈화면·standBy 에서는 제 색이 나온다 — 그래서 색은 그대로 둔다.
      SubnotaMark(size: 26)
    }
  }
}
