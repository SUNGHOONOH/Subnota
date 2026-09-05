import Foundation

/// Hashable 은 SwiftUI 의 navigationDestination(item:) 이 요구한다 — 지우지 말 것.
public struct Memo: Codable, Sendable, Equatable, Hashable, Identifiable {
  public let id: String
  public var content: String
  public var category: String?
  public var createdAt: Date
  public var contentUpdatedAt: Date

  public init(
    id: String, content: String, category: String?,
    createdAt: Date, contentUpdatedAt: Date
  ) {
    self.id = id
    self.content = content
    self.category = category
    self.createdAt = createdAt
    self.contentUpdatedAt = contentUpdatedAt
  }
}
