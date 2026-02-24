# iOS Community Blogs Index

Authoritative iOS/Swift blog sources for AI-assisted research. Organized by specialty and reliability.

## How to Use

When a skill needs to research a topic, search these blogs for up-to-date, community-vetted content:
1. Identify the topic domain (performance, SwiftUI, concurrency, etc.)
2. Pick 2-3 relevant blogs from that domain
3. Use WebFetch/WebSearch with `site:blog-url topic` for targeted search

## Chinese iOS Community

| Blog | URL | Specialty | Active |
|------|-----|-----------|--------|
| 戴铭 (Dai Ming) | https://ming1016.github.io | Compiler/LLVM, performance, app architecture | Yes |
| 东坡肘子 (Fatbobman) | https://fatbobman.com | SwiftData, SwiftUI, Core Data, Swift Testing | Yes |
| ibireme (郭曜源) | https://blog.ibireme.com | Performance (rendering, locks, RunLoop), YYKit | Low |
| 唐巧 (Tang Qiao) | https://blog.devtang.com | iOS community, career, architecture | Low |
| 喵神 (OneV/王巍) | https://onevcat.com | Swift language, Kingfisher, SwiftUI | Yes |
| Casa (Casatwy) | https://casatwy.com | Architecture (CTMediator), module routing | Low |
| limboy (李忠) | https://limboy.me | Architecture, RAC, functional thinking | Low |
| 美团技术团队 | https://tech.meituan.com | Large-scale iOS, APM, build optimization | Yes |

## International iOS Community

| Blog | URL | Specialty | Active |
|------|-----|-----------|--------|
| Antoine van der Lee | https://www.avanderlee.com | SwiftUI, Swift Testing, @Observable, launch time | Yes |
| Majid Jabrayilov | https://swiftwithmajid.com | SwiftUI patterns, MetricKit, accessibility | Yes |
| John Sundell | https://www.swiftbysundell.com | Swift design patterns, testing, architecture | Low |
| Paul Hudson | https://www.hackingwithswift.com | Swift tutorials, 100 Days of SwiftUI | Yes |
| Peter Steinberger | https://steipete.me | Testing migration, PSPDFKit, SDK development | Yes |
| Jesse Squires | https://www.jessesquires.com | @Observable pitfalls, open source, Swift evolution | Yes |
| Donny Wals | https://www.donnywals.com | Core Data, SwiftData, Combine, concurrency | Yes |
| Matt Massicotte | https://www.massicotte.org | Swift Concurrency deep-dive, AppKit | Yes |
| Michael Tsai | https://mjtsai.com/blog | Link blog — curates best iOS/Mac articles weekly | Yes |
| Alex Dremov | https://alexdremov.me | Swift Concurrency, Actor re-entrancy | Yes |
| NSHipster | https://nshipster.com | Swift/ObjC APIs deep-dive, Foundation | Low |
| objc.io | https://www.objc.io | Advanced Swift, architecture, functional Swift | Low |
| Alexey Naumov (nalexn) | https://nalexn.github.io | Clean Architecture SwiftUI, ViewInspector | Yes |
| Emerge Tools | https://www.emergetools.com/blog | Binary size, app performance, build analysis | Yes |

## Official Sources

| Source | URL | Content |
|--------|-----|---------|
| Apple Developer | https://developer.apple.com/documentation | Official API docs |
| Apple Developer Videos | https://developer.apple.com/videos | WWDC sessions |
| Swift.org Blog | https://www.swift.org/blog | Swift evolution, releases |
| Swift Forums | https://forums.swift.org | Proposals, discussions |
| iOS Dev Weekly | https://iosdevweekly.com | Weekly curated newsletter |

## Topic → Blog Mapping

| Topic | Primary Sources |
|-------|----------------|
| **SwiftUI patterns** | van der Lee, Majid, 喵神, objc.io |
| **Swift Concurrency** | Matt Massicotte, Alex Dremov, Donny Wals, 东坡肘子 |
| **Performance (system)** | ibireme, 戴铭, Emerge Tools, Apple WWDC |
| **SwiftData / Core Data** | 东坡肘子, Donny Wals, Apple docs |
| **Swift Testing** | Steinberger, 东坡肘子, van der Lee |
| **@Observable migration** | van der Lee, Jesse Squires, Apple docs |
| **Architecture** | nalexn (Clean), Casa (module), pointfree (TCA) |
| **Binary size** | Emerge Tools, 戴铭, Apple docs |
| **Build optimization** | 美团, Emerge Tools, 戴铭 |
| **Weekly roundup** | Michael Tsai, iOS Dev Weekly |

## Search Patterns

```bash
# WebSearch for specific topic
"site:fatbobman.com SwiftData migration"
"site:avanderlee.com Swift Testing 2025"
"site:swiftwithmajid.com MetricKit"

# Broad search with community filter
"iOS Swift Concurrency best practices site:emergetools.com OR site:massicotte.org OR site:alexdremov.me"
```

## Notes

- **Active** = published in 2024-2025
- **Low** = valuable archive but infrequent updates
- Michael Tsai is a meta-source — search his blog to find articles he curated from other sources
- 东坡肘子 publishes bilingual (Chinese + English at fatbobman.com/en/)
- SwiftGG (swift.gg) is no longer active — domain expired
