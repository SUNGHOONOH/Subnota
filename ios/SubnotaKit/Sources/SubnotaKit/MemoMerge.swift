import Foundation
import JavaScriptCore

public struct MergeResult: Sendable, Equatable {
  public let ok: Bool
  public let text: String
}

/// 데스크탑 `lib/mergeMemo.ts` 를 그대로 옮긴 것.
///
/// 병합만은 포팅하지 않고 **데스크탑이 실행하는 그 JS 파일을 그대로 실행한다**
/// (`Resources/diff_match_patch.js` = `desktop/node_modules/diff-match-patch/index.js`,
/// sha256 동일). Objective-C 포팅본을 써 봤더니 무작위 실제형 입력의 5.4% 에서
/// 데스크탑과 다른 텍스트를 내면서 양쪽 다 `ok=true` 를 보고했다 — 오류 없이
/// 두 기기의 문서가 갈리는, 이 Phase 가 유일하게 막으려던 실패다. 같은 코드를
/// 돌리면 그 발산이 정의상 없어지고, 의존성도 하나 줄어든다(JavaScriptCore 는
/// 시스템 프레임워크다).
public enum MemoMerge {
  /// 3-way 병합: 공유 base 이후 서버의 변경을 로컬 텍스트에 얹는다.
  /// Obsidian Sync 가 마크다운 파일에 쓰는 것과 같은 방식이다.
  /// `ok == false` 는 패치를 놓을 자리를 못 찾았다는 뜻 — 호출자는 병합 대신
  /// 복구 보관으로 물러서야 한다.
  public static func merge(base: String, local: String, server: String) -> MergeResult {
    lock.lock()
    defer { lock.unlock() }

    // 엔진이 없거나 JS 가 던지면 **성공했다고 하지 않는다.** 여기서 ok=true 로
    // 물러서면 서버 변경을 조용히 버리게 된다. ok=false 는 복구 보관으로 가므로
    // 무손실이다.
    guard let engine,
          let value = engine.call(withArguments: [base, local, server]),
          !value.isUndefined,
          let text = value.atIndex(1)?.toString()
    else { return MergeResult(ok: false, text: local) }

    // JS `applied.every(Boolean)` 은 빈 패치셋(base == server)에서 참이다.
    // 최소 한 개를 요구하지 말고 그대로 따라간다.
    return MergeResult(ok: value.atIndex(0)?.toBool() ?? false, text: text)
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

  /// `mergeMemo.ts` 의 본문을 그대로 옮긴 것. Swift 쪽은 문자열만 넘기고 받는다.
  private static let shim = """
    function __subnotaMerge(base, local, server) {
      var dmp = new diff_match_patch();
      var patches = dmp.patch_make(base, server);
      var applied = dmp.patch_apply(patches, local);
      return [applied[1].every(Boolean), applied[0]];
    }
    __subnotaMerge;
    """

  /// JSContext 는 스레드 안전하지 않다. 병합은 드물고 짧으니 락 하나로 충분하다.
  /// ponytail: 전역 락. 병합이 병목으로 측정되면 컨텍스트를 액터에 넣을 것.
  private nonisolated(unsafe) static let lock = NSLock()

  /// `JSValue` 가 자기 컨텍스트를 강하게 잡으므로 이 하나만 들고 있으면 된다.
  private nonisolated(unsafe) static let engine: JSValue? = {
    guard let url = Bundle.module.url(forResource: "diff_match_patch", withExtension: "js"),
          let source = try? String(contentsOf: url, encoding: .utf8),
          let context = JSContext()
    else { return nil }

    context.exceptionHandler = { _, exception in
      #if DEBUG
        print("[Subnota][merge] JS 예외: \(exception?.toString() ?? "unknown")")
      #endif
    }
    // 원본 파일은 CommonJS 라 끝에서 `module.exports` 에 쓴다. 파일을 고치면
    // 데스크탑과 같은 코드라는 보장이 깨지므로, 껍데기만 만들어 준다.
    context.evaluateScript("var module = { exports: {} };")
    context.evaluateScript(source)

    let function = context.evaluateScript(shim)
    return function?.isUndefined == false ? function : nil
  }()
}
