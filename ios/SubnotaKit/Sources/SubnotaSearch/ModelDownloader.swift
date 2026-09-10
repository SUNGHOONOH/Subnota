import CryptoKit
import Foundation
import SubnotaKit

public enum ModelDownloadError: LocalizedError {
  case http(Int)
  case resumeMismatch
  case sizeMismatch
  case incomplete
  case integrity

  public var errorDescription: String? {
    switch self {
    case .http(let status): "검색 모델을 받지 못했습니다 (HTTP \(status))."
    case .resumeMismatch: "이어받기 응답이 기존 파일과 맞지 않습니다."
    case .sizeMismatch: "검색 모델 파일 크기가 예상과 다릅니다."
    case .incomplete: "검색 모델을 끝까지 받지 못했습니다."
    case .integrity: "검색 모델 무결성 검증에 실패했습니다."
    }
  }
}

/// 검색 모델 이어받기 다운로더. 데스크탑 `local-embedding-download.ts` 의 이식이다.
///
/// `.part` 로 받아 크기와 SHA256 이 고정값과 맞을 때만 제자리로 옮긴다. 끊기면
/// `.part` 를 남겨 다음 시도(앱을 다시 켠 뒤도)가 Range 로 이어받는다. 검증에
/// 실패한 파일은 지운다 — 잘리거나 다른 revision 이 섞인 파일이 남으면 모델
/// 로딩이 실패한다.
public enum ModelDownloader {
  static let maxAttempts = 5

  /// 모든 파일이 고정 크기로 있으면 준비된 것이다. SHA256 은 받을 때 확인했으므로
  /// 실행할 때마다 135MB 를 해시하지 않는다.
  public static func isInstalled(in directory: URL, files: [EmbeddingModel.File] = EmbeddingModel.files) -> Bool {
    files.allSatisfy { sizeOf(directory.appending(path: $0.path)) == $0.bytes }
  }

  /// 없는 파일만 받는다. 진행률은 전체 파일 합계 기준이다.
  public static func download(
    into directory: URL,
    files: [EmbeddingModel.File] = EmbeddingModel.files,
    configuration: URLSessionConfiguration = .default,
    retryBase: Duration = .seconds(1),
    onProgress: @escaping @Sendable (_ received: Int64, _ total: Int64) -> Void
  ) async throws {
    try FileManager.default.createDirectory(at: directory, withIntermediateDirectories: true)
    try excludeFromBackup(directory)
    let total = files.reduce(0) { $0 + $1.bytes }
    var finished: Int64 = 0
    for file in files {
      let target = directory.appending(path: file.path)
      try FileManager.default.createDirectory(
        at: target.deletingLastPathComponent(),
        withIntermediateDirectories: true
      )
      let base = finished
      try await ensure(file, at: target, configuration: configuration, retryBase: retryBase) {
        onProgress(base + $0, total)
      }
      finished += file.bytes
      onProgress(finished, total)
    }
  }

  private static func ensure(
    _ file: EmbeddingModel.File,
    at target: URL,
    configuration: URLSessionConfiguration,
    retryBase: Duration,
    onProgress: @escaping @Sendable (Int64) -> Void
  ) async throws {
    if try matches(target, file) {
      try excludeFromBackup(target)
      return
    }
    try? FileManager.default.removeItem(at: target)
    let part = target.appendingPathExtension("part")

    var lastError: Error = ModelDownloadError.incomplete
    for attempt in 1...maxAttempts {
      do {
        // 이미 다 받았는데 검증 전에 끊겼다면 요청하지 않는다 — Range 가 416 이 된다.
        if sizeOf(part) < file.bytes {
          var request = URLRequest(url: EmbeddingModel.url(for: file))
          let already = sizeOf(part)
          if already > 0 { request.setValue("bytes=\(already)-", forHTTPHeaderField: "Range") }
          let writer = PartWriter(file: file, part: part, already: already, onProgress: onProgress)
          try await writer.run(request, configuration: configuration)
        }
        let received = sizeOf(part)
        if received > file.bytes {
          try? FileManager.default.removeItem(at: part)
          throw ModelDownloadError.sizeMismatch
        }
        // 본문이 중간에 끝났다면 지금 파일은 검증 가능한 앞부분이다. 지우지 않고 이어받는다.
        guard received == file.bytes else { throw ModelDownloadError.incomplete }
        guard try sha256(of: part) == file.sha256 else {
          try? FileManager.default.removeItem(at: part)
          throw ModelDownloadError.integrity
        }
        try FileManager.default.moveItem(at: part, to: target)
        try excludeFromBackup(target)
        return
      } catch {
        lastError = error
        try Task.checkCancellation()
        if attempt < maxAttempts {
          try await Task.sleep(for: retryBase * (1 << (attempt - 1)))
        }
      }
    }
    throw lastError
  }

  private static func matches(_ url: URL, _ file: EmbeddingModel.File) throws -> Bool {
    try sizeOf(url) == file.bytes && sha256(of: url) == file.sha256
  }

  /// 없으면 0. `URL.resourceValues` 는 값을 URL 인스턴스에 캐시해서 쓰는 중인
  /// `.part` 크기가 낡는다 — 매번 파일 시스템에 묻는다.
  static func sizeOf(_ url: URL) -> Int64 {
    ((try? FileManager.default.attributesOfItem(atPath: url.path))?[.size] as? NSNumber)?.int64Value ?? 0
  }

  static func sha256(of url: URL) throws -> String {
    let handle = try FileHandle(forReadingFrom: url)
    defer { try? handle.close() }
    var hasher = SHA256()
    while let chunk = try handle.read(upToCount: 1 << 20), !chunk.isEmpty {
      hasher.update(data: chunk)
    }
    return hasher.finalize().map { String(format: "%02x", $0) }.joined()
  }

  /// 재다운로드할 수 있는 파일이라 iCloud 백업에서 뺀다(App Review 2.23).
  static func excludeFromBackup(_ url: URL) throws {
    var values = URLResourceValues()
    values.isExcludedFromBackup = true
    var target = url
    try target.setResourceValues(values)
  }
}

/// 응답 본문 한 번을 `.part` 에 흘려 쓴다. 135MB 를 메모리에 들고 있지 않는다.
private final class PartWriter: NSObject, URLSessionDataDelegate, @unchecked Sendable {
  // ponytail: @unchecked — 델리게이트 콜백은 세션의 직렬 큐에서만 불리고,
  // 취소와 공유하는 `task`·`cancelled` 만 잠금으로 지킨다.
  private let file: EmbeddingModel.File
  private let part: URL
  private let already: Int64
  private let onProgress: @Sendable (Int64) -> Void

  private let lock = NSLock()
  private var task: URLSessionTask?
  private var cancelled = false

  private var handle: FileHandle?
  private var written: Int64 = 0
  private var failure: Error?
  private var continuation: CheckedContinuation<Void, Error>?

  init(file: EmbeddingModel.File, part: URL, already: Int64, onProgress: @escaping @Sendable (Int64) -> Void) {
    self.file = file
    self.part = part
    self.already = already
    self.onProgress = onProgress
  }

  func run(_ request: URLRequest, configuration: URLSessionConfiguration) async throws {
    let session = URLSession(configuration: configuration, delegate: self, delegateQueue: nil)
    defer { session.finishTasksAndInvalidate() }
    try await withTaskCancellationHandler {
      try await withCheckedThrowingContinuation { (continuation: CheckedContinuation<Void, Error>) in
        let task = session.dataTask(with: request)
        let shouldStart = lock.withLock {
          self.continuation = continuation
          self.task = task
          return !cancelled
        }
        if shouldStart { task.resume() } else { task.cancel() }
      }
    } onCancel: {
      lock.withLock {
        cancelled = true
        return task
      }?.cancel()
    }
  }

  func urlSession(
    _ session: URLSession,
    dataTask: URLSessionDataTask,
    didReceive response: URLResponse,
    completionHandler: @escaping (URLSession.ResponseDisposition) -> Void
  ) {
    do {
      handle = try openPart(for: response)
      completionHandler(.allow)
    } catch {
      failure = error
      completionHandler(.cancel)
    }
  }

  /// 206 이면 이어받기가 받아들여진 것이고, 200 이면 서버가 전체를 다시 보낸다.
  private func openPart(for response: URLResponse) throws -> FileHandle {
    let http = response as? HTTPURLResponse
    let status = http?.statusCode ?? 0
    let resumed = status == 206 && already > 0
    guard status == 200 || resumed else { throw ModelDownloadError.http(status) }

    if resumed {
      // "bytes <start>-<end>/<total>" 의 시작과 전체가 우리 파일과 맞아야 이어 붙인다.
      let range = http?.value(forHTTPHeaderField: "Content-Range") ?? ""
      let numbers = range.split(whereSeparator: { !$0.isNumber }).compactMap { Int64($0) }
      guard numbers.count == 3, numbers[0] == already, numbers[2] == file.bytes else {
        try? FileManager.default.removeItem(at: part)
        throw ModelDownloadError.resumeMismatch
      }
    }
    let startFrom = resumed ? already : 0
    let remaining = response.expectedContentLength
    if remaining > 0, startFrom + remaining != file.bytes {
      try? FileManager.default.removeItem(at: part)
      throw ModelDownloadError.sizeMismatch
    }

    if !FileManager.default.fileExists(atPath: part.path) {
      FileManager.default.createFile(atPath: part.path, contents: nil)
    }
    let handle = try FileHandle(forWritingTo: part)
    if resumed {
      try handle.seekToEnd()
    } else {
      try handle.truncate(atOffset: 0)
    }
    written = startFrom
    return handle
  }

  func urlSession(_ session: URLSession, dataTask: URLSessionDataTask, didReceive data: Data) {
    do {
      try handle?.write(contentsOf: data)
      written += Int64(data.count)
      onProgress(written)
    } catch {
      failure = error
      dataTask.cancel()
    }
  }

  func urlSession(_ session: URLSession, task: URLSessionTask, didCompleteWithError error: Error?) {
    try? handle?.close()
    handle = nil
    let continuation = lock.withLock {
      defer { self.continuation = nil }
      return self.continuation
    }
    if let error = failure ?? error {
      continuation?.resume(throwing: error)
    } else {
      continuation?.resume()
    }
  }
}
