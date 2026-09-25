import SwiftUI
import SubnotaKit

/// 지난달 요약. 데스크탑 `MonthlyReportModal.tsx` 를 모바일 한 화면으로 옮겼다.
///
/// 성장 트리·숲은 폐지됐다. 완료 이벤트는 여기 "해낸 일" 하나로만 쓰인다.
struct MonthlyReportView: View {
  @Environment(\.dismiss) private var dismiss
  let model: MonthlyReportModel

  var body: some View {
    NavigationStack {
      ScrollView {
        VStack(alignment: .leading, spacing: 20) {
          header
          if let notice = model.loadError {
            Text(notice).font(Typography.ui(12)).foregroundStyle(Palette.inkMuted)
          }
          if let report = model.report {
            if report.memoCount < MonthlyReport.minMemosForReport {
              Text("아직 정리할 기록이 많지 않아요.")
                .font(Typography.ui(14))
                .foregroundStyle(Palette.inkMuted)
                .frame(maxWidth: .infinity, alignment: .center)
                .padding(.vertical, 32)
            } else {
              heatmap(report)
              legend
              stats(report)
            }
          } else {
            ProgressView().tint(Palette.brand).frame(maxWidth: .infinity)
          }
        }
        .padding(16)
      }
      .background(Palette.canvas)
      .navigationTitle("월간 리포트")
      .navigationBarTitleDisplayMode(.inline)
      .toolbar {
        ToolbarItem(placement: .topBarTrailing) {
          Button("닫기") { dismiss() }.font(Typography.ui(15)).tint(Palette.brand)
        }
      }
    }
  }

  private var header: some View {
    HStack {
      Button { model.shift(-1) } label: {
        Image(systemName: "chevron.left").accessibilityLabel("이전 달")
      }
      .tint(Palette.inkMuted)

      Text(MonthlyReport.format(model.monthKey))
        .font(Typography.ui(18, weight: .semibold))
        .foregroundStyle(Palette.ink)
        .frame(maxWidth: .infinity)

      Button { model.shift(1) } label: {
        Image(systemName: "chevron.right").accessibilityLabel("다음 달")
      }
      .tint(Palette.inkMuted)
      // 진행 중인 달은 아직 "해낸 것"이 아니다 — 지난달까지만 본다.
      .disabled(!model.canGoNext)
    }
  }

  // MARK: - 잔디

  /// 데스크탑 `levelOf`. 0 = 기록 없음, 나머지는 그 달 최대치에 대한 비율이다.
  private func level(_ count: Int, max maxCount: Int) -> Int {
    guard count > 0 else { return 0 }
    return min(4, max(1, Int(ceil(Double(count) / Double(maxCount) * 4))))
  }

  private func heatmap(_ report: MonthlyReport) -> some View {
    let meta = MonthlyReport.meta(report.monthKey)
    let maxDaily = max(1, report.dailyCounts.max() ?? 1)
    // 기기의 한 주 시작 요일을 따른다(한국은 일요일, 유럽은 월요일).
    let weekStart = Calendar.current.firstWeekday - 1
    let pad = (meta.firstWeekday - weekStart + 7) % 7
    // 주 단위로 미리 잘라 둔다. LazyVGrid 로 그리면 화면 밖 행을 만들지 않아
    // 말일 며칠이 통째로 빠진다(실측: 8월 25~31일이 안 그려졌다).
    let cells = [Int](repeating: -1, count: pad) + report.dailyCounts
    let weeks = stride(from: 0, to: cells.count, by: 7).map {
      Array(cells[$0..<min($0 + 7, cells.count)])
    }

    return VStack(spacing: 4) {
      HStack(spacing: 4) {
        ForEach(0..<7, id: \.self) { index in
          Text(weekdaySymbol(at: (weekStart + index) % 7))
            .font(Typography.ui(11))
            .foregroundStyle(Palette.inkMuted)
            .frame(maxWidth: .infinity)
        }
      }
      ForEach(weeks.indices, id: \.self) { week in
        HStack(spacing: 4) {
          ForEach(0..<7, id: \.self) { column in
            let count = column < weeks[week].count ? weeks[week][column] : -1
            let day = week * 7 + column - pad + 1
            RoundedRectangle(cornerRadius: 4)
              .fill(count < 0 ? Color.clear : Palette.dataLevels[level(count, max: maxDaily)])
              .frame(maxWidth: .infinity)
              .frame(height: 22)
              .accessibilityLabel(count < 0 ? "" : "\(day)일 \(count)건")
          }
        }
      }
    }
  }

  private func weekdaySymbol(at index: Int) -> String {
    let symbols = Calendar.current.shortWeekdaySymbols
    return symbols.indices.contains(index) ? symbols[index] : ""
  }

  private var legend: some View {
    HStack(spacing: 4) {
      Text("적음").font(Typography.ui(11)).foregroundStyle(Palette.inkMuted)
      ForEach(Array(Palette.dataLevels.enumerated()), id: \.offset) { _, color in
        RoundedRectangle(cornerRadius: 3).fill(color).frame(width: 14, height: 14)
      }
      Text("많음").font(Typography.ui(11)).foregroundStyle(Palette.inkMuted)
    }
    .frame(maxWidth: .infinity, alignment: .trailing)
  }

  // MARK: - 숫자

  private func stats(_ report: MonthlyReport) -> some View {
    HStack(alignment: .top, spacing: 12) {
      stat(value: report.activeDays, unit: "일", label: "기록한 날", delta: report.activeDaysDelta)
      stat(value: report.memoCount, unit: "개", label: "쌓인 메모", delta: report.memoDelta)
      stat(value: report.completedCount, unit: "개", label: "해낸 일", delta: report.completedDelta)
    }
  }

  private func stat(value: Int, unit: String, label: String, delta: Int) -> some View {
    VStack(alignment: .leading, spacing: 2) {
      HStack(alignment: .firstTextBaseline, spacing: 1) {
        Text("\(value)").font(Typography.ui(24, weight: .semibold)).foregroundStyle(Palette.ink)
        Text(unit).font(Typography.ui(12)).foregroundStyle(Palette.inkMuted)
      }
      Text(label).font(Typography.ui(12)).foregroundStyle(Palette.ink)
      if delta == 0 {
        Text("지난달과 같음").font(Typography.ui(11)).foregroundStyle(Palette.inkMuted)
      } else {
        Text("\(delta > 0 ? "▲" : "▼") \(abs(delta))\(unit) 지난달보다")
          .font(Typography.ui(11))
          // 감소가 실패는 아니다. 위험색을 쓰지 않고 증가만 강조한다.
          .foregroundStyle(delta > 0 ? Palette.success : Palette.inkMuted)
      }
    }
    .frame(maxWidth: .infinity, alignment: .leading)
  }
}

/// 리포트 입력은 전부 로컬이다 — 네트워크가 없어도 지난달 요약이 뜬다.
///
/// 데스크탑은 주제·연결(`topic_clusters` / `memo_similarity_edges`)까지 넣지만
/// iOS 에는 아직 그 데이터가 없다. `MonthlyReport` 는 그 계산까지 전부 옮겨
/// 골든으로 고정돼 있으니, 데이터가 생기면 여기에 넣기만 하면 된다.
@MainActor
@Observable
final class MonthlyReportModel {
  private(set) var report: MonthlyReport?
  private(set) var monthKey: String
  var loadError: String?

  private let memos: MemoStore?
  private let calendar: CalendarStore?
  /// 볼 수 있는 가장 최근 달 = 지난달.
  private let latestMonthKey: String

  var canGoNext: Bool { monthKey < latestMonthKey }

  init(ownerId: String, now: Date = Date()) {
    latestMonthKey = MonthlyReport.reportMonthKey(now: now)
    monthKey = latestMonthKey
    do {
      let local = try LocalStore(path: try AppGroup.databaseURL())
      memos = MemoStore(store: local, ownerId: ownerId)
      calendar = CalendarStore(store: local, ownerId: ownerId)
    } catch {
      memos = nil
      calendar = nil
      loadError = "로컬 저장소를 열지 못했습니다."
    }
  }

  func load() {
    guard let memos, let calendar else { return }
    do {
      report = MonthlyReport.build(
        MonthlyReportInput(
          memos: try memos.all(), activities: try calendar.activityCompletions()
        ),
        monthKey: monthKey,
        timeZone: calendar.timeZone
      )
      loadError = nil
    } catch {
      loadError = "리포트를 만들지 못했습니다."
    }
  }

  func shift(_ delta: Int) {
    guard delta < 0 || canGoNext else { return }
    monthKey = MonthlyReport.shift(monthKey, by: delta)
    load()
  }
}
