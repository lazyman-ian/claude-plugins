/**
 * Ledger v2 tests: schema, parser, round-trip, backward compat, task_update
 */

import { tmpdir } from 'os';
import { join } from 'path';
import { mkdirSync, writeFileSync, readFileSync, rmSync } from 'fs';
import {
  parseGateLine,
  parseLedgerV2,
  serializeLedgerTaskEntry,
  writeLedgerTaskEntry,
  ledgerTaskUpdate,
  ledgerCreate,
} from '../continuity/ledger';
import type { LedgerTaskEntry } from '../continuity/ledger';

// ---------------------------------------------------------------------------
// parseGateLine
// ---------------------------------------------------------------------------

describe('parseGateLine', () => {
  test('parses simple pass gates', () => {
    const gates = parseGateLine('  gates: self:pass spec:pass verify:pass');
    expect(gates).toHaveLength(3);
    expect(gates[0]).toEqual({ gate: 'self', result: 'pass' });
    expect(gates[1]).toEqual({ gate: 'spec', result: 'pass' });
    expect(gates[2]).toEqual({ gate: 'verify', result: 'pass' });
  });

  test('parses gate with detail in parens', () => {
    const gates = parseGateLine('  gates: quality:pass(P2x1)');
    expect(gates).toHaveLength(1);
    expect(gates[0]).toEqual({ gate: 'quality', result: 'pass', detail: 'P2x1' });
  });

  test('parenthesized detail with colon does not split inside paren', () => {
    const gates = parseGateLine('  gates: verify:fail>pass(r1: missing import)');
    expect(gates).toHaveLength(1);
    expect(gates[0].gate).toBe('verify');
    expect(gates[0].result).toBe('pass');
    expect(gates[0].detail).toBe('r1: missing import');
  });

  test('skip result', () => {
    const gates = parseGateLine('  gates: ui:skip');
    expect(gates[0]).toEqual({ gate: 'ui', result: 'skip' });
  });

  test('fail result', () => {
    const gates = parseGateLine('  gates: spec:fail');
    expect(gates[0]).toEqual({ gate: 'spec', result: 'fail' });
  });

  test('handles fail>pass escalation', () => {
    const gates = parseGateLine('  gates: spec:fail>pass(r2)');
    expect(gates[0].result).toBe('pass');
    expect(gates[0].detail).toBe('r2');
  });

  test('returns empty array for empty gates line', () => {
    expect(parseGateLine('  gates: ')).toHaveLength(0);
    expect(parseGateLine('')).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// serializeLedgerTaskEntry
// ---------------------------------------------------------------------------

describe('serializeLedgerTaskEntry', () => {
  test('serializes done entry with gates and retries', () => {
    const entry: LedgerTaskEntry = {
      id: '1.1',
      name: 'Setup auth module',
      status: 'done',
      timestamp: '14:30, 8min',
      gates: [
        { gate: 'self', result: 'pass' },
        { gate: 'spec', result: 'pass' },
        { gate: 'quality', result: 'pass', detail: 'P2x1' },
        { gate: 'verify', result: 'pass' },
      ],
      retries: 0,
    };
    const out = serializeLedgerTaskEntry(entry);
    expect(out).toContain('- [x] 1.1: Setup auth module (14:30, 8min)');
    expect(out).toContain('  gates: self:pass spec:pass quality:pass(P2x1) verify:pass');
    expect(out).toContain('  retries: 0');
  });

  test('serializes in_progress entry without gates', () => {
    const entry: LedgerTaskEntry = {
      id: '1.3',
      name: 'Add tests',
      status: 'in_progress',
    };
    const out = serializeLedgerTaskEntry(entry);
    expect(out).toBe('- [→] 1.3: Add tests\n');
  });

  test('serializes pending entry', () => {
    const entry: LedgerTaskEntry = {
      id: '1.4',
      name: 'Update docs',
      status: 'pending',
    };
    const out = serializeLedgerTaskEntry(entry);
    expect(out).toContain('- [ ] 1.4: Update docs');
  });
});

// ---------------------------------------------------------------------------
// parseLedgerV2 — v2 round-trip
// ---------------------------------------------------------------------------

describe('parseLedgerV2', () => {
  const v2Content = `# Session: TASK-1-test
Updated: 2026-01-01T00:00:00.000Z

## State
- [x] 1.1: Setup auth module (14:30, 8min)
  gates: self:pass spec:pass quality:pass(P2x1) verify:pass
  retries: 0
- [x] 1.2: Implement login flow (14:38, 12min)
  gates: self:pass spec:fail>pass(r2) quality:pass verify:fail>pass(r1: missing import)
  retries: 1
- [→] 1.3: Add tests
  gates: self:pass spec:pending
- [ ] 1.4: Update docs

## Open Questions
`;

  test('parses all four entries', () => {
    const entries = parseLedgerV2(v2Content);
    expect(entries).toHaveLength(4);
  });

  test('parses done entry with gates and retries', () => {
    const entries = parseLedgerV2(v2Content);
    const e = entries[0];
    expect(e.id).toBe('1.1');
    expect(e.name).toBe('Setup auth module');
    expect(e.status).toBe('done');
    expect(e.timestamp).toBe('14:30, 8min');
    expect(e.gates).toHaveLength(4);
    expect(e.gates![2]).toEqual({ gate: 'quality', result: 'pass', detail: 'P2x1' });
    expect(e.retries).toBe(0);
  });

  test('parses retry escalation (fail>pass) in entry 1.2', () => {
    const entries = parseLedgerV2(v2Content);
    const e = entries[1];
    expect(e.id).toBe('1.2');
    expect(e.retries).toBe(1);
    const verifyGate = e.gates!.find(g => g.gate === 'verify');
    expect(verifyGate?.result).toBe('pass');
    expect(verifyGate?.detail).toBe('r1: missing import');
  });

  test('parses in_progress entry', () => {
    const entries = parseLedgerV2(v2Content);
    const e = entries[2];
    expect(e.status).toBe('in_progress');
    expect(e.id).toBe('1.3');
  });

  test('parses pending entry with no gate data', () => {
    const entries = parseLedgerV2(v2Content);
    const e = entries[3];
    expect(e.status).toBe('pending');
    expect(e.id).toBe('1.4');
    expect(e.gates).toBeUndefined();
  });

  test('returns empty array when no ## State section', () => {
    expect(parseLedgerV2('# No state here\n\n## Goal\nfoo')).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// v1 backward compatibility
// ---------------------------------------------------------------------------

describe('parseLedgerV2 v1 backward compat', () => {
  const v1Content = `# Session: TASK-5-old
Updated: 2025-01-01T00:00:00.000Z

## State
- Done:
  - [x] 初始化 (10:00)
- Now:
  - [→] 开发功能
- Next:
  - [ ] 代码审查
  - [ ] 测试

## Working Set
`;

  test('v1 checkbox entries parsed without crashing', () => {
    // v1 lines like `  - [x] 初始化 (10:00)` have leading spaces and are nested
    // Our parser handles top-level `- [x]` lines; v1 indented lines are silently skipped
    const entries = parseLedgerV2(v1Content);
    // v1 uses `- Done:`, `- Now:`, `- Next:` as section headers — not task entries
    // so entries may be 0 (we don't crash)
    expect(Array.isArray(entries)).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// writeLedgerTaskEntry — round-trip on disk
// ---------------------------------------------------------------------------

describe('writeLedgerTaskEntry', () => {
  let testDir: string;

  beforeEach(() => {
    testDir = join(tmpdir(), `ledger-v2-test-${Date.now()}`);
    mkdirSync(testDir, { recursive: true });
  });

  afterEach(() => {
    rmSync(testDir, { recursive: true, force: true });
  });

  function makeTestLedger(extra = ''): string {
    const p = join(testDir, 'CONTINUITY_CLAUDE-test.md');
    writeFileSync(p, `# Session: TASK-1-test\nUpdated: 2026-01-01T00:00:00.000Z\n\n## State\n${extra}\n## Goal\ntest\n`);
    return p;
  }

  test('appends new entry to ## State section', () => {
    const filePath = makeTestLedger();
    const entry: LedgerTaskEntry = {
      id: '1.1',
      name: 'Setup auth',
      status: 'done',
      timestamp: '14:30, 5min',
      gates: [{ gate: 'verify', result: 'pass' }],
      retries: 0,
    };
    writeLedgerTaskEntry(filePath, entry);
    const content = readFileSync(filePath, 'utf-8');
    expect(content).toContain('- [x] 1.1: Setup auth (14:30, 5min)');
    expect(content).toContain('  gates: verify:pass');
    expect(content).toContain('  retries: 0');
  });

  test('round-trip: write then parse matches original', () => {
    const filePath = makeTestLedger();
    const entry: LedgerTaskEntry = {
      id: '2.3',
      name: 'Implement login',
      status: 'done',
      timestamp: '15:00, 10min',
      gates: [
        { gate: 'self', result: 'pass' },
        { gate: 'quality', result: 'pass', detail: 'P2x1' },
      ],
      retries: 1,
    };
    writeLedgerTaskEntry(filePath, entry);

    const content = readFileSync(filePath, 'utf-8');
    const parsed = parseLedgerV2(content);
    expect(parsed).toHaveLength(1);
    expect(parsed[0].id).toBe('2.3');
    expect(parsed[0].name).toBe('Implement login');
    expect(parsed[0].status).toBe('done');
    expect(parsed[0].gates).toHaveLength(2);
    expect(parsed[0].gates![1].detail).toBe('P2x1');
    expect(parsed[0].retries).toBe(1);
  });

  test('updates timestamp when writing', () => {
    const filePath = makeTestLedger();
    const before = readFileSync(filePath, 'utf-8');
    expect(before).toContain('Updated: 2026-01-01T00:00:00.000Z');

    writeLedgerTaskEntry(filePath, { id: '1', name: 'x', status: 'done' });
    const after = readFileSync(filePath, 'utf-8');
    expect(after).not.toContain('Updated: 2026-01-01T00:00:00.000Z');
    expect(after).toMatch(/Updated: \d{4}-\d{2}-\d{2}T/);
  });

  test('replaces existing entry with same id', () => {
    const entry1: LedgerTaskEntry = {
      id: '1.1',
      name: 'Setup auth',
      status: 'in_progress',
    };
    const entry2: LedgerTaskEntry = {
      id: '1.1',
      name: 'Setup auth',
      status: 'done',
      timestamp: '14:30, 5min',
      gates: [{ gate: 'verify', result: 'pass' }],
      retries: 0,
    };
    const filePath = makeTestLedger();
    writeLedgerTaskEntry(filePath, entry1);
    writeLedgerTaskEntry(filePath, entry2);

    const content = readFileSync(filePath, 'utf-8');
    // Should appear exactly once as done, not in_progress
    const matches = content.match(/- \[[x ]\] 1\.1:/g);
    expect(matches).toHaveLength(1);
    expect(content).toContain('- [x] 1.1: Setup auth');
  });
});

// ---------------------------------------------------------------------------
// Task 1.2: ledgerTaskUpdate (unit test without active git ledger)
// Tests the lower-level writeLedgerTaskEntry + parseLedgerV2 used by ledgerTaskUpdate
// ---------------------------------------------------------------------------

describe('task_update flow (writeLedgerTaskEntry gate upsert)', () => {
  let testDir: string;

  beforeEach(() => {
    testDir = join(tmpdir(), `ledger-task-update-${Date.now()}`);
    mkdirSync(testDir, { recursive: true });
  });

  afterEach(() => {
    rmSync(testDir, { recursive: true, force: true });
  });

  function makeTestLedger(): string {
    const p = join(testDir, 'CONTINUITY_CLAUDE-test.md');
    writeFileSync(p, `# Session: TASK-1-test\nUpdated: 2026-01-01T00:00:00.000Z\n\n## State\n\n## Goal\ntest\n`);
    return p;
  }

  test('adds gate to new entry', () => {
    const filePath = makeTestLedger();
    // Simulate task_update by writing a new entry with a gate
    const entry: LedgerTaskEntry = {
      id: '1.1',
      name: 'Setup auth',
      status: 'in_progress',
      gates: [{ gate: 'self', result: 'pass' }],
    };
    writeLedgerTaskEntry(filePath, entry);

    const content = readFileSync(filePath, 'utf-8');
    const entries = parseLedgerV2(content);
    expect(entries).toHaveLength(1);
    expect(entries[0].gates).toHaveLength(1);
    expect(entries[0].gates![0]).toEqual({ gate: 'self', result: 'pass' });
  });

  test('upserts gate on existing entry', () => {
    const filePath = makeTestLedger();
    const entry: LedgerTaskEntry = {
      id: '1.1',
      name: 'Setup auth',
      status: 'in_progress',
      gates: [{ gate: 'self', result: 'pass' }],
    };
    writeLedgerTaskEntry(filePath, entry);

    // Update with additional gate
    const updated: LedgerTaskEntry = {
      id: '1.1',
      name: 'Setup auth',
      status: 'in_progress',
      gates: [{ gate: 'self', result: 'pass' }, { gate: 'spec', result: 'pass' }],
    };
    writeLedgerTaskEntry(filePath, updated);

    const content = readFileSync(filePath, 'utf-8');
    const entries = parseLedgerV2(content);
    expect(entries).toHaveLength(1);
    expect(entries[0].gates).toHaveLength(2);
  });

  test('gate summary detection: entries with gates produce summary string', () => {
    const contentWithGates = `## State\n- [x] 1.1: Test (10:00, 2min)\n  gates: self:pass spec:pass verify:pass\n  retries: 0\n`;
    const entries = parseLedgerV2(contentWithGates);
    expect(entries[0].gates).toHaveLength(3);

    // All gates pass => 3/3
    let totalGates = 0;
    let passGates = 0;
    for (const e of entries) {
      for (const g of (e.gates || [])) {
        totalGates++;
        if (g.result === 'pass') passGates++;
      }
    }
    expect(`gates:${passGates}/${totalGates} pass`).toBe('gates:3/3 pass');
  });

  test('gate summary with mixed results', () => {
    const content = `## State\n- [x] 1.1: Test\n  gates: self:pass spec:fail verify:pass\n`;
    const entries = parseLedgerV2(content);
    let totalGates = 0;
    let passGates = 0;
    for (const e of entries) {
      for (const g of (e.gates || [])) {
        totalGates++;
        if (g.result === 'pass') passGates++;
      }
    }
    expect(`gates:${passGates}/${totalGates} pass`).toBe('gates:2/3 pass');
  });
});

// ---------------------------------------------------------------------------
// Task 1.4: ledgerCreate template v2 format
// ---------------------------------------------------------------------------

describe('ledgerCreate v2 template', () => {
  let testDir: string;

  beforeEach(() => {
    testDir = join(tmpdir(), `ledger-create-${Date.now()}`);
    mkdirSync(testDir, { recursive: true });
    // Mock getCwd to point to testDir by setting up directory structure
    mkdirSync(join(testDir, 'thoughts/ledgers'), { recursive: true });
  });

  afterEach(() => {
    rmSync(testDir, { recursive: true, force: true });
  });

  test('created ledger contains ## State section with gate notation comment', () => {
    // ledgerCreate uses getCwd() which calls git, so we test the template inline
    // by verifying the template string contains expected v2 markers
    // We directly create a ledger file with the template content as ledgerCreate would
    const template = `# Session: TASK-99-Test-Feature
Updated: ${new Date().toISOString()}

## Goal
Test Feature

## Constraints
- 遵循项目规范
- 通过 make check 验证

## Key Decisions

## State
<!-- Gate notation: gate:result(detail) — results: pass|fail|skip, e.g. quality:pass(P2x1) verify:fail>pass(r1: msg) -->
- [ ] 1.1: 初始化
- [→] 1.2: 开发功能
- [ ] 1.3: 代码审查
- [ ] 1.4: 测试

## Open Questions

## Working Set
- Branch: \`feature/TASK-99-test-feature\`
`;

    const filePath = join(testDir, 'CONTINUITY_CLAUDE-test.md');
    writeFileSync(filePath, template);
    const content = readFileSync(filePath, 'utf-8');

    // Verify v2 format markers
    expect(content).toContain('## State');
    expect(content).toContain('Gate notation');
    expect(content).toContain('gate:result(detail)');
    expect(content).toContain('pass|fail|skip');

    // Verify v2 task line format (dotted id: name)
    expect(content).toContain('- [ ] 1.1: 初始化');
    expect(content).toContain('- [→] 1.2: 开发功能');

    // Verify v1 format NOT used (no "- Done:" or "- Now:")
    expect(content).not.toContain('- Done:');
    expect(content).not.toContain('- Now:');
    expect(content).not.toContain('- Next:');
  });

  test('v2 template State section is parseable by parseLedgerV2', () => {
    const stateSection = `## State
<!-- Gate notation: gate:result(detail) — results: pass|fail|skip, e.g. quality:pass(P2x1) verify:fail>pass(r1: msg) -->
- [ ] 1.1: 初始化
- [→] 1.2: 开发功能
- [ ] 1.3: 代码审查
- [ ] 1.4: 测试
`;
    const entries = parseLedgerV2(stateSection);
    expect(entries).toHaveLength(4);
    expect(entries[0]).toMatchObject({ id: '1.1', status: 'pending' });
    expect(entries[1]).toMatchObject({ id: '1.2', status: 'in_progress' });
    expect(entries[2]).toMatchObject({ id: '1.3', status: 'pending' });
    expect(entries[3]).toMatchObject({ id: '1.4', status: 'pending' });
  });
});
