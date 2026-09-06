import Testing
@testable import SubnotaKit

@Test func marksMatchingPrefixThenDivergence() {
  // 앞 4글자는 같고 5·6번째가 다르다 — 알약이 초록 4개 뒤 빨강 2개, 다시 초록 2개.
  let marks = PasswordMatch.marks(typed: "AbcdXY12", against: "Abcdef12")
  #expect(marks == [true, true, true, true, false, false, true, true])
}

@Test func marksAreAllTrueOnExactMatch() {
  #expect(PasswordMatch.marks(typed: "Abcdef12", against: "Abcdef12").allSatisfy { $0 })
}

@Test func charactersPastTheTargetLengthCannotMatch() {
  let marks = PasswordMatch.marks(typed: "Abcdef12X", against: "Abcdef12")
  #expect(marks.count == 9)
  #expect(marks.last == false)
}

@Test func emptyInputHasNoMarks() {
  #expect(PasswordMatch.marks(typed: "", against: "Abcdef12").isEmpty)
}

@Test func caseMattersPerCharacter() {
  // 대소문자만 다른 경우도 그 자리에서 빨강이어야 한다.
  #expect(PasswordMatch.marks(typed: "abc", against: "Abc") == [false, true, true])
}

@Test func firstMismatchReportsThePosition() {
  #expect(PasswordMatch.firstMismatch(typed: "AbcdXY12", against: "Abcdef12") == 4)
  #expect(PasswordMatch.firstMismatch(typed: "Abcd", against: "Abcdef12") == nil)
}

@Test func isCompleteOnlyWhenFullyEqualAndTargetIsNotEmpty() {
  #expect(PasswordMatch.isComplete(typed: "Abcdef12", against: "Abcdef12"))
  #expect(!PasswordMatch.isComplete(typed: "Abcd", against: "Abcdef12"))
  // 원본이 비어 있으면 빈 입력도 일치로 보지 않는다 — 데스크탑과 같은 규칙.
  #expect(!PasswordMatch.isComplete(typed: "", against: ""))
}

@Test func handlesMultiByteCharacters() {
  // 한글·이모지도 글자 단위로 세야 한다. UTF-16 오프셋으로 세면 어긋난다.
  #expect(PasswordMatch.marks(typed: "가나다", against: "가나라") == [true, true, false])
  #expect(PasswordMatch.marks(typed: "a👍b", against: "a👍c") == [true, true, false])
}
