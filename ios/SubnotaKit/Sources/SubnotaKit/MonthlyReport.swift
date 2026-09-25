import Foundation

/// 데스크탑 `features/report/monthlyReport.ts` 포팅. 순수 계산이라
/// `report-golden.json` 이 데스크탑 실측값으로 전 필드를 고정한다.
///
/// 나무·숲 게임화는 폐지됐다. `activity_completions` 는 여기 입력으로만 남았다.

/// 데스크탑 `TopicCluster` 중 리포트가 실제로 읽는 두 필드만 옮겼다.
public struct TopicCluster: Sendable, Equatable {
  public let id: String
  public let label: String

  public init(id: String, label: String) {
    self.id = id
    self.label = label
  }
}

public struct TopicMembership: Sendable, Equatable {
  public let memoId: String
  public let topicId: String

  public init(memoId: String, topicId: String) {
    self.memoId = memoId
    self.topicId = topicId
  }
}

public struct MemoSimilarityEdge: Sendable, Equatable {
  public let sourceMemoId: String
  public let targetMemoId: String

  public init(sourceMemoId: String, targetMemoId: String) {
    self.sourceMemoId = sourceMemoId
    self.targetMemoId = targetMemoId
  }
}

public struct MonthlyReportInput: Sendable {
  public var memos: [Memo]
  public var activities: [ActivityCompletion]
  public var clusters: [TopicCluster]
  public var memberships: [TopicMembership]
  public var edges: [MemoSimilarityEdge]

  public init(
    memos: [Memo] = [],
    activities: [ActivityCompletion] = [],
    clusters: [TopicCluster] = [],
    memberships: [TopicMembership] = [],
    edges: [MemoSimilarityEdge] = []
  ) {
    self.memos = memos
    self.activities = activities
    self.clusters = clusters
    self.memberships = memberships
    self.edges = edges
  }
}

public struct TopicSlice: Sendable, Equatable {
  public let label: String
  public let current: Int
  public let previous: Int
  public let isNew: Bool
}

public struct MonthlyReport: Sendable, Equatable {
  public struct HubMemo: Sendable, Equatable {
    public let id: String
    public let title: String
    public let degree: Int
  }

  public let monthKey: String
  /// 잔디 — index 0 이 1일. 값은 그날 (쓴 메모 + 완료한 일정) 수.
  public let dailyCounts: [Int]
  public let memoCount: Int
  public let memoDelta: Int
  public let activeDays: Int
  public let activeDaysDelta: Int
  public let completedCount: Int
  public let completedDelta: Int
  public let topics: [TopicSlice]
  public let newTopics: [String]
  public let newTopicOverflow: Int
  public let newEdgeCount: Int
  public let totalEdgeCount: Int
  public let hubMemo: HubMemo?

  // MARK: - 상수 (데스크탑 원본에서 읽은 값. 지어내지 말 것)

  /// 리포트를 띄우기 위한 최소 기록량. 이보다 적으면 0만 늘어놓게 된다.
  public static let minMemosForReport = 5
  /// 대표 주제는 3개까지. 더 늘리면 라벨이 겹친다.
  private static let topicSliceLimit = 3
  /// 이보다 적으면 "대표"라 부를 게 없어 섹션을 숨긴다.
  private static let minTopicsToShow = 2
  private static let newTopicChipLimit = 3

  public var hasTopicSection: Bool { topics.count >= Self.minTopicsToShow }
  public var hasKnowledgeSection: Bool { !newTopics.isEmpty || newEdgeCount > 0 }

  // MARK: - 달 키

  /// `YYYY-MM`. 데스크탑은 로컬 시간대의 연·월을 쓴다 — UTC 로 계산하면 한국에서
  /// 오전 9시 이전에 쓴 1일 메모가 지난달로 간다.
  public static func monthKey(of date: Date, timeZone: TimeZone) -> String {
    String(LocalCalendarDate.string(from: date, timeZone: timeZone).prefix(7))
  }

  /// 데스크탑은 `new Date(year, month - 1 + delta, 1)` 로 넘긴다. 여기서는 같은
  /// 결과를 시간대 없이 계산한다 — 달 산수에 시각이 낄 이유가 없다.
  public static func shift(_ monthKey: String, by delta: Int) -> String {
    let (year, month) = parse(monthKey)
    let total = year * 12 + (month - 1) + delta
    // Swift 의 `/`·`%` 는 0 쪽으로 자른다. 음수 달에서 어긋나지 않게 내림으로 맞춘다.
    let shiftedYear = Int(floor(Double(total) / 12))
    let shiftedMonth = total - shiftedYear * 12 + 1
    return String(format: "%04d-%02d", shiftedYear, shiftedMonth)
  }

  /// 리포트가 다루는 달 = 직전 달. 진행 중인 달은 아직 "해낸 것"이 아니다.
  public static func reportMonthKey(now: Date = Date(), timeZone: TimeZone = .current) -> String {
    shift(monthKey(of: now, timeZone: timeZone), by: -1)
  }

  public static func format(_ monthKey: String) -> String {
    let (year, month) = parse(monthKey)
    return "\(year)년 \(month)월"
  }

  /// 데스크탑 `monthMeta`. `firstWeekday` 는 JS `getDay()` 와 같은 0=일요일이다.
  public static func meta(_ monthKey: String) -> (daysInMonth: Int, firstWeekday: Int) {
    let (year, month) = parse(monthKey)
    var calendar = Calendar(identifier: .gregorian)
    // 시간대는 결과에 영향을 주지 않지만(같은 달력으로 넣고 뺀다), 기기 설정에
    // 끌려다니지 않게 고정한다. 불교력 기기에서 연도가 2569 로 나오는 것도 막는다.
    calendar.timeZone = TimeZone(secondsFromGMT: 0) ?? .gmt
    guard
      let first = calendar.date(from: DateComponents(year: year, month: month, day: 1)),
      let days = calendar.range(of: .day, in: .month, for: first)?.count
    else {
      return (0, 0)
    }
    return (days, calendar.component(.weekday, from: first) - 1)
  }

  private static func parse(_ monthKey: String) -> (year: Int, month: Int) {
    let parts = monthKey.split(separator: "-", omittingEmptySubsequences: false)
    return (parts.first.flatMap { Int($0) } ?? 0, parts.count > 1 ? Int(parts[1]) ?? 0 : 0)
  }

  // MARK: - 계산

  public static func build(
    _ input: MonthlyReportInput, monthKey: String, timeZone: TimeZone = .current
  ) -> MonthlyReport {
    let previousKey = shift(monthKey, by: -1)
    let daysInMonth = meta(monthKey).daysInMonth
    let localDate = { (memo: Memo) in
      LocalCalendarDate.string(from: memo.createdAt, timeZone: timeZone)
    }
    let memoMonthKey = { (memo: Memo) in String(localDate(memo).prefix(7)) }

    let monthMemos = input.memos.filter { memoMonthKey($0) == monthKey }
    let monthMemoIds = Set(monthMemos.map(\.id))
    let monthActivities = input.activities.filter { $0.localDate.hasPrefix(monthKey) }

    // 하루치 활동량 = 그날 쓴 메모 + 완료한 일정.
    var dailyCounts = [Int](repeating: 0, count: daysInMonth)
    let bump = { (date: String) in
      // 데스크탑 `Number(localDate.slice(8, 10))`. 범위를 벗어난 날(09-31)이나
      // 숫자가 아닌 값은 잔디에서 조용히 빠진다 — 완료 수에는 그대로 남는다.
      guard let day = Int(date.dropFirst(8).prefix(2)), day >= 1, day <= daysInMonth else {
        return
      }
      dailyCounts[day - 1] += 1
    }
    monthMemos.forEach { bump(localDate($0)) }
    monthActivities.forEach { bump($0.localDate) }

    let previousMemos = input.memos.filter { memoMonthKey($0) == previousKey }
    let previousActivities = input.activities.filter { $0.localDate.hasPrefix(previousKey) }
    let previousActiveDays = Set(
      previousMemos.map(localDate) + previousActivities.map(\.localDate)
    ).count
    let monthActiveDays = Set(monthMemos.map(localDate) + monthActivities.map(\.localDate)).count

    let memoById = Dictionary(input.memos.map { ($0.id, $0) }, uniquingKeysWith: { _, last in last })

    // 토픽별 이번/지난 달 메모 수. 토픽에 생성 시각이 없어 소속 메모로 유추한다.
    //
    // **삽입 순서를 지켜야 한다.** JS `Map` 은 삽입 순서를 유지하고 `Array.sort` 는
    // 안정 정렬이라, 개수가 같은 주제의 순위와 `newTopics` 의 순서가 삽입 순서로
    // 정해진다. Swift `Dictionary` 는 순서가 없으므로 키 순서를 따로 들고 있는다.
    struct Entry {
      var current = 0
      var previous = 0
      var earliest: Date?
    }
    var topicOrder: [String] = []
    var perTopic: [String: Entry] = [:]
    for membership in input.memberships {
      guard let memo = memoById[membership.memoId] else { continue }
      let key = memoMonthKey(memo)
      if perTopic[membership.topicId] == nil { topicOrder.append(membership.topicId) }
      var entry = perTopic[membership.topicId] ?? Entry()
      if key == monthKey { entry.current += 1 }
      if key == previousKey { entry.previous += 1 }
      // 데스크탑은 ISO 문자열을 사전순으로 비교한다. 같은 형식이면 시각 비교와 같다.
      if let earliest = entry.earliest {
        entry.earliest = min(earliest, memo.createdAt)
      } else {
        entry.earliest = memo.createdAt
      }
      perTopic[membership.topicId] = entry
    }

    let labelOf = Dictionary(
      input.clusters.map { ($0.id, $0.label) }, uniquingKeysWith: { _, last in last }
    )
    let isNewTopic = { (earliest: Date?) in
      guard let earliest else { return false }
      return Self.monthKey(of: earliest, timeZone: timeZone) == monthKey
    }

    let topics =
      topicOrder
      .compactMap { id -> TopicSlice? in
        guard let entry = perTopic[id] else { return nil }
        return TopicSlice(
          label: labelOf[id] ?? "", current: entry.current, previous: entry.previous,
          isNew: isNewTopic(entry.earliest)
        )
      }
      .filter { !$0.label.isEmpty && $0.current > 0 }
      .enumerated()
      // 안정 정렬: 개수가 같으면 먼저 들어온 주제가 앞이다.
      .sorted { $0.element.current == $1.element.current
        ? $0.offset < $1.offset
        : $0.element.current > $1.element.current
      }
      .map(\.element)
      .prefix(topicSliceLimit)

    let allNewTopics = topicOrder
      .filter { isNewTopic(perTopic[$0]?.earliest) }
      .compactMap { labelOf[$0] }
      .filter { !$0.isEmpty }

    // 엣지에도 시각이 없어 "이번 달 메모가 걸린 연결"을 이번 달 증가분으로 센다.
    var degreeOrder: [String] = []
    var degree: [String: Int] = [:]
    var newEdgeCount = 0
    for edge in input.edges {
      let touchesMonth =
        monthMemoIds.contains(edge.sourceMemoId) || monthMemoIds.contains(edge.targetMemoId)
      guard touchesMonth else { continue }
      newEdgeCount += 1
      for id in [edge.sourceMemoId, edge.targetMemoId] where monthMemoIds.contains(id) {
        if degree[id] == nil { degreeOrder.append(id) }
        degree[id, default: 0] += 1
      }
    }

    // 동점이면 먼저 나온 메모가 허브다 — `max(by:)` 는 같은 값에서 앞 원소를
    // 유지하므로 JS 의 안정 내림차순 정렬 후 [0] 과 결과가 같다.
    let hubId = degreeOrder.max { (degree[$0] ?? 0) < (degree[$1] ?? 0) }
    let hubSource = hubId.flatMap { memoById[$0] }

    return MonthlyReport(
      monthKey: monthKey,
      dailyCounts: dailyCounts,
      memoCount: monthMemos.count,
      memoDelta: monthMemos.count - previousMemos.count,
      activeDays: monthActiveDays,
      activeDaysDelta: monthActiveDays - previousActiveDays,
      completedCount: monthActivities.count,
      completedDelta: monthActivities.count - previousActivities.count,
      topics: Array(topics),
      newTopics: Array(allNewTopics.prefix(newTopicChipLimit)),
      newTopicOverflow: max(0, allNewTopics.count - newTopicChipLimit),
      newEdgeCount: newEdgeCount,
      totalEdgeCount: input.edges.count,
      hubMemo: hubSource.map {
        HubMemo(id: $0.id, title: noteTitle($0.content), degree: degree[$0.id] ?? 0)
      }
    )
  }

  /// 데스크탑 `splitNoteContent(content).title || '제목 없음'`.
  /// **트리밍하지 않는다** — 목록 행의 `listTitle` 과 규칙이 다르다. 공백뿐인 첫 줄은
  /// JS 에서 truthy 라 그대로 제목이 된다.
  private static func noteTitle(_ content: String) -> String {
    let title =
      content.firstIndex(of: "\n").map { String(content[content.startIndex..<$0]) } ?? content
    return title.isEmpty ? "제목 없음" : title
  }
}
