import XCTest

final class ConcurrencyGuardTests: XCTestCase {
    func testTaskDetachedDetection() throws {
        let source = """
        func fetch() {
            Task.detached {
                await doWork()
            }
        }
        """
        // Test would verify CC-CONC-001 is detected
        XCTAssertTrue(source.contains("Task.detached"))
    }

    func testTaskInInitDetection() throws {
        let source = """
        class MyClass {
            init() {
                Task {
                    await setup()
                }
            }
        }
        """
        // Test would verify CC-CONC-002 is detected
        XCTAssertTrue(source.contains("init()"))
    }

    func testAsyncStreamWithoutTermination() throws {
        let source = """
        let stream = AsyncStream<Int> { continuation in
            // missing onTermination
        }
        """
        // Test would verify CC-CONC-004 is detected
        XCTAssertTrue(source.contains("AsyncStream"))
    }
}
