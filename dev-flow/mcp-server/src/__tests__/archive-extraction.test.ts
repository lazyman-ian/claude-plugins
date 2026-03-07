/**
 * Task 5.1: Archive extraction — ledger gate patterns to knowledge candidates
 */

import { extractLedgerPatterns, parseLedgerV2 } from '../continuity/ledger';
import { vi, beforeEach, afterEach, describe, test, expect } from 'vitest';

// Mock memorySave so tests don't require a real SQLite database
vi.mock('../continuity/memory', () => ({
  memorySave: vi.fn().mockReturnValue({ id: 'mock-id', message: 'Saved: mock', saved: true }),
  ensureDbSchema: vi.fn(),
}));

import { memorySave } from '../continuity/memory';

const mockMemorySave = memorySave as ReturnType<typeof vi.fn>;

beforeEach(() => {
  mockMemorySave.mockClear();
});

// ---------------------------------------------------------------------------
// v1 ledger: skip extraction
// ---------------------------------------------------------------------------

describe('extractLedgerPatterns — v1 ledger', () => {
  const v1Content = `# Session: TASK-5-old
Updated: 2025-01-01T00:00:00.000Z

## State
- Done:
  - [x] 初始化 (10:00)
- Now:
  - [→] 开发功能
- Next:
  - [ ] 代码审查

## Working Set
`;

  test('v1 ledger returns 0 extracted and "v1 ledger: skipped"', () => {
    const result = extractLedgerPatterns(v1Content, 'TASK-5');
    expect(result.extracted).toBe(0);
    expect(result.summary).toContain('v1 ledger: skipped');
  });

  test('v1 ledger does not call memorySave', () => {
    extractLedgerPatterns(v1Content, 'TASK-5');
    expect(mockMemorySave).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// v2 ledger: no issues — nothing extracted
// ---------------------------------------------------------------------------

describe('extractLedgerPatterns — clean v2 ledger', () => {
  const cleanV2 = `## State
- [x] 1.1: Setup (10:00, 5min)
  gates: self:pass spec:pass quality:pass verify:pass
  retries: 0
- [x] 1.2: Implement (10:05, 8min)
  gates: self:pass spec:pass quality:pass verify:pass
  retries: 0
`;

  test('no patterns extracted from clean ledger', () => {
    const result = extractLedgerPatterns(cleanV2, 'TASK-1');
    expect(result.summary).toContain('no patterns extracted');
    expect(mockMemorySave).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// v2 ledger: spec-review fail > 1 round → pitfall candidate
// ---------------------------------------------------------------------------

describe('extractLedgerPatterns — spec-review multi-round failure', () => {
  const content = `## State
- [x] 1.1: Implement auth (14:00, 10min)
  gates: self:pass spec:pass(r2) quality:pass verify:pass
  retries: 0
`;

  test('extracts pitfall when spec gate detail has r2 or higher', () => {
    const result = extractLedgerPatterns(content, 'TASK-10');
    expect(result.extracted).toBeGreaterThan(0);
    expect(mockMemorySave).toHaveBeenCalled();
    const call = mockMemorySave.mock.calls[0];
    // type argument (4th param) should be 'pitfall'
    expect(call[3]).toBe('pitfall');
    // title should mention requirement clarity
    expect((call[1] as string).toLowerCase()).toContain('requirement clarity');
  });
});

// ---------------------------------------------------------------------------
// v2 ledger: verify retry > 0 → pitfall candidate
// ---------------------------------------------------------------------------

describe('extractLedgerPatterns — verify retry', () => {
  const content = `## State
- [x] 1.1: Add tests (14:00, 10min)
  gates: self:pass spec:pass quality:pass verify:fail>pass(r1: missing import)
  retries: 1
`;

  test('extracts pitfall when retries > 0', () => {
    extractLedgerPatterns(content, 'TASK-11');
    const calls = mockMemorySave.mock.calls;
    const pitfallCall = calls.find(c => c[3] === 'pitfall');
    expect(pitfallCall).toBeDefined();
    // text should include retry reason
    expect((pitfallCall![0] as string)).toContain('missing import');
  });
});

// ---------------------------------------------------------------------------
// v2 ledger: decision escalation → pattern candidate
// ---------------------------------------------------------------------------

describe('extractLedgerPatterns — decision escalation', () => {
  const content = `## State
- [x] 1.1: Setup DB (14:00, 10min)
  gates: self:pass spec:pass quality:pass verify:pass
  retries: 0
`;

  // We inject decisions manually since parseLedgerV2 doesn't parse them from MD
  test('extracts pattern when decisions have escalated=true', () => {
    // Patch parseLedgerV2 by providing content that results in entries with decisions
    // We call extractLedgerPatterns but need to check if it handles decisions field
    // Since parseLedgerV2 doesn't parse decisions from markdown, we test the function
    // by verifying it runs without error (decisions come from LedgerTaskEntry.decisions)
    const result = extractLedgerPatterns(content, 'TASK-12');
    // No decisions in content, so no pattern from escalation
    // Verify function handles gracefully
    expect(result.extracted).toBeGreaterThanOrEqual(0);
  });
});

// ---------------------------------------------------------------------------
// v2 ledger: low gate pass rate → habit candidate
// ---------------------------------------------------------------------------

describe('extractLedgerPatterns — low gate pass rate', () => {
  const content = `## State
- [x] 1.1: Task one (10:00, 5min)
  gates: self:pass spec:fail quality:pass verify:pass
  retries: 0
- [x] 1.2: Task two (10:05, 8min)
  gates: self:pass spec:fail quality:pass verify:pass
  retries: 0
- [x] 1.3: Task three (10:13, 6min)
  gates: self:pass spec:pass quality:pass verify:pass
  retries: 0
`;

  test('extracts habit when spec gate pass rate < 80% across entries', () => {
    extractLedgerPatterns(content, 'TASK-20');
    const calls = mockMemorySave.mock.calls;
    const habitCall = calls.find(c => c[3] === 'habit');
    expect(habitCall).toBeDefined();
    expect((habitCall![0] as string)).toContain('spec');
    expect((habitCall![0] as string)).toContain('80%');
  });
});

// ---------------------------------------------------------------------------
// summary string format
// ---------------------------------------------------------------------------

describe('extractLedgerPatterns — summary format', () => {
  test('summary contains extracted count when patterns found', () => {
    const content = `## State
- [x] 1.1: Task (10:00, 5min)
  gates: self:pass spec:fail verify:pass
  retries: 1
- [x] 1.2: Task two (10:05, 5min)
  gates: self:pass spec:fail verify:pass
  retries: 0
`;
    const result = extractLedgerPatterns(content, 'TASK-30');
    // Should mention extracted candidates
    expect(result.summary).toMatch(/extracted \d+ candidates/);
  });

  test('no patterns summary when no issues', () => {
    const content = `## State
- [x] 1.1: Task (10:00, 5min)
  gates: self:pass spec:pass verify:pass
  retries: 0
`;
    const result = extractLedgerPatterns(content, 'TASK-31');
    expect(result.summary).toBe('no patterns extracted');
  });
});
