/**
 * Task 5.3: Execution report generation from gate data
 */

import { tmpdir } from 'os';
import { join } from 'path';
import { mkdirSync, writeFileSync, readFileSync, rmSync, existsSync } from 'fs';
import { vi, describe, test, expect, beforeEach, afterEach } from 'vitest';
import { generateExecutionReport } from '../continuity/execution-report';

// Mock getCwd to return testDir
vi.mock('child_process', () => ({
  execSync: vi.fn((cmd: string) => {
    if (cmd.includes('rev-parse --show-toplevel')) {
      return (globalThis as any).__testDir + '\n';
    }
    return '';
  }),
}));

let testDir: string;

beforeEach(() => {
  testDir = join(tmpdir(), `exec-report-test-${Date.now()}`);
  mkdirSync(testDir, { recursive: true });
  (globalThis as any).__testDir = testDir;
});

afterEach(() => {
  rmSync(testDir, { recursive: true, force: true });
  vi.clearAllMocks();
});

function makeLedger(content: string): string {
  const ledgerPath = join(testDir, 'TASK-1-test.md');
  writeFileSync(ledgerPath, content);
  return ledgerPath;
}

// ---------------------------------------------------------------------------
// Basic report generation
// ---------------------------------------------------------------------------

describe('generateExecutionReport — basic', () => {
  test('returns reportPath and summary for v2 ledger', () => {
    const ledgerPath = makeLedger(`# Session: TASK-1-test
Updated: 2026-01-01T00:00:00.000Z

## State
- [x] 1.1: Setup (10:00, 5min)
  gates: self:pass spec:pass quality:pass verify:pass
  retries: 0
- [x] 1.2: Implement (10:05, 8min)
  gates: self:pass spec:pass quality:pass verify:pass
  retries: 0
- [ ] 1.3: Update docs
`);

    const result = generateExecutionReport(ledgerPath);
    expect(result.reportPath).toBeTruthy();
    expect(result.summary).toContain('2/3 tasks done');
  });

  test('writes report file to .proof/execution-report.md', () => {
    const ledgerPath = makeLedger(`## State
- [x] 1.1: Task (10:00, 5min)
  gates: self:pass verify:pass
  retries: 0
`);

    const result = generateExecutionReport(ledgerPath);
    expect(existsSync(result.reportPath)).toBe(true);
    expect(result.reportPath).toContain('execution-report.md');
  });

  test('report contains Task Completion section', () => {
    const ledgerPath = makeLedger(`## State
- [x] 1.1: Task A (10:00, 5min)
  gates: self:pass verify:pass
  retries: 0
- [→] 1.2: Task B
  gates: self:pass
- [ ] 1.3: Task C
`);

    const result = generateExecutionReport(ledgerPath);
    const report = readFileSync(result.reportPath, 'utf-8');
    expect(report).toContain('## Task Completion');
    expect(report).toContain('Total: 3');
    expect(report).toContain('Done: 1');
    expect(report).toContain('In Progress: 1');
    expect(report).toContain('Skipped/Pending: 1');
  });
});

// ---------------------------------------------------------------------------
// Gate pass rates
// ---------------------------------------------------------------------------

describe('generateExecutionReport — gate pass rates', () => {
  test('includes gate pass rate for each gate type', () => {
    const ledgerPath = makeLedger(`## State
- [x] 1.1: Task A (10:00, 5min)
  gates: self:pass spec:pass verify:pass
  retries: 0
- [x] 1.2: Task B (10:05, 8min)
  gates: self:pass spec:fail verify:pass
  retries: 0
`);

    const result = generateExecutionReport(ledgerPath);
    const report = readFileSync(result.reportPath, 'utf-8');
    expect(report).toContain('## Gate Pass Rates');
    // self: 2/2 = 100%
    expect(report).toContain('self: 2/2 pass (100%)');
    // spec: 1/2 = 50%
    expect(report).toContain('spec: 1/2 pass (50%)');
    // verify: 2/2 = 100%
    expect(report).toContain('verify: 2/2 pass (100%)');
  });

  test('marks failing gates with warning/error indicators', () => {
    const ledgerPath = makeLedger(`## State
- [x] 1.1: Task (10:00, 5min)
  gates: spec:fail quality:fail verify:fail
  retries: 0
- [x] 1.2: Task two (10:05, 5min)
  gates: spec:fail quality:fail verify:fail
  retries: 0
`);

    const result = generateExecutionReport(ledgerPath);
    const report = readFileSync(result.reportPath, 'utf-8');
    // 0% pass rate should get ❌
    expect(report).toContain('❌');
  });
});

// ---------------------------------------------------------------------------
// Self-healing stats
// ---------------------------------------------------------------------------

describe('generateExecutionReport — self-healing stats', () => {
  test('reports total retries across tasks', () => {
    const ledgerPath = makeLedger(`## State
- [x] 1.1: Task A (10:00, 5min)
  gates: self:pass verify:fail>pass(r1: err)
  retries: 1
- [x] 1.2: Task B (10:05, 5min)
  gates: self:pass verify:fail>pass(r2: err2)
  retries: 2
`);

    const result = generateExecutionReport(ledgerPath);
    const report = readFileSync(result.reportPath, 'utf-8');
    expect(report).toContain('## Self-Healing Stats');
    expect(report).toContain('Total retries: 3 across 2 tasks');
  });

  test('reports zero retries when clean', () => {
    const ledgerPath = makeLedger(`## State
- [x] 1.1: Task (10:00, 5min)
  gates: self:pass verify:pass
  retries: 0
`);

    const result = generateExecutionReport(ledgerPath);
    const report = readFileSync(result.reportPath, 'utf-8');
    expect(report).toContain('Total retries: 0 across 0 tasks');
  });
});

// ---------------------------------------------------------------------------
// Decision agent usage
// ---------------------------------------------------------------------------

describe('generateExecutionReport — decision agent usage', () => {
  test('reports no decisions when no decision data', () => {
    const ledgerPath = makeLedger(`## State
- [x] 1.1: Task (10:00, 5min)
  gates: self:pass verify:pass
  retries: 0
`);

    const result = generateExecutionReport(ledgerPath);
    const report = readFileSync(result.reportPath, 'utf-8');
    expect(report).toContain('## Decision Agent Usage');
    expect(report).toContain('No decision agent invocations recorded');
  });
});

// ---------------------------------------------------------------------------
// Top pitfalls
// ---------------------------------------------------------------------------

describe('generateExecutionReport — pitfalls', () => {
  test('includes pitfalls section when spec fails > 1 round', () => {
    const ledgerPath = makeLedger(`## State
- [x] 1.1: Complex task (14:00, 15min)
  gates: self:pass spec:fail>pass(r2: missing constraint) quality:pass verify:pass
  retries: 0
`);

    const result = generateExecutionReport(ledgerPath);
    const report = readFileSync(result.reportPath, 'utf-8');
    expect(report).toContain('## Top Pitfalls Encountered');
    expect(report).toContain('spec-review failed');
  });

  test('no pitfalls section when no notable failures', () => {
    const ledgerPath = makeLedger(`## State
- [x] 1.1: Clean task (10:00, 5min)
  gates: self:pass spec:pass verify:pass
  retries: 0
`);

    const result = generateExecutionReport(ledgerPath);
    const report = readFileSync(result.reportPath, 'utf-8');
    expect(report).not.toContain('## Top Pitfalls Encountered');
  });
});

// ---------------------------------------------------------------------------
// Error handling
// ---------------------------------------------------------------------------

describe('generateExecutionReport — error handling', () => {
  test('returns empty reportPath when ledger file not found', () => {
    const result = generateExecutionReport(join(testDir, 'nonexistent.md'));
    expect(result.reportPath).toBe('');
    expect(result.summary).toContain('not found');
  });
});

// ---------------------------------------------------------------------------
// Summary string format
// ---------------------------------------------------------------------------

describe('generateExecutionReport — summary format', () => {
  test('summary includes done/total, gate rates, retries', () => {
    const ledgerPath = makeLedger(`## State
- [x] 1.1: Task A (10:00, 5min)
  gates: self:pass spec:pass verify:pass
  retries: 0
- [x] 1.2: Task B (10:05, 5min)
  gates: self:pass spec:fail verify:fail>pass(r1: err)
  retries: 1
- [ ] 1.3: Pending
`);

    const result = generateExecutionReport(ledgerPath);
    expect(result.summary).toContain('2/3 tasks done');
    expect(result.summary).toContain('retries');
    // Should contain gate percentages
    expect(result.summary).toMatch(/\w+:\d+%/);
  });
});
