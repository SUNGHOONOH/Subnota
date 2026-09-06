import Foundation
import diff_match_patch

public struct MergeResult: Sendable, Equatable {
  public let ok: Bool
  public let text: String
}

/// 데스크탑 `lib/mergeMemo.ts` 를 그대로 옮긴 것.
public enum MemoMerge {
  /// 3-way 병합: 공유 base 이후 서버의 변경을 로컬 텍스트에 얹는다.
  /// Obsidian Sync 가 마크다운 파일에 쓰는 것과 같은 방식이다.
  /// `ok == false` 는 패치를 놓을 자리를 못 찾았다는 뜻 — 호출자는 병합 대신
  /// 복구 보관으로 물러서야 한다.
  public static func merge(base: String, local: String, server: String) -> MergeResult {
    let dmp = DiffMatchPatch()
    let patches = dmp.patch_make(fromOldString: base, andNewString: server) as? [Any] ?? []
    let result = dmp.patch_apply(patches, to: local)
    let text = result?[0] as? String ?? local
    let applied = result?[1] as? [NSNumber] ?? []
    // JS `applied.every(Boolean)` is vacuously true for an empty patch set
    // (base == server): mirror that, don't require at least one patch.
    let ok = applied.allSatisfy { $0.boolValue }
    return MergeResult(ok: ok, text: text)
  }

  /// 열려 있는 에디터는 정본이 바뀌어도 통째로 갈아끼우지 않는다. 마지막 편집
  /// 트랜잭션(previous -> next)만 정본 위에 다시 얹는다.
  public static func rebaseEditorChange(
    previous: String,
    next: String,
    canonical: String
  ) -> MergeResult {
    let rebased = merge(base: previous, local: canonical, server: next)
    if rebased.ok { return rebased }

    // 반대 방향이 넓은 정본 패치를 놓을 수 있다. 둘 다 안 되면 가장 최신 입력을
    // 지키고, 정본은 호출자가 복구용으로 남긴다.
    let inverse = merge(base: previous, local: next, server: canonical)
    return inverse.ok ? inverse : MergeResult(ok: false, text: next)
  }
}
