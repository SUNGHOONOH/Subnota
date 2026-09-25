import Foundation

/// 비밀번호 확인 입력의 글자별 일치 판정. 뷰에서 떼어낸 이유는 하나다 —
/// 시뮬레이터의 암호 제안 시트가 키 입력을 삼켜서 화면으로는 검증이 안 된다.
public enum PasswordMatch {
  /// 입력한 글자마다 그 자리가 원본과 같은지 돌려준다.
  /// 원본보다 길게 들어온 뒷글자는 맞을 수 없으므로 `false`.
  public static func marks(typed: String, against target: String) -> [Bool] {
    let target = Array(target)
    return Array(typed).enumerated().map { index, character in
      index < target.count && target[index] == character
    }
  }

  /// 처음으로 어긋난 위치(0-based). 전부 맞으면 nil — 아직 다 못 친 경우도 포함한다.
  public static func firstMismatch(typed: String, against target: String) -> Int? {
    marks(typed: typed, against: target).firstIndex(of: false)
  }

  /// 데스크탑과 같은 규칙: 원본이 비어 있지 않고 완전히 같을 때만 일치다.
  public static func isComplete(typed: String, against target: String) -> Bool {
    !target.isEmpty && typed == target
  }
}
