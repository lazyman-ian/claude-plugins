/**
 * Context Registry Tests
 */

import { readRegistry, writeRegistry, registerBranch, unregisterBranch, lookupBranch, fallbackLedgerScan } from '../continuity/registry';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

function makeTmpDir(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'registry-test-'));
}

describe('Context Registry', () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = makeTmpDir();
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  test('readRegistry returns empty default when no file exists', () => {
    const reg = readRegistry(tmpDir);
    expect(reg).toEqual({ version: 1, branches: {} });
  });

  test('writeRegistry creates .claude/state/ dir and writes atomically', () => {
    const data = { version: 1, branches: { 'main': { ledger: 'thoughts/ledgers/test.md' } } };
    writeRegistry(tmpDir, data);

    const filePath = path.join(tmpDir, '.claude/state/context.json');
    expect(fs.existsSync(filePath)).toBe(true);
    const content = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
    expect(content).toEqual(data);
  });

  test('registerBranch adds entry with task_id', () => {
    registerBranch(tmpDir, 'feature/TASK-001-foo', 'thoughts/ledgers/TASK-001-foo.md', 'TASK-001');
    const reg = readRegistry(tmpDir);
    expect(reg.branches['feature/TASK-001-foo']).toEqual({
      ledger: 'thoughts/ledgers/TASK-001-foo.md',
      task_id: 'TASK-001',
    });
  });

  test('registerBranch adds entry without task_id', () => {
    registerBranch(tmpDir, 'fix/auth-bug', 'thoughts/ledgers/auth-bug.md');
    const reg = readRegistry(tmpDir);
    expect(reg.branches['fix/auth-bug']).toEqual({
      ledger: 'thoughts/ledgers/auth-bug.md',
    });
  });

  test('registerBranch overwrites existing entry', () => {
    registerBranch(tmpDir, 'main', 'old.md');
    registerBranch(tmpDir, 'main', 'new.md', 'TASK-002');
    const reg = readRegistry(tmpDir);
    expect(reg.branches['main']).toEqual({ ledger: 'new.md', task_id: 'TASK-002' });
  });

  test('unregisterBranch removes entry', () => {
    registerBranch(tmpDir, 'main', 'test.md');
    registerBranch(tmpDir, 'dev', 'dev.md');
    unregisterBranch(tmpDir, 'main');
    const reg = readRegistry(tmpDir);
    expect(reg.branches['main']).toBeUndefined();
    expect(reg.branches['dev']).toEqual({ ledger: 'dev.md' });
  });

  test('unregisterBranch is noop for missing branch', () => {
    registerBranch(tmpDir, 'main', 'test.md');
    unregisterBranch(tmpDir, 'nonexistent');
    const reg = readRegistry(tmpDir);
    expect(reg.branches['main']).toEqual({ ledger: 'test.md' });
  });

  test('lookupBranch returns entry for explicit branch', () => {
    registerBranch(tmpDir, 'feature/foo', 'foo.md', 'FOO');
    const entry = lookupBranch(tmpDir, 'feature/foo');
    expect(entry).toEqual({ ledger: 'foo.md', task_id: 'FOO' });
  });

  test('lookupBranch returns null for unknown branch', () => {
    const entry = lookupBranch(tmpDir, 'nonexistent');
    expect(entry).toBeNull();
  });

  test('readRegistry handles corrupted JSON gracefully', () => {
    const dir = path.join(tmpDir, '.claude/state');
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, 'context.json'), 'not json');
    const reg = readRegistry(tmpDir);
    expect(reg).toEqual({ version: 1, branches: {} });
  });

  test('multiple branches coexist', () => {
    registerBranch(tmpDir, 'feature/a', 'a.md', 'A');
    registerBranch(tmpDir, 'feature/b', 'b.md', 'B');
    registerBranch(tmpDir, 'fix/c', 'c.md');
    const reg = readRegistry(tmpDir);
    expect(Object.keys(reg.branches)).toHaveLength(3);
  });
});

describe('fallbackLedgerScan', () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = makeTmpDir();
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  test('returns null when no ledgers dir', () => {
    expect(fallbackLedgerScan(tmpDir)).toBeNull();
  });

  test('returns null when ledgers dir is empty', () => {
    fs.mkdirSync(path.join(tmpDir, 'thoughts/ledgers'), { recursive: true });
    expect(fallbackLedgerScan(tmpDir)).toBeNull();
  });

  test('returns most recent ledger by mtime', () => {
    const dir = path.join(tmpDir, 'thoughts/ledgers');
    fs.mkdirSync(dir, { recursive: true });

    // Create two files with different mtimes
    fs.writeFileSync(path.join(dir, 'old.md'), 'old');
    const oldTime = new Date(Date.now() - 60000);
    fs.utimesSync(path.join(dir, 'old.md'), oldTime, oldTime);

    fs.writeFileSync(path.join(dir, 'new.md'), 'new');

    const result = fallbackLedgerScan(tmpDir);
    expect(result).toBe('thoughts/ledgers/new.md');
  });

  test('ignores hidden files', () => {
    const dir = path.join(tmpDir, 'thoughts/ledgers');
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, '.compact-checkpoint.md'), 'hidden');
    fs.writeFileSync(path.join(dir, 'visible.md'), 'visible');
    expect(fallbackLedgerScan(tmpDir)).toBe('thoughts/ledgers/visible.md');
  });
});
