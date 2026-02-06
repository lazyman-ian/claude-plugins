# Changelog

All notable changes to dev-flow plugin will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [3.15.0] - 2026-02-06

### Added

- **StatusLine Session Isolation**: Agent Team display now isolated per session
  - Primary strategy: Session→team mapping via PostToolUse hooks
  - Fallback strategy: Time-based filtering (5-minute window)
  - Automatic tracking via `TeamCreate`/`TeamDelete` hooks
  - No user configuration required
  - Graceful degradation if mapping file missing/corrupted

### Changed

- `scripts/statusline.sh`: Implemented dual-strategy team filtering in `get_team_line()`
- `hooks/hooks.json`: Added `TeamCreate` and `TeamDelete` PostToolUse hooks

### Fixed

- Multiple sessions using Agent Teams no longer show all teams in StatusLine
- Cross-session Agent Team confusion eliminated

### Documentation

- Added `docs/session-team-mapping.md`: Complete implementation guide
- Updated README.md: Added StatusLine feature section
- Updated CLAUDE.md: Documented session isolation implementation

## [3.14.0] - 2026-02-06

### Added

- Cross-platform team skill for parallel multi-repo development
- Stats tracking at `~/.claude/memory/cross-platform-stats.yaml`

### Changed

- Enhanced StatusLine with token efficiency metrics
- Added extended context display (>200K)
- Added session turn counter and ledger tracking

## [Earlier Versions]

See git history for earlier changes.
