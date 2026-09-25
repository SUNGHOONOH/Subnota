import Foundation

/// Hashable 은 SwiftUI 의 navigationDestination(item:) 이 요구한다 — 지우지 말 것.
public struct Memo: Codable, Sendable, Equatable, Hashable, Identifiable {
  public let id: String
  public var content: String
  public var category: String?
  public var createdAt: Date
  public var contentUpdatedAt: Date
  /// 휴지통에 있는지. 서버 `memos.is_archived` 와 같은 뜻이다.
  public var isArchived: Bool

  public init(
    id: String, content: String, category: String?,
    createdAt: Date, contentUpdatedAt: Date, isArchived: Bool = false
  ) {
    self.id = id
    self.content = content
    self.category = category
    self.createdAt = createdAt
    self.contentUpdatedAt = contentUpdatedAt
    self.isArchived = isArchived
  }

  /// Phase 0+1 이 저장한 페이로드에는 isArchived 키가 없다. 합성된 디코더는
  /// 거기서 실패하고, 그러면 기존 메모가 목록에서 통째로 사라진다.
  public init(from decoder: Decoder) throws {
    let c = try decoder.container(keyedBy: CodingKeys.self)
    id = try c.decode(String.self, forKey: .id)
    content = try c.decode(String.self, forKey: .content)
    category = try c.decodeIfPresent(String.self, forKey: .category)
    createdAt = try c.decode(Date.self, forKey: .createdAt)
    contentUpdatedAt = try c.decode(Date.self, forKey: .contentUpdatedAt)
    isArchived = try c.decodeIfPresent(Bool.self, forKey: .isArchived) ?? false
  }
}
