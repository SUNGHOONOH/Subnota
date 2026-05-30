import Social
import UniformTypeIdentifiers

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
         let value = await loadItem(provider, typeIdentifier: UTType.url.identifier) {
        if let url = value as? URL {
          payload["url"] = url.absoluteString
          break
        }
        if let text = value as? String {
          payload["url"] = text
          break
        }
      }

      if provider.hasItemConformingToTypeIdentifier(UTType.plainText.identifier),
         let value = await loadItem(provider, typeIdentifier: UTType.plainText.identifier),
         let text = value as? String {
        payload["rawSharedText"] = text
        if payload["url"] == nil,
           let url = firstURL(in: text) {
          payload["url"] = url
        }
      }
    }

    return payload
  }

  private func loadItem(_ provider: NSItemProvider, typeIdentifier: String) async -> NSSecureCoding? {
    await withCheckedContinuation { continuation in
      provider.loadItem(forTypeIdentifier: typeIdentifier, options: nil) { item, _ in
        continuation.resume(returning: item as? NSSecureCoding)
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
    queue.insert(next, at: 0)
    defaults.set(Array(queue.prefix(20)), forKey: "pendingSharePayloads")
    defaults.synchronize()
  }

  private func firstURL(in text: String) -> String? {
    let detector = try? NSDataDetector(types: NSTextCheckingResult.CheckingType.link.rawValue)
    let range = NSRange(text.startIndex..<text.endIndex, in: text)
    return detector?.firstMatch(in: text, options: [], range: range)?.url?.absoluteString
  }
}
