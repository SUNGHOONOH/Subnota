import Foundation
import Testing
@testable import SubnotaKit

/// `date-golden.json` 은 데스크탑 `lib/dateParser.ts` 의 `parseDates` 를 그대로
/// 돌려서 만들었다. 값이 다르면 두 기기가 같은 문장을 다른 날짜로 읽는다는
/// 뜻이므로, 픽스처가 아니라 구현을 고친다.
private enum DateGolden {
  struct Match: Decodable {
    let text: String
    let date: String
    let index: Int
    let length: Int
    let kind: String
    let hasTime: Bool
  }

  struct ParseCase: Decodable {
    let name: String
    let text: String
    let expected: [Match]
  }

  struct NearestCase: Decodable {
    let text: String
    let cursorIndex: Int
    let expectedIndex: Int?
  }

  struct Fixture: Decodable {
    let baseTimestamp: String
    let timeZone: String
    let parseDates: [ParseCase]
    let findNearestDateMatch: [NearestCase]
  }

  /// 픽스처는 `TZ=Asia/Seoul` 에서 만들었다. `Calendar.current` 로 돌리면 CI 나
  /// 다른 지역의 기기에서 하루씩 어긋난다.
  static func load() throws -> (Fixture, Date, Calendar) {
    let url = try #require(
      Bundle.module.url(forResource: "date-golden", withExtension: "json")
    )
    let fixture = try JSONDecoder().decode(Fixture.self, from: Data(contentsOf: url))
    let zone = try #require(TimeZone(identifier: fixture.timeZone))
    var calendar = Calendar(identifier: .gregorian)
    calendar.timeZone = zone
    let iso = ISO8601DateFormatter()
    iso.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
    let base = try #require(iso.date(from: fixture.baseTimestamp))
    return (fixture, base, calendar)
  }

  static func isoDate(_ value: String) throws -> Date {
    let iso = ISO8601DateFormatter()
    iso.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
    return try #require(iso.date(from: value))
  }
}

@Test func parseDatesMatchesDesktopForEveryGoldenCase() throws {
  let (fixture, base, calendar) = try DateGolden.load()

  for testCase in fixture.parseDates {
    let actual = DateParser.parseDates(
      testCase.text,
      baseTimestamp: base,
      calendar: calendar
    )
    #expect(
      actual.count == testCase.expected.count,
      "case \(testCase.name): match count — got \(actual.map(\.text))"
    )
    guard actual.count == testCase.expected.count else { continue }

    for (offset, expected) in testCase.expected.enumerated() {
      let got = actual[offset]
      let label = "case \(testCase.name)[\(offset)]"
      #expect(got.text == expected.text, "\(label): text")
      #expect(got.date == (try DateGolden.isoDate(expected.date)), "\(label): date")
      #expect(got.index == expected.index, "\(label): index")
      #expect(got.length == expected.length, "\(label): length")
      #expect(got.kind.rawValue == expected.kind, "\(label): kind")
      #expect(got.hasTime == expected.hasTime, "\(label): hasTime")
    }
  }
}

@Test func goldenFixtureCoversEveryKindAndBothTimeFlags() throws {
  let (fixture, _, _) = try DateGolden.load()
  let matches = fixture.parseDates.flatMap(\.expected)
  let kinds = Set(matches.map(\.kind))

  #expect(kinds == Set(DateMatchKind.allCases.map(\.rawValue)))
  #expect(matches.contains { $0.hasTime })
  #expect(matches.contains { !$0.hasTime })
  #expect(fixture.parseDates.contains { $0.expected.isEmpty })
}

@Test func findNearestDateMatchMatchesDesktopForEveryGoldenCase() throws {
  let (fixture, base, calendar) = try DateGolden.load()
  var parsedByText: [String: [DateMatch]] = [:]

  for testCase in fixture.findNearestDateMatch {
    let matches = parsedByText[testCase.text] ?? DateParser.parseDates(
      testCase.text,
      baseTimestamp: base,
      calendar: calendar
    )
    parsedByText[testCase.text] = matches

    let nearest = DateParser.findNearestDateMatch(matches, cursorIndex: testCase.cursorIndex)
    #expect(
      nearest?.index == testCase.expectedIndex,
      "cursor \(testCase.cursorIndex) in \(testCase.text)"
    )
  }
}
