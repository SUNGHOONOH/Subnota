import CryptoKit
import Foundation
import SubnotaKit
import Testing
@testable import SubnotaSearch

/// Range 를 존중하는 가짜 서버. 모든 요청의 Range 헤더를 기록한다.
private final class StubServer: URLProtocol {
  nonisolated(unsafe) static var payload = Data()
  nonisolated(unsafe) static var ranges: [String?] = []

  override class func canInit(with request: URLRequest) -> Bool { true }
  override class func canonicalRequest(for request: URLRequest) -> URLRequest { request }
  override func stopLoading() {}

  override func startLoading() {
    let range = request.value(forHTTPHeaderField: "Range")
    Self.ranges.append(range)
    let start = range.flatMap { Int($0.dropFirst("bytes=".count).dropLast()) } ?? 0
    let body = Self.payload.subdata(in: start..<Self.payload.count)
    var headers = ["Content-Length": "\(body.count)"]
    if start > 0 {
      headers["Content-Range"] = "bytes \(start)-\(Self.payload.count - 1)/\(Self.payload.count)"
    }
    let response = HTTPURLResponse(
      url: request.url!, statusCode: start > 0 ? 206 : 200, httpVersion: "HTTP/1.1", headerFields: headers
    )!
    client?.urlProtocol(self, didReceive: response, cacheStoragePolicy: .notAllowed)
    client?.urlProtocol(self, didLoad: body)
    client?.urlProtocolDidFinishLoading(self)
  }
}

@Suite(.serialized)
struct ModelDownloaderTests {
  private let payload = Data((0..<100_000).map { UInt8($0 % 251) })
  private let directory = FileManager.default.temporaryDirectory
    .appending(path: "model-downloader-\(UUID().uuidString)", directoryHint: .isDirectory)

  private var configuration: URLSessionConfiguration {
    let configuration = URLSessionConfiguration.ephemeral
    configuration.protocolClasses = [StubServer.self]
    return configuration
  }

  private func file(sha256: String? = nil) -> EmbeddingModel.File {
    let digest = SHA256.hash(data: payload).map { String(format: "%02x", $0) }.joined()
    return EmbeddingModel.File(path: "onnx/model.onnx", bytes: Int64(payload.count), sha256: sha256 ?? digest)
  }

  private func seedPart(_ bytes: Data) throws {
    let part = directory.appending(path: "onnx/model.onnx.part")
    try FileManager.default.createDirectory(at: part.deletingLastPathComponent(), withIntermediateDirectories: true)
    try bytes.write(to: part)
  }

  private func download(_ file: EmbeddingModel.File) async throws {
    StubServer.payload = payload
    StubServer.ranges = []
    try await ModelDownloader.download(
      into: directory, files: [file], configuration: configuration, retryBase: .zero
    ) { _, _ in }
  }

  @Test func resumesFromPartWithRange() async throws {
    defer { try? FileManager.default.removeItem(at: directory) }
    try seedPart(payload.prefix(40_000))
    try await download(file())

    let target = directory.appending(path: "onnx/model.onnx")
    #expect(StubServer.ranges == ["bytes=40000-"])
    #expect(try Data(contentsOf: target) == payload)
    #expect(!FileManager.default.fileExists(atPath: target.path + ".part"))
    #expect(try target.resourceValues(forKeys: [.isExcludedFromBackupKey]).isExcludedFromBackup == true)
    #expect(ModelDownloader.isInstalled(in: directory, files: [file()]))
  }

  @Test func corruptPartIsDeletedAndRefetched() async throws {
    defer { try? FileManager.default.removeItem(at: directory) }
    // 앞부분이 다른 파일이면 이어 붙여도 해시가 틀린다 → 지우고 처음부터.
    try seedPart(Data(repeating: 0xFF, count: 40_000))
    try await download(file())

    #expect(StubServer.ranges == ["bytes=40000-", nil])
    #expect(try Data(contentsOf: directory.appending(path: "onnx/model.onnx")) == payload)
  }

  @Test func wrongHashLeavesNothingBehind() async throws {
    defer { try? FileManager.default.removeItem(at: directory) }
    let pinned = file(sha256: String(repeating: "0", count: 64))
    await #expect(throws: ModelDownloadError.self) { try await download(pinned) }

    #expect(StubServer.ranges.count == ModelDownloader.maxAttempts)
    let target = directory.appending(path: "onnx/model.onnx")
    #expect(!FileManager.default.fileExists(atPath: target.path))
    #expect(!FileManager.default.fileExists(atPath: target.path + ".part"))
    #expect(!ModelDownloader.isInstalled(in: directory, files: [pinned]))
  }
}
