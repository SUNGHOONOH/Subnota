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
      dependencies: [.product(name: "GRDB", package: "GRDB.swift")]
    ),
    .testTarget(name: "SubnotaKitTests", dependencies: ["SubnotaKit"])
  ]
)
