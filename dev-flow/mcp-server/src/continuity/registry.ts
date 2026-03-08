/**
 * Context Registry — branch→ledger mapping
 * Replaces hardcoded filename matching with a JSON registry at .claude/state/context.json
 */

import { existsSync, readFileSync, writeFileSync, mkdirSync, readdirSync, statSync, renameSync } from 'fs';
import { join, dirname } from 'path';
import { execSync } from 'child_process';

const STATE_DIR = '.claude/state';
const REGISTRY_FILE = 'context.json';
const LEDGERS_DIR = 'thoughts/ledgers';

export interface BranchEntry {
  ledger: string;
  task_id?: string;
}

export interface Registry {
  version: number;
  branches: Record<string, BranchEntry>;
}

function registryPath(projectDir: string): string {
  return join(projectDir, STATE_DIR, REGISTRY_FILE);
}

function ensureStateDir(projectDir: string): void {
  const dir = join(projectDir, STATE_DIR);
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }
}

export function readRegistry(projectDir: string): Registry {
  const p = registryPath(projectDir);
  if (!existsSync(p)) {
    return { version: 1, branches: {} };
  }
  try {
    return JSON.parse(readFileSync(p, 'utf-8'));
  } catch {
    return { version: 1, branches: {} };
  }
}

export function writeRegistry(projectDir: string, data: Registry): void {
  ensureStateDir(projectDir);
  const p = registryPath(projectDir);
  const tmp = p + '.tmp.' + process.pid;
  writeFileSync(tmp, JSON.stringify(data, null, 2));
  renameSync(tmp, p);
}

export function registerBranch(projectDir: string, branch: string, ledgerPath: string, taskId?: string): void {
  const reg = readRegistry(projectDir);
  const entry: BranchEntry = { ledger: ledgerPath };
  if (taskId) entry.task_id = taskId;
  reg.branches[branch] = entry;
  writeRegistry(projectDir, reg);
}

export function unregisterBranch(projectDir: string, branch: string): void {
  const reg = readRegistry(projectDir);
  delete reg.branches[branch];
  writeRegistry(projectDir, reg);
}

function getCurrentBranch(): string {
  try {
    return execSync('git branch --show-current', { encoding: 'utf-8' }).trim();
  } catch {
    return '';
  }
}

export function lookupBranch(projectDir: string, branch?: string): BranchEntry | null {
  const b = branch || getCurrentBranch();
  if (!b) return null;
  const reg = readRegistry(projectDir);
  return reg.branches[b] || null;
}

/**
 * Fallback: scan thoughts/ledgers/*.md by mtime, return most recent.
 * Used when registry has no entry for current branch.
 */
export function fallbackLedgerScan(projectDir: string): string | null {
  const dir = join(projectDir, LEDGERS_DIR);
  if (!existsSync(dir)) return null;
  const files = readdirSync(dir)
    .filter(f => f.endsWith('.md') && !f.startsWith('.'))
    .map(f => ({ name: f, mtime: statSync(join(dir, f)).mtime.getTime() }))
    .sort((a, b) => b.mtime - a.mtime);
  return files.length > 0 ? join(LEDGERS_DIR, files[0].name) : null;
}
