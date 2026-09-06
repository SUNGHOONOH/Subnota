// swift-tools-version: 6.0
import PackageDescription

let package = Package(
  name: "SubnotaKit",
  platforms: [.iOS(.v17), .macOS(.v14)],
  products: [
    .library(name: "SubnotaKit", targets: ["SubnotaKit"])
  ],
  dependencies: [
    .package(url: "https://github.com/groue/GRDB.swift.git", from: "7.0.0")
  ],
  targets: [
    .target(
      name: "SubnotaKit",
      dependencies: [
        .product(name: "GRDB", package: "GRDB.swift")
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
      dependencies: ["SubnotaKit"],
      resources: [.copy("Fixtures/sync-golden.json")]
    )
  ]
)
