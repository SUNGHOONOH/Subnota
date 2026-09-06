// swift-tools-version: 6.0
import PackageDescription

let package = Package(
  name: "SubnotaKit",
  platforms: [.iOS(.v17), .macOS(.v14)],
  products: [
    .library(name: "SubnotaKit", targets: ["SubnotaKit"])
  ],
  dependencies: [
    .package(url: "https://github.com/groue/GRDB.swift.git", from: "7.0.0"),
    .package(url: "https://github.com/PasiSalenius/DiffMatchPatch.git", revision: "d6a15076e2de59cd8fd6aba9f7b852aee6b6c414")
  ],
  targets: [
    .target(
      name: "SubnotaKit",
      dependencies: [
        .product(name: "GRDB", package: "GRDB.swift"),
        .product(name: "diff-match-patch", package: "DiffMatchPatch")
      ]
    ),
    .testTarget(
      name: "SubnotaKitTests",
      dependencies: ["SubnotaKit"],
      resources: [.copy("Fixtures/sync-golden.json")]
    )
  ]
)
