---
name: ios-performance-guide
description: Diagnoses and optimizes system-level iOS app performance including startup time, memory management, binary size, energy usage, and production monitoring. This skill should be used when investigating slow app launch, memory leaks, high memory usage, OOM crashes, large binary size, battery drain, or setting up performance monitoring with MetricKit and Instruments. Triggers on "startup time", "launch time", "cold start", "memory leak", "memory pressure", "OOM", "binary size", "app size", "IPA size", "MetricKit", "Instruments profiling", "energy", "battery", "启动优化", "启动时间", "内存泄漏", "内存优化", "包体积", "包大小", "性能监控", "电量", "iOS性能", "性能优化", "内存分析", "卡顿优化", "Instruments". Do NOT use for SwiftUI view rendering performance or UI jank (卡顿/掉帧) — use swiftui-performance-audit instead. Do NOT use for concurrency performance — use swift-concurrency instead.
allowed-tools: [Read, Glob, Grep, Bash, mcp__apple-docs__*]
memory: project
---

# iOS Performance Guide

System-level iOS performance optimization: startup, memory, binary size, monitoring.

## Scope Boundary

| Domain | This Skill | Other Skill |
|--------|-----------|-------------|
| App startup (pre-main + post-main) | YES | - |
| Memory leaks & OOM | YES | - |
| Binary size reduction | YES | - |
| MetricKit / Instruments setup | YES | - |
| Energy & battery optimization | YES | - |
| UIKit/Core Animation rendering | YES | - |
| SwiftUI view body performance | - | swiftui-performance-audit |
| Concurrency performance (actors) | - | swift-concurrency |

## Diagnostic Workflow

1. **Identify domain** — Which area? (startup / memory / size / energy / rendering)
2. **Collect evidence** — Ask for metrics, crash logs, Organizer data, or code
3. **Diagnose** — Match symptoms to root causes using reference guides
4. **Remediate** — Apply targeted fixes with minimal blast radius
5. **Verify** — Re-measure with same tool to confirm improvement

## Quick Decision Tree

| Symptom | Reference |
|---------|-----------|
| Slow cold launch (>400ms) | `references/startup-optimization.md` |
| Memory warnings / OOM crashes | `references/memory-management.md` |
| IPA too large / App Store size | `references/binary-size.md` |
| Need production monitoring setup | `references/monitoring-tools.md` |
| Choppy scrolling / offscreen rendering | `references/rendering-performance.md` |
| Battery drain / CPU spikes | `references/monitoring-tools.md` (energy section) |

## Key Performance Targets

| Metric | Target | Measurement |
|--------|--------|-------------|
| Cold launch | < 400ms first frame | `DYLD_PRINT_STATISTICS`, XCTApplicationLaunchMetric |
| Warm launch | < 200ms | Instruments App Launch template |
| Memory footprint | < 100MB typical | Xcode Memory Gauge, MetricKit |
| OOM rate | < 0.1% sessions | MXDiagnosticPayload, Xcode Organizer |
| Binary size (thin) | Track delta per release | App Store Connect API |
| Frame rate | 60fps (120fps ProMotion) | CADisplayLink, Instruments |

## Tool Selection

| Need | Tool | When |
|------|------|------|
| Launch time breakdown | `DYLD_PRINT_STATISTICS=1` | Debug: pre-main analysis |
| Launch time benchmark | XCTApplicationLaunchMetric | CI: automated regression |
| Memory graph | Xcode Memory Graph Debugger | Debug: retain cycle hunting |
| Memory in production | MetricKit (MXMetricPayload) | Production: aggregated daily |
| Crash diagnostics | MetricKit (MXDiagnosticPayload) | Production: stack traces + CPU |
| CPU/GPU profiling | Instruments Time Profiler | Debug: hotspot analysis |
| Energy profiling | Instruments Energy Log | Debug: battery drain |
| User-facing metrics | Xcode Organizer | Production: percentile data |
| Binary size analysis | Emerge Tools / bloaty | CI: size regression |

## Optimization Priority

For most apps, optimize in this order (highest ROI first):

1. **Startup time** — First impression, App Store ranking factor
2. **Memory** — OOM = silent crash, worst UX
3. **Rendering** — Visible jank degrades perceived quality
4. **Binary size** — Affects download conversion
5. **Energy** — Long-term user retention

## References

| Category | File |
|----------|------|
| Startup | `references/startup-optimization.md` |
| Memory | `references/memory-management.md` |
| Binary Size | `references/binary-size.md` |
| Monitoring | `references/monitoring-tools.md` |
| Rendering | `references/rendering-performance.md` |

For topics not covered above, search authoritative iOS blogs listed in the plugin CLAUDE.md.
