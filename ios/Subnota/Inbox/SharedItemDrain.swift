import Foundation
import SubnotaKit

/// 공유 확장이 App Group 에 쌓아 둔 큐를 서버 항목으로 만든다.
///
/// **확장은 서버에 직접 올리지 않는다.** 그러려면 Supabase 세션 토큰을 확장에서도
/// 읽어야 하고(공유 Keychain 그룹) 그건 이 Phase 범위 밖이다. 확장은 App Group 에
/// durable 하게 큐잉만 하고, 서버 생성은 앱이 다음에 켜질 때 여기서 한다.
enum SharedItemDrain {
  static let queueKey = "pendingSharePayloads"

  /// **서버가 받은 뒤에 큐에서 지운다.** 먼저 지우고 실패하면 사용자가 공유한
  /// 링크가 아무 흔적 없이 사라진다. 실패한 항목은 큐에 남겨 다음 실행에서 다시
  /// 시도한다 — 같은 항목을 두 번 올려도 `clientId` 로 서버가 하나로 친다.
  static func drain() async {
    guard let defaults = UserDefaults(suiteName: AppGroup.identifier) else { return }
    let remote = InboxRemote()

    // 확장은 큐 앞에 넣는다. 오래된 것부터 만들어야 목록에서 공유한 순서가 남는다.
    for item in queue(defaults).reversed() {
      guard let url = item["url"], !url.isEmpty else {
        // URL 이 없으면 링크로 만들 수 없다. 남겨 두면 영영 안 빠진다.
        remove(item, from: defaults)
        continue
      }
      do {
        _ = try await remote.create(
          url: url,
          // 확장이 큐에 넣을 때 만든 안정적인 값이다. 없으면(예전 큐) 공유 시각으로
          // 대신한다 — 서버는 canonical_url 로도 중복을 접는다.
          clientId: item["clientId"] ?? item["createdAt"].map { "share-\($0)" },
          rawSharedText: item["rawSharedText"],
          userNote: item["userNote"])
        remove(item, from: defaults)
      } catch {
        // 로그인 전이거나 네트워크가 없을 뿐이다. 큐에 남겨 다음에 다시 시도한다.
        log(error)
      }
    }
  }

  private static func queue(_ defaults: UserDefaults) -> [[String: String]] {
    defaults.array(forKey: queueKey) as? [[String: String]] ?? []
  }

  /// 지울 때마다 큐를 다시 읽는다 — 드레인이 도는 사이 확장이 새로 넣은 항목을
  /// 통째로 덮어쓰지 않기 위해서다.
  private static func remove(_ item: [String: String], from defaults: UserDefaults) {
    var rest = queue(defaults)
    rest.removeAll { $0 == item }
    defaults.set(rest, forKey: queueKey)
  }

  private static func log(_ error: Error) {
    #if DEBUG
      print("[Subnota][share] \(String(reflecting: error))")
    #endif
  }
}
