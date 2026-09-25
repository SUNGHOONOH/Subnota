import Foundation

/// 데스크탑 `desktop/src/lib/memoChunker.ts` 포팅. 같은 메모가 두 기기에서 다른
/// 청크로 잘리면 색인과 질의가 어긋나므로, 동작이 갈리면 `chunker-golden.json` 이
/// 아니라 여기를 고친다.
///
/// 전부 UTF-16 코드 유닛(JS 문자열 인덱스) 위에서 계산한다. Swift `String` 비교
/// (`==`, `hasPrefix`)는 정준 동치라 분해형 한글 `ᄀ ᅡ ᇀ` 을 `같` 과 같다고 본다 —
/// JS 는 다르게 본다. 그래서 문자 비교도 코드 유닛으로만 한다.
public struct MemoChunk: Sendable, Equatable {
  public let id: String
  public let index: Int
  public let text: String
  /// UTF-16 코드 유닛 오프셋.
  public let start: Int
  /// UTF-16 코드 유닛 오프셋(끝, 미포함).
  public let end: Int
}

public struct ChunkWindow: Sendable, Equatable {
  public let center: MemoChunk?
  public let chunks: [MemoChunk]
}

public enum MemoChunker {
  public static let defaultMinChunkLength = 2

  public static func chunkMemoText(
    _ text: String,
    minChunkLength: Int = defaultMinChunkLength
  ) -> [MemoChunk] {
    let units = Array(text.utf16)
    var ranges: [Range<Int>] = []
    var chunkStart = 0

    func append(_ rawStart: Int, _ rawEnd: Int) {
      let range = trimRange(units, rawStart, rawEnd)
      if range.count >= minChunkLength { ranges.append(range) }
    }

    for match in boundaryMatches(text, units) {
      // JS `/^\r?\n+$/.test(matched)` — 줄바꿈 가지만 \r·\n 으로 시작한다.
      let first = units[match.lowerBound]
      let isLineBreak = first == lineFeed || first == carriageReturn
      append(chunkStart, isLineBreak ? match.lowerBound : match.upperBound)
      chunkStart = match.upperBound
    }
    append(chunkStart, units.count)

    return ranges.enumerated().map { index, range in
      MemoChunk(
        id: "chunk-\(index)-\(range.lowerBound)-\(range.upperBound)",
        index: index,
        text: String(decoding: units[range], as: UTF16.self),
        start: range.lowerBound,
        end: range.upperBound
      )
    }
  }

  public static func findChunkAtCursor(_ chunks: [MemoChunk], cursorIndex: Int) -> MemoChunk? {
    guard let first = chunks.first else { return nil }
    let cursor = max(0, cursorIndex)
    if let containing = chunks.first(where: { cursor >= $0.start && cursor <= $0.end }) {
      return containing
    }
    // JS reduce 는 `<` 일 때만 바꾸므로 동점이면 앞 청크가 이긴다.
    return chunks.reduce(first) { nearest, chunk in
      distance(cursor, chunk) < distance(cursor, nearest) ? chunk : nearest
    }
  }

  public static func getCursorChunkWindow(
    _ text: String,
    cursorIndex: Int,
    radius: Int = 1
  ) -> ChunkWindow {
    let chunks = chunkMemoText(text)
    guard let center = findChunkAtCursor(chunks, cursorIndex: cursorIndex) else {
      return ChunkWindow(center: nil, chunks: [])
    }
    let units = Array(text.utf16)

    // 줄바꿈은 블록 경계: 윈도우는 커서가 있는 줄 안에서만 확장한다.
    var startIndex = center.index
    while startIndex > 0,
          center.index - startIndex < radius,
          !hasLineBreakBetween(units, chunks[startIndex - 1], chunks[startIndex]) {
      startIndex -= 1
    }
    var endIndex = center.index + 1
    while endIndex < chunks.count,
          endIndex - center.index - 1 < radius,
          !hasLineBreakBetween(units, chunks[endIndex - 1], chunks[endIndex]) {
      endIndex += 1
    }
    return ChunkWindow(center: center, chunks: Array(chunks[startIndex..<endIndex]))
  }

  /// 글자·숫자가 하나도 없는 조각(구분선, 빈 체크박스, 표 구분행)은 거른다.
  /// JS 정규식(비 유니코드 모드)은 코드 유닛 단위라 여기도 코드 유닛으로 본다.
  public static func isMeaningfulChunk(_ text: String) -> Bool {
    text.utf16.contains { unit in meaningfulRanges.contains { $0.contains(unit) } }
  }

  public static func getCursorContextText(
    _ text: String,
    cursorIndex: Int,
    radius: Int = 1
  ) -> String {
    let joined = getCursorChunkWindow(text, cursorIndex: cursorIndex, radius: radius)
      .chunks.map(\.text).joined(separator: "\n")
    let units = Array(joined.utf16)
    return String(decoding: units[trimRange(units, 0, units.count)], as: UTF16.self)
  }

  public static func endsAtBoundary(_ text: String) -> Bool {
    // JS `trimEnd()` — 뒤만 자른다. 앞을 자르면 match.index 가 달라진다.
    var units = Array(text.utf16)
    while let last = units.last, isJSWhitespace(last) { units.removeLast() }
    guard !units.isEmpty else { return false }
    let trimmed = String(decoding: units, as: UTF16.self)
    return boundaryMatches(trimmed, units).contains { $0.upperBound == units.count }
  }
}

// ── 경계 정규식 ─────────────────────────────────────────────────
//
// JS 원본:
//   /\r?\n+|[.!?。！？…]+["'”’」』》)\]]*(?=\s|$)|(?:해야\s*함|할\s*것|함|됨|
//    [것중거정]임|[음슴다]|야지|[ㅋㅎㅠㅜ]{2,})(?=\s|$)/g
//
// ICU 와 다른 두 곳을 JS 의미로 바꿨다(DateParser.swift 상단과 같은 이유):
//   `\s` ICU 는 VT·BOM 을 빼므로 JS 집합을 그대로 적는다.
//   `$`  ICU 는 입력 끝의 **마지막 줄 끝 문자 앞**에서도 맞는다(NEL U+0085 포함).
//        JS 는 입력 끝에서만. `\z` 로 바꾼다. "확인함\u{85}" 이 여기서 갈린다.

private let jsSpaceClass =
  "[" + jsWhitespaceScalars.sorted().map { String(format: "\\u%04x", $0) }.joined() + "]"

private let boundaryRegex = try! NSRegularExpression(pattern:
  "\\r?\\n+"
  + "|[.!?\u{3002}\u{FF01}\u{FF1F}\u{2026}]+[\"'\u{201D}\u{2019}\u{300D}\u{300F}\u{300B})\\]]*"
  + "(?=\(jsSpaceClass)|\\z)"
  + "|(?:해야\(jsSpaceClass)*함|할\(jsSpaceClass)*것|함|됨|[것중거정]임|[음슴다]|야지|[ㅋㅎㅠㅜ]{2,})"
  + "(?=\(jsSpaceClass)|\\z)"
)

private let lineFeed: UInt16 = 0x0A
private let carriageReturn: UInt16 = 0x0D
private let period: UInt16 = 0x2E

private func unit(_ scalar: Unicode.Scalar) -> UInt16 { UInt16(scalar.value) }

private let terminalPunctuation = Set(".!?\u{3002}\u{FF01}\u{FF1F}\u{2026}".utf16)
private let closingQuotes = Set("\"'\u{201D}\u{2019}\u{300D}\u{300F}\u{300B})]".utf16)
/// 음슴체 '~음'이 붙는 형용사 어간 화이트리스트 (좋음/없음/같음…).
private let umStems = Set("좋없있같맞많적높낮늦길짧".utf16)
private let auxiliaryAfterDa = Set("오온왔와".utf16)
private let hamNounPrefixes = Set("포명결".utf16)
private let quoteVerbEndings = Set("고며면".utf16)
private let haEndings = Set("고며".utf16)

/// 백엔드 splitter 의 약어 목록과 같다.
private let englishAbbreviations: Set<String> = [
  "mr", "mrs", "ms", "dr", "prof", "sr", "jr", "vs", "etc", "eg", "ie", "ca",
  "co", "corp", "inc", "ltd", "st", "ave", "rd", "jan", "feb", "mar", "apr",
  "jun", "jul", "aug", "sep", "oct", "nov", "dec", "vol", "ed", "pp", "al",
]

/// `[0-9A-Za-z가-힣ㄱ-ㅎㅏ-ㅣ぀-ヿ一-鿿]`
private let meaningfulRanges: [ClosedRange<UInt16>] = [
  0x30...0x39, 0x41...0x5A, 0x61...0x7A, 0xAC00...0xD7A3,
  0x3131...0x314E, 0x314F...0x3163, 0x3040...0x30FF, 0x4E00...0x9FFF,
]

private func isJSWhitespace(_ value: UInt16) -> Bool {
  jsWhitespaceScalars.contains(UInt32(value))
}

private func isASCIILetter(_ value: UInt16) -> Bool {
  (0x41...0x5A).contains(value) || (0x61...0x7A).contains(value)
}

/// 받침이 ㅆ인 음절 (했/었/갔/왔…).
private func hasSsangSiotFinal(_ value: UInt16?) -> Bool {
  guard let value, value >= 0xAC00 else { return false }
  let offset = Int(value) - 0xAC00
  return offset < 11172 && offset % 28 == 20
}

private func boundaryMatches(_ text: String, _ units: [UInt16]) -> [Range<Int>] {
  boundaryRegex
    .matches(in: text, range: NSRange(location: 0, length: units.count))
    .map { $0.range.location..<NSMaxRange($0.range) }
    .filter { !isFalseBoundary(units, $0) }
}

private func isFalseBoundary(_ units: [UInt16], _ match: Range<Int>) -> Bool {
  let first = units[match.lowerBound]
  // JS `/^\r?\n/`
  if first == lineFeed
    || (first == carriageReturn && match.count > 1 && units[match.lowerBound + 1] == lineFeed) {
    return false
  }

  let prevChar: UInt16? = match.lowerBound > 0 ? units[match.lowerBound - 1] : nil
  // JS `text.slice(end).trimStart()` 의 앞 글자들.
  var afterStart = match.upperBound
  while afterStart < units.count, isJSWhitespace(units[afterStart]) { afterStart += 1 }
  func after(_ offset: Int) -> UInt16? {
    afterStart + offset < units.count ? units[afterStart + offset] : nil
  }
  let matched = units[match]

  if terminalPunctuation.contains(first) {
    // 영문 소문자로 이어지면 문장 중간.
    if let next = after(0), (0x61...0x7A).contains(next) { return true }
    if matched.contains(period) {
      var wordStart = match.lowerBound
      while wordStart > 0, isASCIILetter(units[wordStart - 1]) { wordStart -= 1 }
      let word = units[wordStart..<match.lowerBound]
      if !word.isEmpty,
         word.count == 1
          || englishAbbreviations.contains(String(decoding: word, as: UTF16.self).lowercased()) {
        return true
      }
    }
    // 닫는 따옴표 뒤 인용 연속 `/^(이?라[고며면]|하[고며]|라는)/`: 그는 "좋다." 라고 말했다.
    if matched.contains(where: closingQuotes.contains) {
      let a0 = after(0), a1 = after(1), a2 = after(2)
      let quoteContinues =
        (a0 == unit("이") && a1 == unit("라") && a2.map(quoteVerbEndings.contains) == true)
        || (a0 == unit("라") && (a1.map(quoteVerbEndings.contains) == true || a1 == unit("는")))
        || (a0 == unit("하") && a1.map(haEndings.contains) == true)
      if quoteContinues { return true }
    }
    return false
  }

  if match.count == 1, first == unit("음") || first == unit("슴") {
    return !(hasSsangSiotFinal(prevChar) || prevChar.map(umStems.contains) == true)
  }
  if match.count == 1, first == unit("다") {
    // ㅆ받침 과거형(했다/었다)만 인정하되 "갔다 왔다"류 보조 연결은 제외.
    return !hasSsangSiotFinal(prevChar) || after(0).map(auxiliaryAfterDa.contains) == true
  }
  if match.count == 1, first == unit("함") {
    // 명사 오탐: 포함/명함/결함.
    return prevChar.map(hamNounPrefixes.contains) == true
  }
  if matched.contains(unit("것")) {
    // "~할 것 같다"는 종결이 아니다.
    return after(0) == unit("같")
  }
  return false
}

private func trimRange(_ units: [UInt16], _ start: Int, _ end: Int) -> Range<Int> {
  var nextStart = max(0, start)
  var nextEnd = min(units.count, max(start, end))
  while nextStart < nextEnd, isJSWhitespace(units[nextStart]) { nextStart += 1 }
  while nextEnd > nextStart, isJSWhitespace(units[nextEnd - 1]) { nextEnd -= 1 }
  return nextStart..<nextEnd
}

private func hasLineBreakBetween(_ units: [UInt16], _ left: MemoChunk, _ right: MemoChunk) -> Bool {
  left.end < right.start && units[left.end..<right.start].contains(lineFeed)
}

private func distance(_ cursor: Int, _ chunk: MemoChunk) -> Int {
  if cursor >= chunk.start && cursor <= chunk.end { return 0 }
  return min(abs(cursor - chunk.start), abs(cursor - chunk.end))
}
