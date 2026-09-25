import Foundation

/// 로컬 페이로드 JSON 의 인코딩·디코딩. 기본 `.iso8601` 전략은 소수점 초를 버려서
/// 저장→읽기 왕복마다 시각이 초 단위로 잘린다. 서버 문자열과 같은 형식을 내는
/// `ServerTimestamp` 를 그대로 재사용한다.
enum PayloadCoder {
  static func encode<T: Encodable>(_ value: T) throws -> String {
    String(decoding: try encoder.encode(value), as: UTF8.self)
  }

  static func decode<T: Decodable>(_ type: T.Type, from json: String) throws -> T {
    try decoder.decode(type, from: Data(json.utf8))
  }

  private static let encoder: JSONEncoder = {
    let e = JSONEncoder()
    e.dateEncodingStrategy = .custom { date, encoder in
      var container = encoder.singleValueContainer()
      try container.encode(ServerTimestamp.string(from: date))
    }
    return e
  }()

  private static let decoder: JSONDecoder = {
    let d = JSONDecoder()
    d.dateDecodingStrategy = .custom { decoder in
      let container = try decoder.singleValueContainer()
      let raw = try container.decode(String.self)
      guard let date = ServerTimestamp.parse(raw) else {
        throw DecodingError.dataCorruptedError(
          in: container, debugDescription: "Invalid ISO8601 date: \(raw)"
        )
      }
      return date
    }
    return d
  }()
}
