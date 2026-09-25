import SwiftUI
import SubnotaKit

/// 월 격자와 주 뷰. 날짜를 누르면 그 날의 Todo 목록으로 들어간다.
/// 드래그로 일정을 옮기는 동작은 스펙에서 뺐다 — 넣지 말 것.
struct CalendarView: View {
  /// 탭 배지와 같은 상태를 봐야 해서 `MainTabView` 가 만들어 넘긴다.
  let inbox: ScheduleInboxModel?

  @Environment(SessionStore.self) private var session
  @State private var model: CalendarModel?
  /// 지금 보고 있는 달(또는 주)에 속한 아무 날. 이동은 이 값만 바꾼다.
  @State private var anchor = Date()
  @State private var scope: CalendarScope = .month
  @State private var openedDay: DaySelection?
  @State private var report: MonthlyReportModel?
  @State private var showingReport = false
  @State private var showingInbox = false

  /// 사용자가 달력을 불교력으로 바꿔 뒀어도 화면은 기기 설정을 따른다.
  /// 한 주의 시작 요일도 여기서 온다 — 한국은 일요일, 유럽은 월요일이다.
  private var calendar: Calendar { Calendar.current }

  private var days: [Date] { CalendarGrid.days(for: anchor, scope: scope, calendar: calendar) }

  var body: some View {
    NavigationStack {
      Group {
        if let model {
          content(model)
        } else {
          ProgressView().tint(Palette.brand)
        }
      }
      .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .top)
      .background(Palette.canvas)
      .navigationTitle("캘린더")
      .navigationBarTitleDisplayMode(.inline)
      .toolbar {
        ToolbarItem(placement: .topBarLeading) {
          Button {
            report?.load()
            showingReport = true
          } label: {
            Image(systemName: "chart.bar.xaxis").accessibilityLabel("월간 리포트")
          }
          .tint(Palette.inkMuted)
          .disabled(report == nil)
        }
        ToolbarItem(placement: .topBarLeading) {
          Button {
            showingInbox = true
          } label: {
            // 개수는 탭 배지가 들고 있다. 여기서는 들어온 게 있다는 것만 채운
            // 아이콘으로 알린다.
            Image(systemName: (inbox?.items.isEmpty ?? true) ? "tray" : "tray.full")
              .accessibilityLabel("일정 수집함")
          }
          .tint(Palette.inkMuted)
          .disabled(inbox == nil)
        }
        ToolbarItem(placement: .topBarTrailing) {
          // 몇 달 넘긴 뒤 오늘로 돌아올 길이 없으면 안 된다.
          Button("오늘") { anchor = Date() }
            .font(Typography.ui(15))
            .tint(Palette.brand)
        }
      }
      .navigationDestination(item: $openedDay) { selection in
        if let model { DayDetailView(model: model, date: selection.date) }
      }
      .sheet(isPresented: $showingReport) {
        if let report { MonthlyReportView(model: report) }
      }
      // 수락한 후보는 새 일정이 됐다 — 격자를 다시 읽어야 보인다.
      .sheet(isPresented: $showingInbox, onDismiss: { model?.load(days) }) {
        if let inbox { ScheduleInboxView(model: inbox) }
      }
    }
    .task {
      if model == nil, let ownerId = session.userId {
        model = CalendarModel(ownerId: ownerId)
        report = MonthlyReportModel(ownerId: ownerId)
      }
      model?.load(days)
    }
    // 상세에서 돌아왔을 때 배지를 다시 맞춘다.
    .onAppear { model?.load(days) }
  }

  @ViewBuilder
  private func content(_ model: CalendarModel) -> some View {
    VStack(spacing: 0) {
      header
      if let notice = model.loadError {
        Text(notice)
          .font(Typography.ui(12))
          .foregroundStyle(Palette.inkMuted)
          .padding(.horizontal, 16)
          .padding(.bottom, 8)
      }
      MonthGridView(
        days: days,
        month: scope == .month ? anchor : nil,
        calendar: calendar,
        count: { model.blocks(on: $0).count },
        onSelect: { openedDay = DaySelection(date: $0) }
      )
      .padding(.horizontal, 12)
      Spacer(minLength: 0)
    }
    .onChange(of: days) { _, newDays in model.load(newDays) }
  }

  private var header: some View {
    HStack(spacing: 4) {
      Button { shift(-1) } label: {
        Image(systemName: "chevron.left").accessibilityLabel("이전")
      }
      .tint(Palette.inkMuted)

      Text(CalendarGrid.title(for: anchor, scope: scope, days: days))
        .font(Typography.ui(16, weight: .semibold))
        .foregroundStyle(Palette.ink)
        .frame(minWidth: 150)

      Button { shift(1) } label: {
        Image(systemName: "chevron.right").accessibilityLabel("다음")
      }
      .tint(Palette.inkMuted)

      Spacer(minLength: 8)

      Picker("보기", selection: $scope) {
        Text("월").tag(CalendarScope.month)
        Text("주").tag(CalendarScope.week)
      }
      .pickerStyle(.segmented)
      .frame(width: 96)
    }
    .padding(.horizontal, 16)
    .padding(.vertical, 10)
  }

  private func shift(_ step: Int) {
    let unit: Calendar.Component = scope == .month ? .month : .weekOfYear
    if let moved = calendar.date(byAdding: unit, value: step, to: anchor) { anchor = moved }
  }
}

enum CalendarScope: Hashable {
  case month
  case week
}

/// `navigationDestination(item:)` 은 Identifiable 을 요구하는데 Date 는 아니다.
struct DaySelection: Identifiable, Hashable {
  let date: Date
  var id: Date { date }
}

/// 화면이 쓰는 일정 상태. `MemoListModel` 과 같은 결이다 — 저장은 즉시 로컬에
/// 반영되고, 서버 반영은 동기화가 뒤따라간다.
@MainActor
@Observable
final class CalendarModel {
  /// `YYYY-MM-DD`(로컬 시간대) → 그 날의 일정.
  private(set) var byDay: [String: [CalendarBlock]] = [:]
  var loadError: String?

  private let store: CalendarStore?
  /// 위젯 스냅샷은 오늘 일정과 최근 메모를 같이 담는다 — 한쪽만으로는 못 만든다.
  private let memos: MemoStore?
  private let ownerId: String
  private var loadedDays: [Date] = []

  init(ownerId: String) {
    self.ownerId = ownerId
    do {
      let local = try LocalStore(path: try AppGroup.databaseURL())
      store = CalendarStore(store: local, ownerId: ownerId)
      memos = MemoStore(store: local, ownerId: ownerId)
    } catch {
      store = nil
      memos = nil
      loadError = "로컬 저장소를 열지 못했습니다."
    }
  }

  func load(_ days: [Date]) {
    loadedDays = days
    guard let store, let first = days.first, let last = days.last else { return }
    do {
      // blocks(in:) 은 날짜 문자열로 비교하므로 끝 날의 시각은 상관없다.
      let blocks = try store.blocks(in: DateInterval(start: first, end: max(first, last)))
      byDay = Dictionary(grouping: blocks, by: store.dayKey)
      loadError = nil
      if let memos {
        WidgetSnapshot.refresh(memos: memos, calendar: store, ownerId: ownerId)
      }
    } catch {
      loadError = "일정을 불러오지 못했습니다."
    }
  }

  func blocks(on date: Date) -> [CalendarBlock] {
    guard let store else { return [] }
    return byDay[LocalCalendarDate.string(from: date, timeZone: store.timeZone)] ?? []
  }

  /// 그 날의 종일 Todo 를 만든다. 시각을 정하는 화면은 아직 없다.
  func add(title: String, on date: Date) {
    guard let store else { return }
    let trimmed = title.trimmingCharacters(in: .whitespacesAndNewlines)
    guard !trimmed.isEmpty else { return }
    do {
      // 그 날 자정을 시작으로 둔다. 저장소가 여기서 all_day_date 를 뽑는다.
      _ = try store.create(
        title: trimmed,
        startDate: Calendar.current.startOfDay(for: date),
        allDay: true,
        order: blocks(on: date).count
      )
      load(loadedDays)
    } catch {
      loadError = "일정을 만들지 못했습니다."
    }
  }

  /// 체크 토글. 완료로 바꿀 때만 완료 이벤트를 남긴다 — 체크를 끄면 로컬
  /// `isCompleted` 만 돌아오고 이벤트는 그대로 있다(서버가 append-only 다.
  /// 데스크탑 `toggleCalendarBlockCompleted` 도 같다).
  func toggle(_ block: CalendarBlock) {
    guard let store else { return }
    var next = block
    next.isCompleted.toggle()
    next.completedAt = next.isCompleted ? Date() : nil
    do {
      // 정규화까지 끝난 결과로 기록해야 종일 일정의 local_date 가 맞는다.
      let saved = try store.save(next)
      if saved.isCompleted { try store.recordCompletion(of: saved) }
      load(loadedDays)
    } catch {
      loadError = "일정을 저장하지 못했습니다."
    }
  }

  func save(_ block: CalendarBlock) {
    guard let store else { return }
    do {
      try store.save(block)
      load(loadedDays)
    } catch {
      loadError = "일정을 저장하지 못했습니다."
    }
  }

  func delete(_ block: CalendarBlock) {
    guard let store else { return }
    do {
      try store.delete(id: block.id)
      load(loadedDays)
    } catch {
      loadError = "일정을 지우지 못했습니다."
    }
  }
}
