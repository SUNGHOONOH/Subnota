import Foundation
import Testing
@testable import SubnotaKit

/// `report-golden.json` 은 데스크탑 `features/report/monthlyReport.ts` 를 그대로
/// 돌려서 만들었다. 값이 다르면 같은 달을 두 기기가 다르게 요약한다는 뜻이므로,
/// 픽스처가 아니라 구현을 고친다.
private enum ReportGolden {
  struct MemoRow: Decodable {
    let id: String
    let content: String
    let createdAt: String

    enum CodingKeys: String, CodingKey {
      case id
      case content
      case createdAt = "created_at"
    }
  }

  struct ActivityRow: Decodable {
    let id: String
    let calendarBlockId: String
    let completedAt: String
    let localDate: String

    enum CodingKeys: String, CodingKey {
      case id
      case calendarBlockId = "calendar_block_id"
      case completedAt = "completed_at"
      case localDate = "local_date"
    }
  }

  struct ClusterRow: Decodable {
    let id: String
    let label: String
  }

  struct MembershipRow: Decodable {
    let memoId: String
    let topicId: String
  }

  struct EdgeRow: Decodable {
    let sourceMemoId: String
    let targetMemoId: String
  }

  struct Input: Decodable {
    let memos: [MemoRow]
    let activities: [ActivityRow]
    let clusters: [ClusterRow]
    let memberships: [MembershipRow]
    let edges: [EdgeRow]
  }

  struct TopicSliceRow: Decodable {
    let label: String
    let current: Int
    let previous: Int
    let isNew: Bool
  }

  struct HubRow: Decodable {
    let id: String
    let title: String
    let degree: Int
  }

  struct Expected: Decodable {
    let monthKey: String
    let dailyCounts: [Int]
    let memoCount: Int
    let memoDelta: Int
    let activeDays: Int
    let activeDaysDelta: Int
    let completedCount: Int
    let completedDelta: Int
    let topics: [TopicSliceRow]
    let newTopics: [String]
    let newTopicOverflow: Int
    let newEdgeCount: Int
    let totalEdgeCount: Int
    let hubMemo: HubRow?
  }

  struct ReportCase: Decodable {
    let name: String
    let monthKey: String
    let input: Input
    let expected: Expected
    let hasTopicSection: Bool
    let hasKnowledgeSection: Bool
  }

  struct MetaCase: Decodable {
    let monthKey: String
    let daysInMonth: Int
    let firstWeekday: Int
  }

  struct ShiftCase: Decodable {
    let monthKey: String
    let delta: Int
    let expected: String
  }

  struct FormatCase: Decodable {
    let monthKey: String
    let expected: String
  }

  struct NowCase: Decodable {
    let now: String
    let expected: String
  }

  struct Fixture: Decodable {
    let timeZone: String
    let minMemosForReport: Int
    let buildMonthlyReport: [ReportCase]
    let monthMeta: [MetaCase]
    let shiftMonthKey: [ShiftCase]
    let formatMonthKey: [FormatCase]
    let reportMonthKey: [NowCase]
  }

  /// 픽스처는 `TZ=Asia/Seoul` 에서 만들었다. 기기 시간대로 돌리면 달 경계 케이스가
  /// 하루씩 밀린다.
  static func load() throws -> (Fixture, TimeZone) {
    let url = try #require(
      Bundle.module.url(forResource: "report-golden", withExtension: "json")
    )
    let fixture = try JSONDecoder().decode(Fixture.self, from: Data(contentsOf: url))
    return (fixture, try #require(TimeZone(identifier: fixture.timeZone)))
  }

  static func date(_ value: String) throws -> Date {
    let iso = ISO8601DateFormatter()
    iso.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
    return try #require(iso.date(from: value))
  }

  static func input(_ row: Input) throws -> MonthlyReportInput {
    MonthlyReportInput(
      memos: try row.memos.map {
        Memo(
          id: $0.id, content: $0.content, category: nil,
          createdAt: try date($0.createdAt), contentUpdatedAt: try date($0.createdAt)
        )
      },
      activities: try row.activities.map {
        ActivityCompletion(
          id: $0.id, calendarBlockId: $0.calendarBlockId,
          completedAt: try date($0.completedAt), localDate: $0.localDate
        )
      },
      clusters: row.clusters.map { TopicCluster(id: $0.id, label: $0.label) },
      memberships: row.memberships.map {
        TopicMembership(memoId: $0.memoId, topicId: $0.topicId)
      },
      edges: row.edges.map {
        MemoSimilarityEdge(sourceMemoId: $0.sourceMemoId, targetMemoId: $0.targetMemoId)
      }
    )
  }
}

@Test func monthlyReportMatchesDesktopForEveryGoldenCase() throws {
  let (fixture, zone) = try ReportGolden.load()
  #expect(!fixture.buildMonthlyReport.isEmpty)

  for testCase in fixture.buildMonthlyReport {
    let report = MonthlyReport.build(
      try ReportGolden.input(testCase.input),
      monthKey: testCase.monthKey,
      timeZone: zone
    )
    let expected = testCase.expected
    let where_ = "case \(testCase.name)"

    // 반환 구조의 모든 필드를 본다. 일부만 보면 나머지가 갈려도 통과한다.
    #expect(report.monthKey == expected.monthKey, "\(where_): monthKey")
    #expect(report.dailyCounts == expected.dailyCounts, "\(where_): dailyCounts")
    #expect(report.memoCount == expected.memoCount, "\(where_): memoCount")
    #expect(report.memoDelta == expected.memoDelta, "\(where_): memoDelta")
    #expect(report.activeDays == expected.activeDays, "\(where_): activeDays")
    #expect(report.activeDaysDelta == expected.activeDaysDelta, "\(where_): activeDaysDelta")
    #expect(report.completedCount == expected.completedCount, "\(where_): completedCount")
    #expect(report.completedDelta == expected.completedDelta, "\(where_): completedDelta")
    #expect(report.newTopics == expected.newTopics, "\(where_): newTopics")
    #expect(report.newTopicOverflow == expected.newTopicOverflow, "\(where_): newTopicOverflow")
    #expect(report.newEdgeCount == expected.newEdgeCount, "\(where_): newEdgeCount")
    #expect(report.totalEdgeCount == expected.totalEdgeCount, "\(where_): totalEdgeCount")

    #expect(report.topics.count == expected.topics.count, "\(where_): topics.count")
    for (actual, want) in zip(report.topics, expected.topics) {
      #expect(actual.label == want.label, "\(where_): topic label")
      #expect(actual.current == want.current, "\(where_): topic current \(want.label)")
      #expect(actual.previous == want.previous, "\(where_): topic previous \(want.label)")
      #expect(actual.isNew == want.isNew, "\(where_): topic isNew \(want.label)")
    }

    #expect((report.hubMemo == nil) == (expected.hubMemo == nil), "\(where_): hubMemo nil")
    if let hub = report.hubMemo, let want = expected.hubMemo {
      #expect(hub.id == want.id, "\(where_): hub id")
      #expect(hub.title == want.title, "\(where_): hub title")
      #expect(hub.degree == want.degree, "\(where_): hub degree")
    }

    #expect(report.hasTopicSection == testCase.hasTopicSection, "\(where_): hasTopicSection")
    #expect(
      report.hasKnowledgeSection == testCase.hasKnowledgeSection, "\(where_): hasKnowledgeSection"
    )
  }
}

@Test func monthlyReportConstantsMatchTheDesktop() throws {
  let (fixture, _) = try ReportGolden.load()
  #expect(MonthlyReport.minMemosForReport == fixture.minMemosForReport)
}

@Test func monthMetaMatchesDesktop() throws {
  let (fixture, _) = try ReportGolden.load()
  for testCase in fixture.monthMeta {
    let meta = MonthlyReport.meta(testCase.monthKey)
    #expect(meta.daysInMonth == testCase.daysInMonth, "\(testCase.monthKey): daysInMonth")
    #expect(meta.firstWeekday == testCase.firstWeekday, "\(testCase.monthKey): firstWeekday")
  }
}

@Test func monthKeyHelpersMatchDesktop() throws {
  let (fixture, zone) = try ReportGolden.load()
  for testCase in fixture.shiftMonthKey {
    #expect(
      MonthlyReport.shift(testCase.monthKey, by: testCase.delta) == testCase.expected,
      "shift \(testCase.monthKey) \(testCase.delta)"
    )
  }
  for testCase in fixture.formatMonthKey {
    #expect(
      MonthlyReport.format(testCase.monthKey) == testCase.expected, "format \(testCase.monthKey)")
  }
  for testCase in fixture.reportMonthKey {
    #expect(
      MonthlyReport.reportMonthKey(now: try ReportGolden.date(testCase.now), timeZone: zone)
        == testCase.expected,
      "reportMonthKey \(testCase.now)"
    )
  }
}

/// 픽스처가 실제로 경계를 덮고 있는지. 코퍼스가 조용히 얇아지면 골든이 통과해도
/// 아무것도 지키지 못한다.
@Test func reportGoldenCoversTheBoundariesThatMatter() throws {
  let (fixture, _) = try ReportGolden.load()
  let cases = fixture.buildMonthlyReport

  #expect(cases.contains { $0.expected.memoCount < fixture.minMemosForReport })
  #expect(cases.contains { $0.expected.memoCount >= fixture.minMemosForReport })
  #expect(cases.contains { $0.expected.completedCount == 0 })
  #expect(cases.contains { $0.expected.dailyCounts.count == 29 })  // 윤년 2월
  #expect(cases.contains { $0.expected.dailyCounts.count == 28 })  // 평년 2월
  #expect(cases.contains { $0.expected.dailyCounts.first ?? 0 > 0 })  // 1일
  #expect(cases.contains { $0.expected.dailyCounts.last ?? 0 > 0 })  // 말일
  #expect(cases.contains { $0.expected.memoDelta < 0 })
  #expect(cases.contains { $0.expected.newTopicOverflow > 0 })
  #expect(cases.contains { $0.expected.hubMemo != nil })
}
