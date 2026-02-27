/**
 * Instinct module tests
 */

import * as childProcess from 'child_process';
import * as fs from 'fs';
import { instinctExtract, instinctList } from './instincts';

vi.mock('child_process');
vi.mock('fs');

const mockExecSync = vi.mocked(childProcess.execSync);
const mockExistsSync = vi.mocked(fs.existsSync);

const TEST_DIR = '/test/project';
const DB_PATH = `${TEST_DIR}/.claude/cache/artifact-index/context.db`;

describe('instinctExtract', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  test('returns graceful message when DB does not exist', () => {
    mockExistsSync.mockReturnValue(false);

    const result = instinctExtract(TEST_DIR);

    expect(result.success).toBe(false);
    expect(result.extracted).toBe(0);
    expect(result.message).toContain('No observations found');
    expect(result.message).toContain('Tier 3');
  });

  test('returns graceful message when DB has no observations table', () => {
    mockExistsSync.mockImplementation((p) => p.toString() === DB_PATH);
    // sqlite_master query returns empty (no observations table)
    mockExecSync.mockReturnValueOnce('' as any);

    const result = instinctExtract(TEST_DIR);

    expect(result.success).toBe(false);
    expect(result.extracted).toBe(0);
    expect(result.message).toContain('No observations found');
  });

  test('returns success with 0 extracted when no observations exist', () => {
    mockExistsSync.mockImplementation((p) => p.toString() === DB_PATH);
    // sqlite_master query → table exists
    mockExecSync.mockReturnValueOnce('observations' as any);
    // SELECT observations → empty
    mockExecSync.mockReturnValueOnce('' as any);

    const result = instinctExtract(TEST_DIR);

    expect(result.success).toBe(true);
    expect(result.extracted).toBe(0);
    expect(result.message).toContain('No observations');
  });

  test('extracts instincts from clustered observations', () => {
    mockExistsSync.mockImplementation((p) => p.toString() === DB_PATH);

    // sqlite_master → observations table exists
    mockExecSync.mockReturnValueOnce('observations' as any);

    // SELECT from observations → 4 observations sharing keywords (swift guard let optional)
    const obsRows = [
      'Use guard let for swift optional|||use guard let when handling swift optional values|||swift guard optional',
      'guard let unwrapping pattern|||prefer guard let swift optional pattern in functions|||swift guard optional let',
      'swift optional binding|||always use guard let for swift optional early return|||guard let optional swift',
      'guard statement swift|||guard let is idiomatic swift optional handling|||swift optional guard let binding',
    ].join('\n');
    mockExecSync.mockReturnValueOnce(obsRows as any);

    // CREATE TABLE IF NOT EXISTS instincts (ensureInstinctsTable)
    mockExecSync.mockReturnValueOnce('' as any);

    // For each cluster, loadExistingInstinct → not found, then upsertInstinct INSERT
    // loadExistingInstinct SELECT → empty (no existing)
    mockExecSync.mockReturnValueOnce('' as any);
    // INSERT OR REPLACE → success
    mockExecSync.mockReturnValueOnce('' as any);

    const result = instinctExtract(TEST_DIR);

    expect(result.success).toBe(true);
    expect(result.extracted).toBeGreaterThan(0);
    expect(result.message).toContain('instinct');
  });

  test('updates existing instinct confidence on re-extract', () => {
    mockExistsSync.mockImplementation((p) => p.toString() === DB_PATH);

    // sqlite_master → observations exists
    mockExecSync.mockReturnValueOnce('observations' as any);

    // observations with shared keywords
    const obsRows = [
      'commit workflow step|||always run dev commit for git workflow commits|||git commit workflow',
      'dev commit flow|||use dev commit not raw git commit for workflow|||commit git workflow',
      'git workflow commit|||dev commit enforces workflow and git standards|||workflow git commit',
    ].join('\n');
    mockExecSync.mockReturnValueOnce(obsRows as any);

    // ensureInstinctsTable
    mockExecSync.mockReturnValueOnce('' as any);

    // loadExistingInstinct → existing instinct found
    const existingRow = 'commit-workflow|||when working with commit, workflow|||use dev commit not raw git commit (git-workflow, 3 evidence)|||0.6|||git-workflow|||session-observation|||3|||2026-01-01T00:00:00.000Z|||["prior example"]';
    mockExecSync.mockReturnValueOnce(existingRow as any);

    // INSERT OR REPLACE (upsert with updated confidence)
    mockExecSync.mockReturnValueOnce('' as any);

    const result = instinctExtract(TEST_DIR);

    expect(result.success).toBe(true);
    expect(result.extracted).toBe(1);
  });

  test('returns 0 extracted when observations do not cluster (fewer than 3 similar)', () => {
    mockExistsSync.mockImplementation((p) => p.toString() === DB_PATH);

    // sqlite_master → observations exists
    mockExecSync.mockReturnValueOnce('observations' as any);

    // Two observations with no shared keywords — cannot form cluster of 3
    const obsRows = [
      'something about typescript|||typescript generic types interface|||typescript type',
      'something about networking|||http api request fetch response|||network http',
    ].join('\n');
    mockExecSync.mockReturnValueOnce(obsRows as any);

    // ensureInstinctsTable
    mockExecSync.mockReturnValueOnce('' as any);

    const result = instinctExtract(TEST_DIR);

    expect(result.success).toBe(true);
    expect(result.extracted).toBe(0);
    expect(result.message).toContain('Not enough clustering');
  });
});

describe('instinctList', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  test('returns empty array when DB does not exist', () => {
    mockExistsSync.mockReturnValue(false);

    const result = instinctList(TEST_DIR);

    expect(result).toEqual([]);
  });

  test('returns empty array when no instincts are stored', () => {
    mockExistsSync.mockImplementation((p) => p.toString() === DB_PATH);

    // ensureInstinctsTable CREATE TABLE
    mockExecSync.mockReturnValueOnce('' as any);
    // SELECT instincts → empty
    mockExecSync.mockReturnValueOnce('' as any);

    const result = instinctList(TEST_DIR);

    expect(result).toEqual([]);
  });

  test('returns instincts sorted by confidence desc', () => {
    mockExistsSync.mockImplementation((p) => p.toString() === DB_PATH);

    // ensureInstinctsTable
    mockExecSync.mockReturnValueOnce('' as any);

    // SELECT returns 2 instincts
    const rows = [
      'guard-let|||when working with swift, optional|||Use guard-let over if-let for early returns|||0.9|||swift-style|||session-observation|||8|||2026-01-15T00:00:00.000Z|||["ex1","ex2"]',
      'dev-commit|||when working with commit, workflow|||Always use /dev commit|||0.7|||git-workflow|||session-observation|||5|||2026-01-10T00:00:00.000Z|||["ex3"]',
    ].join('\n');
    mockExecSync.mockReturnValueOnce(rows as any);

    const result = instinctList(TEST_DIR);

    expect(result).toHaveLength(2);
    expect(result[0].id).toBe('guard-let');
    expect(result[0].confidence).toBe(0.9);
    expect(result[0].domain).toBe('swift-style');
    expect(result[0].evidenceCount).toBe(8);
    expect(result[0].examples).toEqual(['ex1', 'ex2']);
    expect(result[1].id).toBe('dev-commit');
    expect(result[1].confidence).toBe(0.7);
  });

  test('filters by domain when domain is provided', () => {
    mockExistsSync.mockImplementation((p) => p.toString() === DB_PATH);

    // ensureInstinctsTable
    mockExecSync.mockReturnValueOnce('' as any);

    // SELECT with WHERE domain = 'swift-style'
    const rows = 'guard-let|||when working with swift, optional|||Use guard-let|||0.9|||swift-style|||session-observation|||8|||2026-01-15T00:00:00.000Z|||["ex1"]';
    mockExecSync.mockReturnValueOnce(rows as any);

    const result = instinctList(TEST_DIR, 'swift-style');

    expect(result).toHaveLength(1);
    expect(result[0].domain).toBe('swift-style');

    // Verify the SQL call included the domain filter
    const sqlCall = mockExecSync.mock.calls[1][0] as string;
    expect(sqlCall).toContain("WHERE domain = 'swift-style'");
  });

  test('returns empty array when execSync throws', () => {
    mockExistsSync.mockImplementation((p) => p.toString() === DB_PATH);

    // ensureInstinctsTable throws
    mockExecSync.mockImplementationOnce(() => { throw new Error('DB locked'); });
    // SELECT throws
    mockExecSync.mockImplementationOnce(() => { throw new Error('DB error'); });

    const result = instinctList(TEST_DIR);

    expect(result).toEqual([]);
  });

  test('handles malformed examples JSON gracefully', () => {
    mockExistsSync.mockImplementation((p) => p.toString() === DB_PATH);

    // ensureInstinctsTable
    mockExecSync.mockReturnValueOnce('' as any);

    // Row with malformed examples JSON
    const rows = 'some-instinct|||when working with foo|||Do foo thing|||0.5|||general|||session-observation|||2|||2026-01-01T00:00:00.000Z|||NOT_VALID_JSON';
    mockExecSync.mockReturnValueOnce(rows as any);

    const result = instinctList(TEST_DIR);

    expect(result).toHaveLength(1);
    expect(result[0].examples).toEqual([]);
  });
});
