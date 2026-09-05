import Testing
@testable import SubnotaKit

/// 식별자가 조용히 바뀌면 위젯이 빈 DB를 보게 된다. 문자열을 고정해 둔다.
@Test func appGroupIdentifierIsPinned() {
  #expect(AppGroup.identifier == "group.com.subnota.capture")
}
