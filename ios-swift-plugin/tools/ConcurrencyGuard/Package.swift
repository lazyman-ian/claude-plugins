// swift-tools-version: 5.9
import PackageDescription

let package = Package(
    name: "ConcurrencyGuard",
    platforms: [.macOS(.v13)],
    products: [
        .executable(name: "ConcurrencyGuard", targets: ["ConcurrencyGuard"])
    ],
    dependencies: [
        .package(url: "https://github.com/apple/swift-syntax.git", from: "509.0.0"),
        .package(url: "https://github.com/apple/swift-argument-parser.git", from: "1.2.0")
    ],
    targets: [
        .executableTarget(
            name: "ConcurrencyGuard",
            dependencies: [
                .product(name: "SwiftSyntax", package: "swift-syntax"),
                .product(name: "SwiftParser", package: "swift-syntax"),
                .product(name: "ArgumentParser", package: "swift-argument-parser")
            ]
        ),
        .testTarget(
            name: "ConcurrencyGuardTests",
            dependencies: ["ConcurrencyGuard"]
        )
    ]
)
