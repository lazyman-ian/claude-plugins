# Performance Monitoring Tools

Multi-layer monitoring: development (Instruments) → CI (XCTest) → production (MetricKit + Organizer).

## MetricKit

### Setup

```swift
import MetricKit

final class PerformanceMonitor: NSObject, MXMetricManagerSubscriber {
    static let shared = PerformanceMonitor()

    func start() {
        MXMetricManager.shared.add(self)
    }

    // Aggregated metrics (delivered ~daily)
    func didReceive(_ payloads: [MXMetricPayload]) {
        for payload in payloads {
            reportLaunchMetrics(payload)
            reportMemoryMetrics(payload)
            reportExitMetrics(payload)
        }
    }

    // Diagnostic payloads (crash/hang reports)
    func didReceive(_ payloads: [MXDiagnosticPayload]) {
        for payload in payloads {
            if let crashes = payload.crashDiagnostics {
                for crash in crashes {
                    analytics.logCrash(crash)
                }
            }
            if let hangs = payload.hangDiagnostics {
                for hang in hangs {
                    analytics.logHang(hang)
                }
            }
        }
    }
}
```

### Available Metrics (MXMetricPayload)

| Property | What It Measures |
|----------|-----------------|
| `applicationLaunchMetrics` | Launch duration histogram |
| `applicationExitMetrics` | Exit reasons (OOM, CPU limit, watchdog, normal) |
| `memoryMetrics` | Peak memory, suspended memory |
| `cpuMetrics` | CPU time, instruction count |
| `diskIOMetrics` | Logical/physical writes |
| `applicationTimeMetrics` | Foreground/background time |
| `cellularConditionMetrics` | Network quality bars |
| `animationMetrics` | Scroll hitch rate (iOS 15+) |
| `signpostMetrics` | Custom os_signpost intervals |

### Diagnostic Payloads (MXDiagnosticPayload)

| Property | Content |
|----------|---------|
| `crashDiagnostics` | Crash stack traces with symbolication |
| `hangDiagnostics` | Hang reports (>250ms main thread block) |
| `cpuExceptionDiagnostics` | CPU resource limit violations |
| `diskWriteExceptionDiagnostics` | Excessive disk write events |

### Custom Signposts

Track custom performance intervals in production:

```swift
import os.signpost

let logger = OSLog(subsystem: "com.app", category: "Performance")

// Mark interval
os_signpost(.begin, log: logger, name: "ImageLoad", "%{public}s", imageURL)
// ... operation ...
os_signpost(.end, log: logger, name: "ImageLoad")
```

Signpost data appears in MetricKit via `signpostMetrics` and in Instruments.

### Important Notes

- Payloads delivered on varying schedule (typically daily)
- Use `timeStampBegin`/`timeStampEnd` for data collection period
- Data is aggregated — individual events not available
- JSON export: `payload.jsonRepresentation()`

## Instruments Templates

| Template | Use Case | Key Lanes |
|----------|----------|-----------|
| **App Launch** | Startup time analysis | Process lifecycle, Time Profiler |
| **Time Profiler** | CPU hotspot hunting | Call tree, heaviest stack trace |
| **Allocations** | Memory growth tracking | All Allocations, Heap Growth |
| **Leaks** | Retain cycle detection | Leak cycles with backtrace |
| **SwiftUI** | View body/update timing | View Body, Update Groups |
| **Energy Log** | Battery drain analysis | CPU, Network, Location, Display |
| **Animation Hitches** | Frame drop diagnosis | Hitch duration, commit phase |
| **Network** | Request timing/size | HTTP traffic timeline |

### Profiling Best Practices

1. Always profile **Release** builds on **real devices**
2. Disable debugger attachment (Product → Profile, not Debug)
3. Reproduce exact user interaction consistently
4. Record for at least 30 seconds of steady-state
5. Use **Recording Options** to limit scope (reduce overhead)

## Xcode Organizer

Access via Window → Organizer → select app.

| Tab | Data |
|-----|------|
| Crashes | Symbolicated crash logs from TestFlight/App Store |
| Energy | Battery usage reports per device type |
| Launch Time | 50th/90th percentile across versions |
| Hang Rate | Main thread hangs per session |
| Memory | Peak/average footprint |
| Disk Writes | Write volume per session |
| Scrolling | Hitch rate metrics |

**Key advantage:** Real-world data across all user devices and OS versions.

## XCTest Performance Baselines

```swift
// Launch time regression test
func testLaunchPerformance() throws {
    measure(metrics: [XCTApplicationLaunchMetric()]) {
        XCUIApplication().launch()
    }
}

// Custom metric baseline
func testScrollPerformance() throws {
    let app = XCUIApplication()
    app.launch()

    measure(metrics: [XCTOSSignpostMetric.scrollDecelerationMetric]) {
        app.swipeUp()
    }
}

// Memory baseline
func testMemoryFootprint() {
    measure(metrics: [XCTMemoryMetric()]) {
        // Perform operation
    }
}
```

Set baselines in Xcode: click the diamond icon next to test results.

## Energy Optimization

| Drain Source | Detection | Fix |
|-------------|-----------|-----|
| Continuous location | Energy Log: Location lane | Significant change / geofencing |
| Background refresh | Energy Log: CPU in background | Reduce frequency, use BGTaskScheduler |
| Excessive networking | Network template | Batch requests, cache aggressively |
| Animation while backgrounded | CPU lane stays active | Stop animations in sceneDidEnterBackground |
| Wake locks | Energy Log: wakeup events | Audit timers and background tasks |

## Sources

- [Majid: Monitoring app performance with MetricKit](https://swiftwithmajid.com/2025/12/09/monitoring-app-performance-with-metrickit/)
- [Apple: MetricKit documentation](https://developer.apple.com/documentation/metrickit)
- [WWDC 2025: iOS Power Optimization](https://developer.apple.com/videos/play/wwdc2025/)
- [WWDC 2021: Ultimate Performance Survival Guide](https://developer.apple.com/videos/play/wwdc2021/10181/)
