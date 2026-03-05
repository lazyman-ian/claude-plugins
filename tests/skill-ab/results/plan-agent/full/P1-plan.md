# `dev_ping` MCP Tool Implementation Plan

## Overview

Add a `dev_ping` MCP tool to the dev-flow MCP server that returns server health status including uptime, plugin version, and active connection count. This gives Claude (and developers) a fast, zero-argument diagnostic to confirm the server is running and inspect its runtime state.

**Token budget target**: `~20 tokens` (compact), full JSON available via `format: 'json'`.

## Current State Analysis

- **Server entry**: `/Users/lazyman/work/claude-plugins/dev-flow/mcp-server/src/index.ts` (1263 lines)
- **Server version** declared at line 26: `{ name: 'dev-flow-mcp', version: '2.1.0' }`
- **Cache pattern** already in place (`toolCache`, `getCached()`, lines 31–47) — `dev_ping` does NOT use the cache (health data is always fresh)
- **Tool registration pattern** (lines 50–321): add entry to `ListToolsRequestSchema` handler
- **Request dispatch** (lines 431–525): add `case 'dev_ping':` to the `switch` block
- **Response shape** used everywhere: `{ content: [{ type: 'text', text: string }] }`
- **No existing uptime/connection tracking** — both must be added at module level in `index.ts`
- **Test pattern**: vitest with `vi.mock('fs')`, pure unit tests, no subprocess calls — ping test should mock `process.uptime()`

## Desired End State

```
dev_ping() → "up|v2.1.0|uptime:42s|connections:1"
dev_ping({ format: 'json' }) → { status, version, uptime_seconds, uptime_human, active_connections, server_name }
```

The tool is useful for:
- Confirming the MCP server responded (especially after restart)
- Observability hooks that poll for liveness
- Debugging dropped connections

## What We Are NOT Doing

- No persistent connection registry (track count in-memory only, reset on restart)
- No HTTP health endpoint (MCP stdio transport only)
- No historical uptime metrics or SLA tracking
- No changes to `detector.ts`, platform modules, or continuity modules
- No changes to the bundle script or `package.json`
- No new files — all changes stay in `index.ts` and one test file

## Phase 1: Module-Level State (index.ts)

### Changes Required

- **File**: `dev-flow/mcp-server/src/index.ts`
- **Location**: After the `CACHE_TTL` block (around line 36), before the `getCached` helper
- **Changes**: Add two module-level variables that track server start time and connection count

```typescript
// Health tracking (module-level, reset on server restart)
const SERVER_START_TIME = Date.now();
let activeConnections = 0;
```

### Why module-level

`index.ts` is a single-process stdio server — module scope is the correct lifetime. The variables survive for as long as the server process is alive, which is exactly what "uptime" means.

### Success Criteria

#### Automated
- [ ] TypeScript compiles without error: `npm run --prefix dev-flow/mcp-server build`

#### Manual
- [ ] `SERVER_START_TIME` is a number equal to `Date.now()` at startup
- [ ] `activeConnections` starts at `0`

---

## Phase 2: Connection Count Tracking

### Changes Required

- **File**: `dev-flow/mcp-server/src/index.ts`
- **Location**: The `CallToolRequestSchema` handler (line 431). Wrap the existing handler to increment/decrement around each call.
- **Changes**: Increment `activeConnections` on entry, decrement in a `finally` block

```typescript
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  activeConnections++;
  try {
    const { name, arguments: args } = request.params;
    // ... existing switch ...
  } catch (error: any) {
    return { content: [{ type: 'text', text: `Error: ${error.message}` }] };
  } finally {
    activeConnections--;
  }
});
```

### Design note

`activeConnections` counts concurrent in-flight tool invocations (not TCP connections, which don't apply to stdio). For typical single-Claude usage this will nearly always be `0` or `1`. It is still useful as a diagnostic: if it's stuck at `1` while the server appears hung, the caller knows a tool is in progress.

### Success Criteria

#### Automated
- [ ] TypeScript compiles: `npm run --prefix dev-flow/mcp-server build`

#### Manual
- [ ] A concurrent call test confirms counter increments and decrements correctly

---

## Phase 3: Tool Registration

### Changes Required

- **File**: `dev-flow/mcp-server/src/index.ts`
- **Location**: `ListToolsRequestSchema` handler, after the `dev_check` entry (around line 74)
- **Changes**: Add the tool descriptor

```typescript
{
  name: 'dev_ping',
  description: '[~20 tokens] Server health check: uptime, version, active connections',
  inputSchema: {
    type: 'object',
    properties: {
      format: { type: 'string', enum: ['compact', 'json'], description: 'Output format (default: compact)' },
    },
  },
},
```

### Success Criteria

#### Automated
- [ ] `npm run --prefix dev-flow/mcp-server build` exits 0
- [ ] Tool appears in MCP tool list when server is running

---

## Phase 4: Handler Function + Dispatch

### Changes Required

**4a — Dispatch** (`CallToolRequestSchema` switch, after `case 'dev_check':`):

```typescript
case 'dev_ping':
  return pingStatus(args?.format as string);
```

**4b — Handler function** (add alongside the other top-level functions, e.g. after `checkStatus()`):

```typescript
// Ping / health check (~20 tokens)
function pingStatus(format?: string) {
  const uptimeMs = Date.now() - SERVER_START_TIME;
  const uptimeSec = Math.floor(uptimeMs / 1000);

  const humanUptime = uptimeSec < 60
    ? `${uptimeSec}s`
    : uptimeSec < 3600
      ? `${Math.floor(uptimeSec / 60)}m${uptimeSec % 60}s`
      : `${Math.floor(uptimeSec / 3600)}h${Math.floor((uptimeSec % 3600) / 60)}m`;

  if (format === 'json') {
    return {
      content: [{
        type: 'text',
        text: JSON.stringify({
          status: 'ok',
          server_name: 'dev-flow-mcp',
          version: '2.1.0',
          uptime_seconds: uptimeSec,
          uptime_human: humanUptime,
          active_connections: activeConnections,
        }, null, 2),
      }],
    };
  }

  // Compact (default)
  return {
    content: [{
      type: 'text',
      text: `up|v2.1.0|uptime:${humanUptime}|connections:${activeConnections}`,
    }],
  };
}
```

### Notes on version string

The version `'2.1.0'` is a literal that duplicates the `Server(...)` constructor on line 26. An alternative is to extract it to a constant:

```typescript
const MCP_VERSION = '2.1.0';
const server = new Server({ name: 'dev-flow-mcp', version: MCP_VERSION }, ...);
```

Then reference `MCP_VERSION` inside `pingStatus`. This is recommended but optional — the plan is complete either way.

### Success Criteria

#### Automated
- [ ] TypeScript compiles: `npm run --prefix dev-flow/mcp-server build`
- [ ] Unit tests pass: `npm test --prefix dev-flow/mcp-server`

#### Manual
- [ ] Calling `dev_ping()` returns a string matching `up|v2.1.0|uptime:Xs|connections:0`
- [ ] Calling `dev_ping({ format: 'json' })` returns valid JSON with all six fields
- [ ] `uptime_seconds` is non-negative and increases between calls

---

## Phase 5: Tests

### Changes Required

- **File**: `dev-flow/mcp-server/src/ping.test.ts` (new file)
- **Pattern**: matches `detector.test.ts` — vitest, no subprocess calls, mock where needed

```typescript
/**
 * dev_ping handler tests
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

// We test the pure uptime formatting logic — extracted to a helper for testability
// OR we test the index behavior by importing and calling pingStatus directly
// (which requires exporting it, or restructuring the file)
```

**Recommended approach**: Export `pingStatus` (or the uptime formatter) from `index.ts` as a named export for testing purposes. This is consistent with how `detector.ts` exports `loadProjectConfig` for testing.

**Test cases**:
1. Compact format returns `up|v...` shape
2. JSON format returns object with all required keys
3. `uptime_human` formatting: seconds only (`42s`), minutes (`2m30s`), hours (`1h5m`)
4. `active_connections` is a non-negative integer

### Success Criteria

#### Automated
- [ ] `npm test --prefix dev-flow/mcp-server` passes (all existing 98 tests + new ping tests)
- [ ] No TypeScript errors

---

## Phase 6: Bundle

### Changes Required

- **File**: No file changes — run the existing bundle command
- **Command**: `npm run --prefix dev-flow/mcp-server bundle`
- This regenerates `dev-flow/scripts/mcp-server.cjs` which is the file actually loaded by the plugin

### Why required

The Claude Code plugin loads `scripts/mcp-server.cjs` (configured in `dev-flow/.mcp.json`), NOT the TypeScript source. Skipping the bundle means the `dev_ping` tool is compiled but never deployed.

### Success Criteria

#### Automated
- [ ] Bundle command exits 0
- [ ] `dev-flow/scripts/mcp-server.cjs` modification timestamp is newer than before

#### Manual
- [ ] After plugin reinstall, `dev_ping` appears in MCP tool list in Claude Code

---

## File Summary

| File | Change Type | Notes |
|------|------------|-------|
| `dev-flow/mcp-server/src/index.ts` | Modify | Add state vars, tool descriptor, dispatch case, handler function |
| `dev-flow/mcp-server/src/ping.test.ts` | Create | Unit tests for uptime formatting + output shapes |
| `dev-flow/scripts/mcp-server.cjs` | Regenerate | `npm run bundle` — not hand-edited |

## Phase Order

1 → 2 → 3 → 4 → 5 → 6 (sequential; each phase depends on the previous)

## First Recommended Action

Start with **Phase 1** (add `SERVER_START_TIME` and `activeConnections` to `index.ts`), then proceed through phases sequentially. The changes are small and localized — an implementer can complete all six phases in a single focused session.
