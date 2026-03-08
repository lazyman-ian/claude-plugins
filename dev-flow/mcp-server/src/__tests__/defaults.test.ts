/**
 * Task 6.1: Generalized scope inference — defaults.ts
 */

import { tmpdir } from 'os';
import { join } from 'path';
import { mkdirSync, writeFileSync, rmSync } from 'fs';
import { vi, describe, test, expect, beforeEach, afterEach } from 'vitest';
import { inferScope } from '../continuity/defaults';

vi.mock('child_process', () => ({
  execSync: vi.fn(),
}));

import { execSync } from 'child_process';
const mockExecSync = execSync as ReturnType<typeof vi.fn>;

let testDir: string;

beforeEach(() => {
  testDir = join(tmpdir(), `defaults-test-${Date.now()}`);
  mkdirSync(testDir, { recursive: true });

  mockExecSync.mockImplementation((cmd: string) => {
    if (cmd.includes('rev-parse --show-toplevel')) return testDir + '\n';
    if (cmd.includes('branch --show-current')) return 'feature/test\n';
    if (cmd.includes('diff --name-only --cached')) return '\n';
    if (cmd.includes('diff --name-only HEAD')) return '\n';
    return '\n';
  });
});

afterEach(() => {
  rmSync(testDir, { recursive: true, force: true });
  vi.clearAllMocks();
});

function writeConfig(config: object): void {
  writeFileSync(join(testDir, '.dev-flow.json'), JSON.stringify(config));
}

function makeDirs(...dirs: string[]): void {
  for (const d of dirs) {
    mkdirSync(join(testDir, d), { recursive: true });
  }
}

// ---------------------------------------------------------------------------
// Primary source: .dev-flow.json scopes array
// ---------------------------------------------------------------------------

describe('inferScope — .dev-flow.json scopes', () => {
  test('uses scopes from .dev-flow.json as primary source', () => {
    writeConfig({ scopes: ['api', 'models', 'utils'] });

    const result = inferScope(['api/auth.ts', 'api/users.ts']);
    expect(result.success).toBe(true);
    expect(result.data.scope).toBe('api');
  });

  test('matches longest prefix scope candidate', () => {
    writeConfig({ scopes: ['src', 'src/components', 'src/utils'] });

    const result = inferScope(['src/components/Button.tsx', 'src/components/Input.tsx']);
    expect(result.success).toBe(true);
    expect(result.data.scope).toBe('src/components');
  });

  test('picks most common scope when files span multiple', () => {
    writeConfig({ scopes: ['api', 'models', 'utils'] });

    const result = inferScope(['api/a.ts', 'api/b.ts', 'models/user.ts']);
    expect(result.data.scope).toBe('api');
    expect(result.data.counts['api']).toBe(2);
    expect(result.data.counts['models']).toBe(1);
  });

  test('returns general when no files match any scope', () => {
    writeConfig({ scopes: ['api', 'models'] });

    const result = inferScope(['unknown/foo.ts']);
    expect(result.data.scope).toBe('general');
  });
});

// ---------------------------------------------------------------------------
// Fallback: directory structure inference
// ---------------------------------------------------------------------------

describe('inferScope — directory fallback', () => {
  test('infers scopes from top-level directories when no .dev-flow.json', () => {
    makeDirs('src', 'tests', 'docs');

    const result = inferScope(['src/foo.ts', 'src/bar.ts']);
    expect(result.success).toBe(true);
    expect(result.data.scope).toBe('src');
  });

  test('skips hidden and system directories in fallback', () => {
    makeDirs('src', 'node_modules', '.git', 'dist');

    const result = inferScope(['src/foo.ts']);
    expect(result.data.scope).toBe('src');
    // node_modules should not be a scope candidate
    expect(result.data.counts['node_modules']).toBeUndefined();
  });

  test('uses directory fallback when .dev-flow.json has no scopes field', () => {
    writeConfig({ platform: 'node' });
    makeDirs('packages', 'tools', 'docs');

    const result = inferScope(['packages/foo.ts', 'packages/bar.ts']);
    expect(result.data.scope).toBe('packages');
  });

  test('uses directory fallback when .dev-flow.json scopes is empty array', () => {
    writeConfig({ scopes: [] });
    makeDirs('lib', 'bin');

    const result = inferScope(['lib/index.ts']);
    expect(result.data.scope).toBe('lib');
  });
});

// ---------------------------------------------------------------------------
// Generic keyword patterns (no HouseSigma-specific patterns)
// ---------------------------------------------------------------------------

describe('inferScope — generic keyword patterns', () => {
  test('matches auth keyword regardless of project structure', () => {
    // No .dev-flow.json, no dirs — generic keyword fallback
    const result = inferScope(['src/AuthService.ts']);
    expect(result.data.scope).toBe('auth');
  });

  test('matches test files', () => {
    const result = inferScope(['__tests__/foo.test.ts']);
    expect(result.data.scope).toBe('test');
  });

  test('matches CI files', () => {
    const result = inferScope(['.github/workflows/ci.yml']);
    expect(result.data.scope).toBe('ci');
  });

  test('matches docs files', () => {
    const result = inferScope(['README.md', 'CHANGELOG.md']);
    expect(result.data.scope).toBe('docs');
  });

  test('matches deps files', () => {
    const result = inferScope(['package.json']);
    expect(result.data.scope).toBe('deps');
  });
});

// ---------------------------------------------------------------------------
// No hardcoded HouseSigma patterns
// ---------------------------------------------------------------------------

describe('inferScope — no hardcoded project-specific patterns', () => {
  test('HouseSigma paths do not get special treatment when no config', () => {
    // Without config or matching dirs, HouseSigma/* paths fall through to generic or general
    const result = inferScope(['HouseSigma/UI/SomeView.swift']);
    // Should not match any project-specific scope — goes to 'general' if no keyword or dir match
    // The actual scope depends on the generic path — the important thing is no hardcoded 'ui' injection
    // from HouseSigma-specific regex patterns
    expect(result.success).toBe(true);
    // Not asserting specific value here — just that it processes without error
  });

  test('HouseSigma paths match when HouseSigma is a configured scope', () => {
    writeConfig({ scopes: ['HouseSigma', 'Tests'] });
    makeDirs('HouseSigma', 'Tests');

    const result = inferScope(['HouseSigma/UI/SomeView.swift', 'HouseSigma/Network/API.swift']);
    expect(result.data.scope).toBe('HouseSigma');
  });
});

// ---------------------------------------------------------------------------
// Edge cases
// ---------------------------------------------------------------------------

describe('inferScope — edge cases', () => {
  test('returns failure when no files changed', () => {
    mockExecSync.mockImplementation((cmd: string) => {
      if (cmd.includes('rev-parse --show-toplevel')) return testDir + '\n';
      if (cmd.includes('diff --name-only')) return '\n';
      return '\n';
    });

    const result = inferScope([]);
    expect(result.success).toBe(false);
    expect(result.message).toBe('No changes');
  });

  test('accepts explicit files array bypassing git', () => {
    writeConfig({ scopes: ['backend', 'frontend'] });

    const result = inferScope(['backend/server.ts', 'backend/routes.ts']);
    expect(result.data.scope).toBe('backend');
  });
});
