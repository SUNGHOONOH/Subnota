import SwiftUI

/// 월·주 공통 격자. 주 뷰는 한 줄짜리 월 격자라서 뷰를 따로 두지 않는다.
struct MonthGridView: View {
  let days: [Date]
  /// 이 달에 속하지 않는 날을 흐리게 하기 위한 기준. 주 뷰는 nil 이다.
  let month: Date?
  let calendar: Calendar
  let count: (Date) -> Int
  let onSelect: (Date) -> Void

  private let columns = Array(repeating: GridItem(.flexible(), spacing: 0), count: 7)

  var body: some View {
    VStack(spacing: 6) {
      LazyVGrid(columns: columns, spacing: 0) {
        ForEach(Array(CalendarGrid.weekdaySymbols(calendar).enumerated()), id: \.offset) { _, symbol in
          Text(symbol)
            .font(Typography.ui(11, weight: .medium))
            .foregroundStyle(Palette.inkMuted)
        }
      }
      LazyVGrid(columns: columns, spacing: 2) {
        ForEach(days, id: \.self) { day in
          cell(day)
        }
      }
    }
  }

  private func cell(_ day: Date) -> some View {
    let isToday = calendar.isDateInToday(day)
    let dimmed = month.map { !calendar.isDate(day, equalTo: $0, toGranularity: .month) } ?? false
    let total = count(day)

    return Button { onSelect(day) } label: {
      VStack(spacing: 3) {
        Text("\(calendar.component(.day, from: day))")
          .font(Typography.ui(14, weight: isToday ? .semibold : .regular))
          .foregroundStyle(isToday ? Palette.onBrand : (dimmed ? Palette.inkMuted : Palette.ink))
          .frame(width: 26, height: 26)
          // 브랜드 색은 오늘 표시에만 — 장식으로 쓰지 않는다.
          .background(isToday ? Palette.brand : .clear, in: Circle())
        dots(total)
      }
      .frame(maxWidth: .infinity, minHeight: 48)
      .contentShape(Rectangle())
    }
    .buttonStyle(.plain)
    .accessibilityLabel(
      "\(day.formatted(.dateTime.month().day()))"
        + (total == 0 ? ", 일정 없음" : ", 일정 \(total)개")
    )
  }

  /// 점 세 개까지. 넘치면 `+n` 을 붙인다 — 숫자만 적으면 날짜로 읽힌다.
  @ViewBuilder
  private func dots(_ total: Int) -> some View {
    HStack(spacing: 2.5) {
      ForEach(0..<min(max(total, 0), 3), id: \.self) { _ in
        Circle().fill(Palette.inkMuted).frame(width: 4, height: 4)
      }
      if total > 3 {
        Text("+\(total - 3)")
          .font(Typography.ui(9, weight: .medium))
          .foregroundStyle(Palette.inkMuted)
      }
    }
    // 일정이 없는 날도 같은 높이를 차지해야 줄이 흔들리지 않는다.
    .frame(height: 10)
  }
}

/// 격자에 뿌릴 날짜 계산. 뷰에서 떼어 둔 이유는 주 시작 요일 규칙이 한 군데에만
/// 있어야 하기 때문이다.
enum CalendarGrid {
  static func days(for anchor: Date, scope: CalendarScope, calendar: Calendar) -> [Date] {
    switch scope {
    case .week:
      return week(containing: anchor, calendar: calendar)
    case .month:
      guard let monthInterval = calendar.dateInterval(of: .month, for: anchor) else { return [] }
      var day = startOfWeek(monthInterval.start, calendar)
      var result: [Date] = []
      // 마지막 주는 다음 달로 넘어가더라도 일곱 칸을 채운다.
      while day < monthInterval.end || result.count % 7 != 0 {
        result.append(day)
        guard let next = calendar.date(byAdding: .day, value: 1, to: day) else { break }
        day = next
      }
      return result
    }
  }

  static func title(for anchor: Date, scope: CalendarScope, days: [Date]) -> String {
    switch scope {
    case .month:
      return anchor.formatted(.dateTime.year().month())
    case .week:
      guard let first = days.first, let last = days.last else { return "" }
      return first.formatted(.dateTime.month().day()) + " – " + last.formatted(.dateTime.month().day())
    }
  }

  /// 기기 설정의 주 시작 요일에 맞춘 요일 머리글. 한국은 일요일, 유럽은 월요일이다.
  static func weekdaySymbols(_ calendar: Calendar) -> [String] {
    let symbols = calendar.veryShortStandaloneWeekdaySymbols
    guard symbols.count == 7 else { return symbols }
    return (0..<7).map { symbols[(calendar.firstWeekday - 1 + $0) % 7] }
  }

  private static func week(containing date: Date, calendar: Calendar) -> [Date] {
    let start = startOfWeek(date, calendar)
    return (0..<7).compactMap { calendar.date(byAdding: .day, value: $0, to: start) }
  }

  /// `dateInterval(of: .weekOfYear)` 가 firstWeekday 를 이미 반영한다 —
  /// 요일 번호를 직접 빼고 더하지 말 것.
  private static func startOfWeek(_ date: Date, _ calendar: Calendar) -> Date {
    calendar.dateInterval(of: .weekOfYear, for: date)?.start ?? calendar.startOfDay(for: date)
  }
}
