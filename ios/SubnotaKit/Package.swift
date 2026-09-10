// swift-tools-version: 6.0
import PackageDescription

let package = Package(
  name: "SubnotaKit",
  platforms: [.iOS(.v17), .macOS(.v14)],
  products: [
    .library(name: "SubnotaKit", targets: ["SubnotaKit"]),
    // 추론 엔진은 앱만 링크한다. 위젯·공유 확장은 SubnotaKit 을 링크하므로
    // onnxruntime 을 거기 넣으면 확장 메모리 한도(수십 MB)를 깬다.
    .library(name: "SubnotaSearch", targets: ["SubnotaSearch"]),
  ],
  dependencies: [
    .package(url: "https://github.com/groue/GRDB.swift.git", from: "7.0.0"),
    .package(url: "https://github.com/apple/swift-markdown.git", from: "0.8.0"),
    // 골든 벡터가 이 버전들로 고정돼 있다. 올리면 골든 테스트를 다시 돌린다.
    .package(url: "https://github.com/microsoft/onnxruntime-swift-package-manager.git", exact: "1.19.2"),
    .package(url: "https://github.com/huggingface/swift-transformers.git", exact: "1.3.4"),
  ],
  targets: [
    .target(
      name: "SubnotaKit",
      dependencies: [
        .product(name: "GRDB", package: "GRDB.swift"),
        .product(name: "Markdown", package: "swift-markdown"),
      ],
      // 데스크탑과 같은 파일을 그대로 실행한다 — MemoMerge.swift 참고.
      resources: [
        // 번들 루트에 평평하게 넣는다. `Resources/` 라는 이름의 하위 디렉터리를
        // 만들면 codesign 이 프레임워크 레이아웃으로 오인해 앱 빌드가 깨진다.
        .copy("Resources/diff_match_patch.js"),
        .copy("Resources/diff_match_patch-LICENSE.txt"),
      ]
    ),
    .testTarget(
      name: "SubnotaKitTests",
      // Phase 0+1 이 만든 옛 스키마를 테스트에서 직접 만들어 열어 보려면 필요하다.
      dependencies: [
        "SubnotaKit",
        .product(name: "GRDB", package: "GRDB.swift")
      ],
      resources: [
        .copy("Fixtures/sync-golden.json"),
        .copy("Fixtures/date-golden.json"),
        .copy("Fixtures/report-golden.json"),
        .copy("Fixtures/chunker-golden.json"),
      ]
    ),
    .target(
      name: "SubnotaSearch",
      dependencies: [
        "SubnotaKit",
        .product(name: "onnxruntime", package: "onnxruntime-swift-package-manager"),
        .product(name: "Tokenizers", package: "swift-transformers"),
      ]
    ),
    .testTarget(
      name: "SubnotaSearchTests",
      dependencies: ["SubnotaSearch", "SubnotaKit"],
      resources: [
        .copy("Fixtures/e5-golden.json"),
      ]
    ),
  ]
)
