import Foundation

/// 데스크탑 `lib/contentHash.ts` 의 FNV-1a 를 그대로 옮긴 것.
///
/// JS 는 `text.charCodeAt(i)` 로 **UTF-16 코드 유닛**을 순회한다. Swift 에서
/// `utf8` 이나 `unicodeScalars` 로 돌면 한글·이모지에서 값이 갈리고, 그러면
/// 서버가 우리 푸시를 전부 충돌로 판정한다.
public enum ContentHash {
  public static func hash(_ text: String) -> String {
    var hash: UInt32 = 2_166_136_261
    for unit in text.utf16 {
      hash ^= UInt32(unit)
      hash = hash &* 16_777_619
    }
    return String(hash, radix: 36)
  }
}
