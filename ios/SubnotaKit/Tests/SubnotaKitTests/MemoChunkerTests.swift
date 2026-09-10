import Foundation
import Testing
@testable import SubnotaKit

/// `chunker-golden.json` 은 데스크탑 `lib/memoChunker.ts` 를 그대로 돌려서 만들었다.
/// 값이 다르면 같은 메모가 두 기기에서 다른 청크로 잘린다는 뜻이므로, 픽스처가
/// 아니라 구현을 고친다.
///
/// 텍스트는 `String ==` 로 비교하지 않는다 — Swift 는 정준 동치(`é` == `e\u{301}`)를
/// 같다고 보므로 발산을 가린다. UTF-16 코드 유닛 배열로 비교한다.
private enum ChunkerGolden {
  struct Chunk: Decodable {
    let id: String
    let index: Int
    let text: String
    let start: Int
    let end: Int
  }

  struct Cursor: Decodable {
    let cursorIndex: Int
    let found: Int?
    let center: Int?
    let window: [Int]
    let context: String
  }

  struct Document: Decodable {
    let name: String
    let text: String
    let utf16Length: Int
    let chunks: [Chunk]
    let chunkMeaningful: [Bool]
    let endsAtBoundary: Bool
    let isMeaningful: Bool
    let cursors: [Cursor]
    let prefixEndsAtBoundary: String
    let prefixChunkIds: [[String]?]
  }

  struct MinLengthCase: Decodable {
    let name: String
    let text: String
    let minChunkLength: Int
    let chunks: [Chunk]
  }

  struct RadiusCase: Decodable {
    let name: String
    let radius: Int
    let cursorIndex: Int
    let center: Int?
    let window: [Int]
    let context: String
  }

  struct TextCase: Decodable {
    let text: String
    let expected: Bool
  }

  struct Fixture: Decodable {
    let documents: [Document]
    let minChunkLength: [MinLengthCase]
    let radius: [RadiusCase]
    let endsAtBoundary: [TextCase]
    let isMeaningfulChunk: [TextCase]
  }

  static func load() throws -> Fixture {
    let url = try #require(
      Bundle.module.url(forResource: "chunker-golden", withExtension: "json")
    )
    return try JSONDecoder().decode(Fixture.self, from: Data(contentsOf: url))
  }
}

private func units(_ text: String) -> [UInt16] { Array(text.utf16) }

private func expectSame(
  _ got: MemoChunk?,
  _ want: ChunkerGolden.Chunk?,
  _ label: String
) {
  #expect(got?.id == want?.id, "\(label): id")
  #expect(got?.index == want?.index, "\(label): index")
  #expect(got.map { units($0.text) } == want.map { units($0.text) }, "\(label): text")
  #expect(got?.start == want?.start, "\(label): start")
  #expect(got?.end == want?.end, "\(label): end")
}

private func expectSameChunks(
  _ got: [MemoChunk],
  _ want: [ChunkerGolden.Chunk],
  _ label: String
) {
  #expect(got.count == want.count, "\(label): count — got \(got.map(\.id))")
  guard got.count == want.count else { return }
  for (offset, pair) in zip(got, want).enumerated() {
    expectSame(pair.0, pair.1, "\(label)[\(offset)]")
  }
}

@Test func goldenFixtureDecodesTextsExactly() throws {
  // JSONDecoder 가 BOM·NEL·결합 문자를 건드리면 아래 테스트가 전부 헛돈다.
  for doc in try ChunkerGolden.load().documents {
    #expect(doc.text.utf16.count == doc.utf16Length, "\(doc.name)")
  }
}

@Test func chunkMemoTextMatchesDesktopForEveryDocument() throws {
  for doc in try ChunkerGolden.load().documents {
    let chunks = MemoChunker.chunkMemoText(doc.text)
    expectSameChunks(chunks, doc.chunks, doc.name)
    #expect(
      chunks.map { MemoChunker.isMeaningfulChunk($0.text) } == doc.chunkMeaningful,
      "\(doc.name): chunk isMeaningful"
    )
    #expect(MemoChunker.endsAtBoundary(doc.text) == doc.endsAtBoundary, "\(doc.name): endsAtBoundary")
    #expect(MemoChunker.isMeaningfulChunk(doc.text) == doc.isMeaningful, "\(doc.name): isMeaningful")
  }
}

@Test func everyPrefixMatchesDesktop() throws {
  for doc in try ChunkerGolden.load().documents {
    let text = doc.text as NSString
    let bits = Array(doc.prefixEndsAtBoundary)
    #expect(bits.count == text.length + 1, "\(doc.name): prefix count")
    for length in 0...text.length where bits[length] != "-" {
      let prefix = text.substring(to: length)
      let label = "\(doc.name) prefix \(length)"
      #expect(MemoChunker.endsAtBoundary(prefix) == (bits[length] == "1"), "\(label): endsAtBoundary")
      #expect(
        MemoChunker.chunkMemoText(prefix).map(\.id) == doc.prefixChunkIds[length],
        "\(label): chunk ids"
      )
    }
  }
}

@Test func cursorLookupsMatchDesktopAtEveryCursor() throws {
  for doc in try ChunkerGolden.load().documents {
    let chunks = MemoChunker.chunkMemoText(doc.text)
    let golden = doc.chunks
    for cursor in doc.cursors {
      let label = "\(doc.name) cursor \(cursor.cursorIndex)"
      expectSame(
        MemoChunker.findChunkAtCursor(chunks, cursorIndex: cursor.cursorIndex),
        cursor.found.map { golden[$0] },
        "\(label) found"
      )
      let window = MemoChunker.getCursorChunkWindow(doc.text, cursorIndex: cursor.cursorIndex)
      expectSame(window.center, cursor.center.map { golden[$0] }, "\(label) center")
      expectSameChunks(window.chunks, cursor.window.map { golden[$0] }, "\(label) window")
      #expect(
        units(MemoChunker.getCursorContextText(doc.text, cursorIndex: cursor.cursorIndex))
          == units(cursor.context),
        "\(label): context"
      )
    }
  }
}

@Test func radiusVariantsMatchDesktop() throws {
  let fixture = try ChunkerGolden.load()
  for testCase in fixture.radius {
    let doc = try #require(fixture.documents.first { $0.name == testCase.name })
    let label = "\(testCase.name) r\(testCase.radius) cursor \(testCase.cursorIndex)"
    let window = MemoChunker.getCursorChunkWindow(
      doc.text, cursorIndex: testCase.cursorIndex, radius: testCase.radius
    )
    expectSame(window.center, testCase.center.map { doc.chunks[$0] }, "\(label) center")
    expectSameChunks(window.chunks, testCase.window.map { doc.chunks[$0] }, "\(label) window")
    #expect(
      units(MemoChunker.getCursorContextText(
        doc.text, cursorIndex: testCase.cursorIndex, radius: testCase.radius
      )) == units(testCase.context),
      "\(label): context"
    )
  }
}

@Test func minChunkLengthOptionMatchesDesktop() throws {
  for testCase in try ChunkerGolden.load().minChunkLength {
    expectSameChunks(
      MemoChunker.chunkMemoText(testCase.text, minChunkLength: testCase.minChunkLength),
      testCase.chunks,
      "\(testCase.name) min \(testCase.minChunkLength)"
    )
  }
}

@Test func standaloneBoundaryAndMeaningfulCasesMatchDesktop() throws {
  let fixture = try ChunkerGolden.load()
  for testCase in fixture.endsAtBoundary {
    #expect(
      MemoChunker.endsAtBoundary(testCase.text) == testCase.expected,
      "endsAtBoundary \(testCase.text.unicodeScalars.map { String($0.value, radix: 16) })"
    )
  }
  for testCase in fixture.isMeaningfulChunk {
    #expect(
      MemoChunker.isMeaningfulChunk(testCase.text) == testCase.expected,
      "isMeaningfulChunk \(testCase.text.unicodeScalars.map { String($0.value, radix: 16) })"
    )
  }
}
