/**
 * Task 5.2: Context injector — buildExecutionContext() tests
 */

import { tmpdir } from 'os';
import { join } from 'path';
import { mkdirSync, writeFileSync, rmSync } from 'fs';
import { vi, describe, test, expect, beforeEach, afterEach } from 'vitest';
import { buildExecutionContext } from '../continuity/context-injector';

// We need to control the filesystem paths used by context-injector.
// The functions rely on getCwd() which calls git rev-parse --show-toplevel.
// We mock execSync to control both git and branch queries.

vi.mock('child_process', () => ({
  execSync: vi.fn(),
}));

import { execSync } from 'child_process';
const mockExecSync = execSync as ReturnType<typeof vi.fn>;

let testDir: string;

beforeEach(() => {
  testDir = join(tmpdir(), `ctx-injector-test-${Date.now()}`);
  mkdirSync(testDir, { recursive: true });

  // Default: getCwd returns testDir, branch is feature/TASK-42-auth-flow
  mockExecSync.mockImplementation((cmd: string) => {
    if (cmd.includes('rev-parse --show-toplevel')) return testDir + '\n';
    if (cmd.includes('branch --show-current')) return 'feature/TASK-42-auth-flow\n';
    return '';
  });
});

afterEach(() => {
  rmSync(testDir, { recursive: true, force: true });
  vi.clearAllMocks();
});

function makeledgersDir(): string {
  const p = join(testDir, 'thoughts', 'ledgers');
  mkdirSync(p, { recursive: true });
  return p;
}

function makeArchiveDir(): string {
  const p = join(testDir, 'thoughts', 'ledgers', 'archive');
  mkdirSync(p, { recursive: true });
  return p;
}

// ---------------------------------------------------------------------------
// No ledger — returns empty string
// ---------------------------------------------------------------------------

describe('buildExecutionContext — no ledger', () => {
  test('returns empty string when no thoughts/ledgers directory', () => {
    const result = buildExecutionContext();
    expect(result).toBe('');
  });

  test('returns empty string when ledgers dir exists but no matching file', () => {
    makeledgersDir();
    const result = buildExecutionContext();
    expect(result).toBe('');
  });
});

// ---------------------------------------------------------------------------
// Active ledger with in-progress task
// ---------------------------------------------------------------------------

describe('buildExecutionContext — active ledger', () => {
  test('injects Resume line for in-progress task with gate status', () => {
    const dir = makeledgersDir();
    writeFileSync(join(dir, 'TASK-42-auth-flow.md'), `# Session: TASK-42-auth-flow
Updated: 2026-01-01T00:00:00.000Z

## State
- [x] 1.1: Setup (10:00, 5min)
  gates: self:pass spec:pass verify:pass
  retries: 0
- [→] 1.2: Implement login
  gates: self:pass spec:pass
`);

    const result = buildExecutionContext();
    expect(result).toContain('Resume: Task 1.2');
    expect(result).toContain('spec:pass');
  });

  test('injects Last failure line when retries > 0', () => {
    const dir = makeledgersDir();
    writeFileSync(join(dir, 'TASK-42-auth-flow.md'), `# Session: TASK-42-auth-flow
Updated: 2026-01-01T00:00:00.000Z

## State
- [→] 1.1: Implement
  gates: self:pass spec:pass verify:fail>pass(r1: missing import)
  retries: 1
`);

    const result = buildExecutionContext();
    expect(result).toContain('Last failure:');
    expect(result).toContain('missing import');
  });

  test('no Last failure when retries = 0', () => {
    const dir = makeledgersDir();
    writeFileSync(join(dir, 'TASK-42-auth-flow.md'), `# Session: TASK-42-auth-flow
Updated: 2026-01-01T00:00:00.000Z

## State
- [→] 1.1: Implement
  gates: self:pass spec:pass
  retries: 0
`);

    const result = buildExecutionContext();
    expect(result).not.toContain('Last failure');
  });

  test('no resume when all tasks done (no in-progress)', () => {
    const dir = makeledgersDir();
    writeFileSync(join(dir, 'TASK-42-auth-flow.md'), `# Session: TASK-42-auth-flow
Updated: 2026-01-01T00:00:00.000Z

## State
- [x] 1.1: Done task (10:00, 5min)
  gates: self:pass spec:pass verify:pass
  retries: 0
`);

    const result = buildExecutionContext();
    // No in-progress, possibly empty
    expect(result).not.toContain('Resume:');
  });
});

// ---------------------------------------------------------------------------
// Archive match
// ---------------------------------------------------------------------------

describe('buildExecutionContext — archive match', () => {
  test('injects archive summary when TASK-id matches archived file with retries', () => {
    const ledgersDir = makeledgersDir();
    const archiveDir = makeArchiveDir();

    // Active ledger with no in-progress
    writeFileSync(join(ledgersDir, 'TASK-42-auth-flow.md'), `# Session: TASK-42-auth-flow
Updated: 2026-01-01T00:00:00.000Z

## State
- [ ] 1.1: Pending task
`);

    // Archived file with high retry count
    writeFileSync(join(archiveDir, 'TASK-42-earlier-attempt.md'), `# Session: TASK-42-earlier-attempt
Updated: 2026-01-01T00:00:00.000Z

## State
- [x] 1.1: Auth setup (10:00, 5min)
  gates: self:pass spec:pass verify:fail>pass(r1: token error)
  retries: 1
- [x] 1.2: Login flow (10:05, 5min)
  gates: self:pass spec:pass verify:fail>pass(r1: missing header)
  retries: 1
`);

    const result = buildExecutionContext();
    expect(result).toContain('Archive match');
    expect(result).toContain('retries');
  });

  test('injects archive summary when branch keyword matches', () => {
    const ledgersDir = makeledgersDir();
    const archiveDir = makeArchiveDir();

    // Active ledger with no in-progress
    writeFileSync(join(ledgersDir, 'TASK-42-auth-flow.md'), `# Session: TASK-42-auth-flow
Updated: 2026-01-01T00:00:00.000Z

## State
- [ ] 1.1: Pending task
`);

    // Archived file containing "auth" keyword
    writeFileSync(join(archiveDir, 'TASK-99-auth-refactor.md'), `# Session: TASK-99-auth-refactor
Updated: 2025-12-01T00:00:00.000Z

## State
- [x] 1.1: Auth module
  gates: self:pass spec:fail quality:pass verify:pass
  retries: 0
- [x] 1.2: Auth tests
  gates: self:pass spec:fail quality:pass verify:pass
  retries: 0
`);

    const result = buildExecutionContext();
    // "auth" keyword matches — should find the archive and note low spec pass rate
    expect(result).toContain('Archive match');
    expect(result).toContain('spec');
  });

  test('no archive summary when no notable patterns in archive', () => {
    const ledgersDir = makeledgersDir();
    const archiveDir = makeArchiveDir();

    writeFileSync(join(ledgersDir, 'TASK-42-auth-flow.md'), `# Session: TASK-42-auth-flow
Updated: 2026-01-01T00:00:00.000Z

## State
- [ ] 1.1: Pending task
`);

    // Clean archived file — no retries, all pass
    writeFileSync(join(archiveDir, 'TASK-42-auth-old.md'), `# Session: TASK-42-auth-old
Updated: 2026-01-01T00:00:00.000Z

## State
- [x] 1.1: Setup (10:00, 5min)
  gates: self:pass spec:pass verify:pass
  retries: 0
`);

    const result = buildExecutionContext();
    expect(result).not.toContain('Archive match');
  });
});

// ---------------------------------------------------------------------------
// Budget enforcement
// ---------------------------------------------------------------------------

describe('buildExecutionContext — budget', () => {
  test('result is within 500 char budget', () => {
    const dir = makeledgersDir();
    // Create ledger with long task names
    writeFileSync(join(dir, 'TASK-42-auth-flow.md'), `# Session: TASK-42-auth-flow
Updated: 2026-01-01T00:00:00.000Z

## State
- [→] 1.1: This is a very long task name that exceeds typical lengths significantly for testing purposes
  gates: self:pass spec:fail>pass(r2: This is a very detailed reason that explains the failure at length)
  retries: 2
`);

    const result = buildExecutionContext();
    expect(result.length).toBeLessThanOrEqual(500);
  });
});
