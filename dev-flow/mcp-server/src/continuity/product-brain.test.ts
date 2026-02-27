/**
 * Product Brain module tests
 */

import * as childProcess from 'child_process';
import * as fs from 'fs';
import { productExtract, productQuery, productSave, productWriteTopicFiles } from './product-brain';

vi.mock('child_process');
vi.mock('fs');

const mockExecSync = vi.mocked(childProcess.execSync);
const mockExistsSync = vi.mocked(fs.existsSync);
const mockMkdirSync = vi.mocked(fs.mkdirSync);
const mockWriteFileSync = vi.mocked(fs.writeFileSync);

const TEST_DIR = '/test/project';
const DB_PATH = `${TEST_DIR}/.claude/cache/artifact-index/context.db`;

describe('productQuery', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  test('returns empty array when DB does not exist', () => {
    mockExistsSync.mockReturnValue(false);

    const result = productQuery(TEST_DIR, {});

    expect(result).toEqual([]);
  });

  test('returns empty array when DB has no entries', () => {
    mockExistsSync.mockImplementation((p) => p.toString() === DB_PATH);
    // ensureProductBrainTable CREATE TABLE
    mockExecSync.mockReturnValueOnce('' as any);
    // SELECT → empty
    mockExecSync.mockReturnValueOnce('' as any);

    const result = productQuery(TEST_DIR, {});

    expect(result).toEqual([]);
  });

  test('returns entries filtered by domain', () => {
    mockExistsSync.mockImplementation((p) => p.toString() === DB_PATH);

    // ensureProductBrainTable
    mockExecSync.mockReturnValueOnce('' as any);

    // SELECT with domain filter
    const rows = [
      'pb-abc|||ios|||authentication|||Login flow implementation|||Uses JWT tokens for session|||feat: add login|||2026-02-01T00:00:00.000Z|||2026-02-01T00:00:00.000Z',
    ].join('\n');
    mockExecSync.mockReturnValueOnce(rows as any);

    const result = productQuery(TEST_DIR, { domain: 'ios' });

    expect(result).toHaveLength(1);
    expect(result[0].domain).toBe('ios');
    expect(result[0].topic).toBe('authentication');
    expect(result[0].title).toBe('Login flow implementation');

    const sqlCall = mockExecSync.mock.calls[1][0] as string;
    expect(sqlCall).toContain("domain = 'ios'");
  });

  test('returns entries filtered by topic', () => {
    mockExistsSync.mockImplementation((p) => p.toString() === DB_PATH);

    // ensureProductBrainTable
    mockExecSync.mockReturnValueOnce('' as any);

    // SELECT with topic filter
    const rows = 'pb-def|||android|||navigation|||NavGraph setup|||Uses NavHost with nested graphs|||feat: add nav|||2026-02-02T00:00:00.000Z|||2026-02-02T00:00:00.000Z';
    mockExecSync.mockReturnValueOnce(rows as any);

    const result = productQuery(TEST_DIR, { topic: 'navigation' });

    expect(result).toHaveLength(1);
    expect(result[0].topic).toBe('navigation');

    const sqlCall = mockExecSync.mock.calls[1][0] as string;
    expect(sqlCall).toContain("topic = 'navigation'");
  });

  test('returns entries filtered by query string', () => {
    mockExistsSync.mockImplementation((p) => p.toString() === DB_PATH);

    // ensureProductBrainTable
    mockExecSync.mockReturnValueOnce('' as any);

    // SELECT with LIKE query
    const rows = 'pb-ghi|||web|||ui|||Dark mode toggle|||Theme switching with CSS variables|||feat: dark mode|||2026-02-03T00:00:00.000Z|||2026-02-03T00:00:00.000Z';
    mockExecSync.mockReturnValueOnce(rows as any);

    const result = productQuery(TEST_DIR, { query: 'dark mode' });

    expect(result).toHaveLength(1);
    expect(result[0].title).toBe('Dark mode toggle');

    const sqlCall = mockExecSync.mock.calls[1][0] as string;
    expect(sqlCall).toContain("LIKE '%dark mode%'");
  });

  test('combines domain and topic filters', () => {
    mockExistsSync.mockImplementation((p) => p.toString() === DB_PATH);

    // ensureProductBrainTable
    mockExecSync.mockReturnValueOnce('' as any);
    // SELECT
    mockExecSync.mockReturnValueOnce('' as any);

    productQuery(TEST_DIR, { domain: 'ios', topic: 'networking' });

    const sqlCall = mockExecSync.mock.calls[1][0] as string;
    expect(sqlCall).toContain("domain = 'ios'");
    expect(sqlCall).toContain("topic = 'networking'");
  });

  test('handles malformed rows gracefully', () => {
    mockExistsSync.mockImplementation((p) => p.toString() === DB_PATH);

    // ensureProductBrainTable
    mockExecSync.mockReturnValueOnce('' as any);

    // Row with missing fields (only empty string for id → filtered out)
    mockExecSync.mockReturnValueOnce('\n\n' as any);

    const result = productQuery(TEST_DIR, {});

    expect(result).toEqual([]);
  });
});

describe('productSave', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mockMkdirSync.mockReturnValue(undefined as any);
    mockExistsSync.mockReturnValue(false);
  });

  test('creates entry and returns an ID', () => {
    // ensureProductBrainTable CREATE TABLE
    mockExecSync.mockReturnValueOnce('' as any);
    // INSERT
    mockExecSync.mockReturnValueOnce('' as any);

    const id = productSave(TEST_DIR, {
      domain: 'ios',
      topic: 'authentication',
      title: 'JWT token refresh pattern',
      content: 'Tokens are refreshed silently before expiry using a background timer.',
      source: 'feat: add token refresh',
    });

    expect(id).toMatch(/^pb-/);
    expect(id.length).toBeGreaterThan(5);
  });

  test('escapes SQL injection in content', () => {
    // ensureProductBrainTable
    mockExecSync.mockReturnValueOnce('' as any);
    // INSERT
    mockExecSync.mockReturnValueOnce('' as any);

    productSave(TEST_DIR, {
      domain: 'shared',
      topic: 'general',
      title: "It's a test",
      content: "Content with 'single quotes' and special chars",
      source: "feat: it's done",
    });

    // The INSERT SQL should have escaped single quotes
    const insertCall = mockExecSync.mock.calls[1][0] as string;
    expect(insertCall).toContain("It''s a test");
  });

  test('returns unique IDs on multiple saves', () => {
    mockExecSync.mockReturnValue('' as any);

    const id1 = productSave(TEST_DIR, { domain: 'ios', topic: 't1', title: 'T1', content: 'C1', source: 'S1' });
    const id2 = productSave(TEST_DIR, { domain: 'ios', topic: 't2', title: 'T2', content: 'C2', source: 'S2' });

    expect(id1).not.toBe(id2);
  });
});

describe('productExtract', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mockMkdirSync.mockReturnValue(undefined as any);
    mockExistsSync.mockReturnValue(false);
  });

  test('returns empty array when no git history', () => {
    // ensureProductBrainTable
    mockExecSync.mockReturnValueOnce('' as any);
    // git log throws
    mockExecSync.mockImplementationOnce(() => { throw new Error('not a git repo'); });

    const result = productExtract(TEST_DIR);

    expect(result).toEqual([]);
  });

  test('returns empty array when git log returns empty', () => {
    // ensureProductBrainTable
    mockExecSync.mockReturnValueOnce('' as any);
    // git log returns empty
    mockExecSync.mockReturnValueOnce('' as any);

    const result = productExtract(TEST_DIR);

    expect(result).toEqual([]);
  });

  test('extracts entries from git log with iOS files', () => {
    // ensureProductBrainTable
    mockExecSync.mockReturnValueOnce('' as any);

    // git log with iOS files
    const gitLog = [
      'abc1234 feat: add JWT authentication',
      'Sources/Auth/LoginViewController.swift',
      'Sources/Auth/TokenManager.swift',
    ].join('\n');
    mockExecSync.mockReturnValueOnce(gitLog as any);

    const result = productExtract(TEST_DIR);

    expect(result.length).toBeGreaterThan(0);
    expect(result[0].domain).toBe('ios');
    expect(result[0].topic).toBe('authentication');
  });

  test('extracts entries from git log with Android files', () => {
    // ensureProductBrainTable
    mockExecSync.mockReturnValueOnce('' as any);

    const gitLog = [
      'def5678 feat: add navigation graph',
      'app/src/main/res/navigation/nav_graph.kt',
    ].join('\n');
    mockExecSync.mockReturnValueOnce(gitLog as any);

    const result = productExtract(TEST_DIR);

    expect(result.length).toBeGreaterThan(0);
    const androidEntry = result.find(e => e.domain === 'android');
    expect(androidEntry).toBeDefined();
  });

  test('reads spec file when specPath is provided', () => {
    // ensureProductBrainTable
    mockExecSync.mockReturnValueOnce('' as any);

    const gitLog = 'abc1234 feat: implement feature\nSources/Feature.swift';
    mockExecSync.mockReturnValueOnce(gitLog as any);

    // spec file exists
    mockExistsSync.mockImplementation((p) => p.toString() === '/test/spec.md');
    // head -50 spec file
    mockExecSync.mockReturnValueOnce('# Spec\nThis is the spec context.' as any);

    const result = productExtract(TEST_DIR, '/test/spec.md');

    expect(result.length).toBeGreaterThan(0);
    expect(result[0].content).toContain('Spec context');
  });

  test('handles multiple domains from a single commit', () => {
    // ensureProductBrainTable
    mockExecSync.mockReturnValueOnce('' as any);

    const gitLog = [
      'abc1234 feat: cross-platform auth',
      'ios/Sources/Auth/Login.swift',
      'android/app/src/main/kotlin/Auth.kt',
      'web/src/auth/Login.tsx',
    ].join('\n');
    mockExecSync.mockReturnValueOnce(gitLog as any);

    const result = productExtract(TEST_DIR);

    const domains = result.map(e => e.domain);
    expect(domains).toContain('ios');
    expect(domains).toContain('android');
    expect(domains).toContain('web');
  });
});

describe('productWriteTopicFiles', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mockWriteFileSync.mockReturnValue(undefined);
    mockMkdirSync.mockReturnValue(undefined as any);
  });

  test('does nothing when DB does not exist', () => {
    mockExistsSync.mockReturnValue(false);

    productWriteTopicFiles(TEST_DIR);

    expect(mockWriteFileSync).not.toHaveBeenCalled();
  });

  test('does nothing when Auto Memory dir does not exist', () => {
    // DB exists but memory dir does not
    mockExistsSync.mockImplementation((p) => {
      const ps = p.toString();
      return ps === DB_PATH;
    });

    // DISTINCT domains query
    mockExecSync.mockReturnValueOnce('ios' as any);

    productWriteTopicFiles(TEST_DIR);

    expect(mockWriteFileSync).not.toHaveBeenCalled();
  });

  test('writes topic files when DB and memory dir exist', () => {
    const escapedPath = TEST_DIR.replace(/\//g, '-').replace(/^-/, '');
    const memDir = `${require('os').homedir()}/.claude/projects/${escapedPath}/memory`;

    mockExistsSync.mockImplementation((p) => {
      const ps = p.toString();
      return ps === DB_PATH || ps === memDir;
    });

    // DISTINCT domains → ios
    mockExecSync.mockReturnValueOnce('ios' as any);
    // SELECT entries for ios domain
    const rows = 'authentication|||Login flow|||JWT tokens used for session management|||feat: add login|||2026-02-01T00:00:00.000Z';
    mockExecSync.mockReturnValueOnce(rows as any);

    productWriteTopicFiles(TEST_DIR);

    expect(mockWriteFileSync).toHaveBeenCalledOnce();
    const [filePath, content] = mockWriteFileSync.mock.calls[0];
    expect(filePath.toString()).toContain('product-ios.md');
    expect(content.toString()).toContain('# Product Knowledge: Ios');
    expect(content.toString()).toContain('authentication');
  });

  test('handles write errors gracefully', () => {
    const escapedPath = TEST_DIR.replace(/\//g, '-').replace(/^-/, '');
    const memDir = `${require('os').homedir()}/.claude/projects/${escapedPath}/memory`;

    mockExistsSync.mockImplementation((p) => {
      const ps = p.toString();
      return ps === DB_PATH || ps === memDir;
    });

    // DISTINCT domains → web
    mockExecSync.mockReturnValueOnce('web' as any);
    // Entries for web
    mockExecSync.mockReturnValueOnce('ui|||Dark mode|||CSS variables|||feat: dark|||2026-02-01T00:00:00.000Z' as any);

    // writeFileSync throws
    mockWriteFileSync.mockImplementationOnce(() => { throw new Error('ENOENT'); });

    // Should not throw
    expect(() => productWriteTopicFiles(TEST_DIR)).not.toThrow();
  });

  test('handles multiple domains by writing separate files', () => {
    const escapedPath = TEST_DIR.replace(/\//g, '-').replace(/^-/, '');
    const memDir = `${require('os').homedir()}/.claude/projects/${escapedPath}/memory`;

    mockExistsSync.mockImplementation((p) => {
      const ps = p.toString();
      return ps === DB_PATH || ps === memDir;
    });

    // DISTINCT domains → ios\nandroid
    mockExecSync.mockReturnValueOnce('ios\nandroid' as any);
    // Entries for ios
    mockExecSync.mockReturnValueOnce('authentication|||Login|||JWT|||feat: auth|||2026-02-01T00:00:00.000Z' as any);
    // Entries for android
    mockExecSync.mockReturnValueOnce('navigation|||NavGraph|||NavHost setup|||feat: nav|||2026-02-01T00:00:00.000Z' as any);

    productWriteTopicFiles(TEST_DIR);

    expect(mockWriteFileSync).toHaveBeenCalledTimes(2);
    const paths = mockWriteFileSync.mock.calls.map(c => c[0].toString());
    expect(paths.some(p => p.includes('product-ios.md'))).toBe(true);
    expect(paths.some(p => p.includes('product-android.md'))).toBe(true);
  });
});

describe('error handling', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mockMkdirSync.mockReturnValue(undefined as any);
  });

  test('productQuery returns empty on DB error', () => {
    mockExistsSync.mockImplementation((p) => p.toString() === DB_PATH);
    // ensureProductBrainTable throws
    mockExecSync.mockImplementationOnce(() => { throw new Error('DB locked'); });
    // SELECT throws
    mockExecSync.mockImplementationOnce(() => { throw new Error('DB error'); });

    const result = productQuery(TEST_DIR, { domain: 'ios' });

    expect(result).toEqual([]);
  });

  test('productSave does not throw on DB error', () => {
    mockExistsSync.mockReturnValue(false);
    // ensureProductBrainTable throws
    mockExecSync.mockImplementationOnce(() => { throw new Error('DB error'); });
    // INSERT throws
    mockExecSync.mockImplementationOnce(() => { throw new Error('DB error'); });

    expect(() => {
      productSave(TEST_DIR, {
        domain: 'ios',
        topic: 'auth',
        title: 'Test',
        content: 'Content',
        source: 'manual',
      });
    }).not.toThrow();
  });
});
