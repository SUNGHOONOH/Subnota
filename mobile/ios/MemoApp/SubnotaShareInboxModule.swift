import Foundation
import React

@objc(SubnotaShareInboxModule)
final class SubnotaShareInboxModule: NSObject {
  private let appGroupId = "group.com.subnota.capture"
  private let pendingKey = "pendingSharePayloads"

  @objc
  static func requiresMainQueueSetup() -> Bool {
    return false
  }

  @objc
  func consumePendingShares(
    _ resolve: RCTPromiseResolveBlock,
    rejecter reject: RCTPromiseRejectBlock
  ) {
    guard let defaults = UserDefaults(suiteName: appGroupId) else {
      resolve([])
      return
    }

    let payloads = defaults.array(forKey: pendingKey) as? [[String: String]] ?? []
    defaults.set([], forKey: pendingKey)
    defaults.synchronize()
    resolve(payloads)
  }
}
