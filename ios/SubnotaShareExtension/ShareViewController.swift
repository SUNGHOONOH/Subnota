import Social
import UniformTypeIdentifiers

/// `mobile/ios/SubnotaShareExtension/ShareViewController.swift` 에서 이식했다.
///
/// **확장은 App Group 큐에 durable 하게 넣기만 한다. 서버 생성은 앱이 다음에 켜질
/// 때 `SharedItemDrain` 이 한다.** 여기서 바로 `POST /inbox/sessions` 를 하려면
/// Supabase 세션 토큰을 확장에서도 읽어야 하고(공유 Keychain 그룹 설정) 그건 이
/// Phase 범위 밖이다. 그래서 "앱을 안 열어도 저장된다"는 기기에 남는다는 뜻이다.
final class ShareViewController: SLComposeServiceViewController {
  private let appGroupId = "group.com.subnota.capture"

  override func isContentValid() -> Bool {
    return true
  }

  override func didSelectPost() {
    Task {
      let payload = await extractPayload()
      savePayload(payload)
      extensionContext?.completeRequest(returningItems: nil)
    }
  }

  override func configurationItems() -> [Any]! {
    return []
  }

  private func extractPayload() async -> [String: String] {
    guard let item = extensionContext?.inputItems.first as? NSExtensionItem,
          let attachments = item.attachments else {
      return [:]
    }

    var payload: [String: String] = [:]
    if let text = contentText, !text.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty {
      payload["userNote"] = text
    }

    for provider in attachments {
      if provider.hasItemConformingToTypeIdentifier(UTType.url.identifier),
         let value = await loadString(provider, typeIdentifier: UTType.url.identifier) {
        payload["url"] = value
        break
      }

      if provider.hasItemConformingToTypeIdentifier(UTType.plainText.identifier),
         let text = await loadString(provider, typeIdentifier: UTType.plainText.identifier) {
        payload["rawSharedText"] = text
        if payload["url"] == nil,
           let url = firstURL(in: text) {
          payload["url"] = url
        }
      }
    }

    return payload
  }

  /// 원본은 `NSSecureCoding` 을 그대로 넘겼지만 Swift 6 에서는 continuation 을
  /// 건너는 값이 Sendable 이어야 한다. 클로저 안에서 문자열로 좁혀 넘긴다.
  private func loadString(_ provider: NSItemProvider, typeIdentifier: String) async -> String? {
    await withCheckedContinuation { continuation in
      provider.loadItem(forTypeIdentifier: typeIdentifier, options: nil) { item, _ in
        continuation.resume(returning: (item as? URL)?.absoluteString ?? item as? String)
      }
    }
  }

  private func savePayload(_ payload: [String: String]) {
    guard !payload.isEmpty,
          let defaults = UserDefaults(suiteName: appGroupId) else {
      return
    }

    var queue = defaults.array(forKey: "pendingSharePayloads") as? [[String: String]] ?? []
    var next = payload
    next["createdAt"] = ISO8601DateFormatter().string(from: Date())
    // 항목마다 **여기서 한 번** 만든다. 앱이 올릴 때 만들면 재시도마다 값이 달라져
    // 서버의 중복 방지가 무의미해진다.
    next["clientId"] = UUID().uuidString
    queue.insert(next, at: 0)
    // 20개를 넘으면 오래된 것부터 버린다(기존 동작 그대로).
    defaults.set(Array(queue.prefix(20)), forKey: "pendingSharePayloads")
    // 확장은 completeRequest 직후 죽는다. synchronize 는 no-op 이라지만 원본대로
    // 남겨 둔다 — 공유한 링크가 디스크에 닿기 전에 사라지는 쪽이 더 비싸다.
    defaults.synchronize()
  }

  private func firstURL(in text: String) -> String? {
    let detector = try? NSDataDetector(types: NSTextCheckingResult.CheckingType.link.rawValue)
    let range = NSRange(text.startIndex..<text.endIndex, in: text)
    return detector?.firstMatch(in: text, options: [], range: range)?.url?.absoluteString
  }
}
