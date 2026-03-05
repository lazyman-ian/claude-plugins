# dev_ping MCP Tool Implementation Plan

## Overview

Add a `dev_ping` MCP tool to the dev-flow MCP server that returns server health status: uptime in seconds, server version, and active tool call count (as a proxy for active connections).

## Current State Analysis

The MCP server (`dev-flow/mcp-server/src/index.ts`) currently exposes 27 tools via the `@modelcontextprotocol/sdk` Server class. The server runs over stdio transport — there is no persistent TCP connection pool, so "active connections" is best represented as cumulative tool call count since server start. Key existing patterns:

- All tools are registered in `ListToolsRequestSchema` handler (one array entry per tool)
- All tools are dispatched in `CallToolRequestSchema` switch statement
- Per-tool cache with TTL buckets (`CACHE_TTL.project / git / quality`) already established
- Server version declared at construction: `{ name: 'dev-flow-mcp', version: '2.1.0' }`
- `package.json` version: `2.1.0`
- Server start time can be captured at module load via `Date.now()`
- Node.js `process.uptime()` returns seconds since process start (native, no imports)

## Desired End State

`dev_ping` returns a compact health string usable in ~10 tokens:

```
ok|up:42s|v2.1.0|calls:7
```

Or in JSON format when `format: "json"` is requested:

```json
{
  "status": "ok",
  "uptime_seconds": 42,
  "version": "2.1.0",
  "total_calls": 7
}
```

## What We're NOT Doing

- Not adding HTTP health endpoints (server is stdio-only)
- Not tracking per-tool call breakdown (total count is sufficient)
- Not adding persistent connection tracking (stdio has exactly one connection at a time)
- Not modifying `package.json` version (tool reads the existing server version string)

---

## Phase 1: Add Server-Level State

### Changes Required

- **File**: `dev-flow/mcp-server/src/index.ts`
- **Changes**:
  - Add module-level constants after the `toolCache` declaration:
    ```typescript
    const SERVER_START_MS = Date.now();
    const SERVER_VERSION = '2.1.0';  // mirrors Server constructor value
    let totalToolCalls = 0;
    ```
  - Increment `totalToolCalls` at the top of the `CallToolRequestSchema` handler body (before the switch), so every tool call — including `dev_ping` itself — is counted.

### Success Criteria

#### Automated:
- [ ] `npm run --prefix dev-flow/mcp-server build` exits 0 (TypeScript compiles)

#### Manual:
- [ ] Module-level variables exist and increment on each tool invocation

---

## Phase 2: Register dev_ping Tool in ListToolsRequestSchema

### Changes Required

- **File**: `dev-flow/mcp-server/src/index.ts`
- **Changes**: Append to the `tools` array inside `ListToolsRequestSchema` handler:
  ```typescript
  {
    name: 'dev_ping',
    description: '[~10 tokens] Server health check: uptime, version, call count',
    inputSchema: {
      type: 'object',
      properties: {
        format: { type: 'string', enum: ['compact', 'json'], description: 'Output format (default: compact)' },
      },
    },
  },
  ```

### Success Criteria

#### Automated:
- [ ] `npm run --prefix dev-flow/mcp-server build` exits 0

#### Manual:
- [ ] Tool appears when MCP client calls `list_tools`

---

## Phase 3: Implement pingTool Function and Wire Dispatch

### Changes Required

- **File**: `dev-flow/mcp-server/src/index.ts`
- **Changes**:
  1. Add `pingTool` function (alongside other compact tool functions near `checkStatus`):
     ```typescript
     function pingTool(format?: string) {
       const uptimeSec = Math.floor((Date.now() - SERVER_START_MS) / 1000);
       if (format === 'json') {
         return {
           content: [{
             type: 'text',
             text: JSON.stringify({ status: 'ok', uptime_seconds: uptimeSec, version: SERVER_VERSION, total_calls: totalToolCalls }),
           }],
         };
       }
       return {
         content: [{ type: 'text', text: `ok|up:${uptimeSec}s|v${SERVER_VERSION}|calls:${totalToolCalls}` }],
       };
     }
     ```
  2. Add dispatch case to `CallToolRequestSchema` switch:
     ```typescript
     case 'dev_ping':
       return pingTool(args?.format as string);
     ```

### Success Criteria

#### Automated:
- [ ] `npm run --prefix dev-flow/mcp-server build` exits 0
- [ ] `npm run --prefix dev-flow/mcp-server bundle` exits 0 (bundle to `scripts/mcp-server.cjs`)

#### Manual:
- [ ] `dev_ping()` returns `ok|up:Ns|v2.1.0|calls:N` compact string
- [ ] `dev_ping(format: "json")` returns valid JSON with all four fields
- [ ] Uptime increases between calls
- [ ] `total_calls` increments on each tool invocation

---

## Phase 4: Add Vitest Unit Test

### Changes Required

- **File**: `dev-flow/mcp-server/src/index.test.ts` (new file)
- **Changes**: Minimal test covering `pingTool` behavior via integration approach, or extract `pingTool` as an exported utility and unit-test it directly. Given the existing pattern (all tool functions are module-internal), the simplest approach is to test via the server handler directly.

  Alternative (lower friction): Export `pingTool` as a named export from a new `src/health.ts` module and test that module in isolation. This keeps `index.ts` clean.

  Recommended approach — create `src/health.ts`:
  ```typescript
  export function buildPingResponse(startMs: number, version: string, calls: number, format?: string) { ... }
  ```
  Test `buildPingResponse` in `src/health.test.ts`.

- **File**: `dev-flow/mcp-server/src/health.ts` (new file, contains `buildPingResponse`)
- **File**: `dev-flow/mcp-server/src/health.test.ts` (new file, vitest tests)
- **Update**: `dev-flow/mcp-server/src/index.ts` — import and delegate to `buildPingResponse`

### Success Criteria

#### Automated:
- [ ] `npm test --prefix dev-flow/mcp-server` exits 0
- [ ] New tests cover: compact format output, JSON format output, uptime calculation, call count reflection

#### Manual:
- [ ] Tests added to existing vitest suite without configuration changes
