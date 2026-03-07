/**
 * Smart Defaults Inference
 * Provides tools for inferring scope, labels, reviewers from code changes
 */

import { execSync } from 'child_process';
import { existsSync, readFileSync, readdirSync, statSync } from 'fs';
import { join, basename } from 'path';

interface DefaultsResult {
  success: boolean;
  message: string;
  data?: any;
}

interface DevFlowConfig {
  scopes?: string[];
  platform?: string;
  [key: string]: any;
}

function getCwd(): string {
  try {
    return execSync('git rev-parse --show-toplevel', { encoding: 'utf-8' }).trim();
  } catch {
    return process.cwd();
  }
}

function getCurrentBranch(): string {
  try {
    return execSync('git branch --show-current', { encoding: 'utf-8' }).trim();
  } catch {
    return '';
  }
}

function getChangedFiles(): string[] {
  const cwd = getCwd();
  try {
    // Get both staged and unstaged changes
    const staged = execSync('git diff --name-only --cached', { encoding: 'utf-8', cwd }).trim();
    const unstaged = execSync('git diff --name-only HEAD', { encoding: 'utf-8', cwd }).trim();
    const files = [...staged.split('\n'), ...unstaged.split('\n')].filter(f => f);
    return [...new Set(files)];
  } catch {
    return [];
  }
}

function loadDevFlowConfig(cwd: string): DevFlowConfig | null {
  const configPath = join(cwd, '.dev-flow.json');
  if (!existsSync(configPath)) return null;
  try {
    return JSON.parse(readFileSync(configPath, 'utf-8'));
  } catch {
    return null;
  }
}

/**
 * Get top-level directory candidates from the repo root.
 * Skips hidden dirs and common non-scope dirs (node_modules, dist, etc).
 */
function inferScopesFromDirectories(cwd: string): string[] {
  const skipDirs = new Set([
    'node_modules', 'dist', 'build', '.git', '.github', 'coverage',
    'tmp', 'temp', '.cache', 'vendor', '__pycache__',
  ]);
  try {
    return readdirSync(cwd)
      .filter(entry => {
        if (entry.startsWith('.')) return false;
        if (skipDirs.has(entry)) return false;
        try {
          return statSync(join(cwd, entry)).isDirectory();
        } catch {
          return false;
        }
      });
  } catch {
    return [];
  }
}

/**
 * Infer scope for a file path given a list of candidate scope names.
 * Matches by: file path prefix, generic keyword patterns, file type.
 */
function matchScope(file: string, candidates: string[]): string {
  // Candidate prefix match (longest prefix wins)
  const fileNorm = file.toLowerCase();
  let bestScope = '';
  let bestLen = 0;
  for (const scope of candidates) {
    const scopeNorm = scope.toLowerCase();
    if (fileNorm.startsWith(scopeNorm + '/') && scopeNorm.length > bestLen) {
      bestLen = scopeNorm.length;
      bestScope = scope;
    }
  }
  if (bestScope) return bestScope;

  // Generic keyword-based patterns (platform-agnostic)
  if (file.match(/Auth|Login|Token/i)) return 'auth';
  if (file.match(/(test|spec)/i)) return 'test';
  if (file.match(/^\.github\//)) return 'ci';
  if (file.match(/(package|Podfile|build\.gradle|Cargo|requirements|pyproject)/)) return 'deps';
  if (file.match(/(README|CHANGELOG|\.md$)/)) return 'docs';

  // Match against scope names as keywords anywhere in path
  for (const scope of candidates) {
    const scopeNorm = scope.toLowerCase();
    if (fileNorm.includes('/' + scopeNorm + '/') || fileNorm.includes('/' + scopeNorm + '.')) {
      return scope;
    }
  }

  return '';
}

export function inferScope(files?: string[]): DefaultsResult {
  const changedFiles = files || getChangedFiles();

  if (changedFiles.length === 0) {
    return { success: false, message: 'No changes' };
  }

  const cwd = getCwd();
  const config = loadDevFlowConfig(cwd);

  // Primary: use scopes from .dev-flow.json
  // Fallback: infer from directory structure
  const scopeCandidates: string[] =
    (config?.scopes && config.scopes.length > 0)
      ? config.scopes
      : inferScopesFromDirectories(cwd);

  // Count files per component
  const componentCounts: Record<string, number> = {};

  for (const file of changedFiles) {
    const component = matchScope(file, scopeCandidates);
    if (component) {
      componentCounts[component] = (componentCounts[component] || 0) + 1;
    }
  }

  // Find most common component
  let bestScope = '';
  let maxCount = 0;

  for (const [scope, count] of Object.entries(componentCounts)) {
    if (count > maxCount) {
      maxCount = count;
      bestScope = scope;
    }
  }

  return {
    success: true,
    message: bestScope || 'general',
    data: { scope: bestScope || 'general', counts: componentCounts },
  };
}

export function inferLabels(): DefaultsResult {
  const branch = getCurrentBranch();
  const files = getChangedFiles();
  const labels: string[] = [];

  // From branch prefix
  if (branch.startsWith('feature/')) labels.push('enhancement');
  else if (branch.startsWith('fix/') || branch.startsWith('bugfix/')) labels.push('bug');
  else if (branch.startsWith('hotfix/')) labels.push('bug', 'priority:high');
  else if (branch.startsWith('refactor/')) labels.push('refactor');
  else if (branch.startsWith('perf/')) labels.push('performance');
  else if (branch.startsWith('docs/')) labels.push('documentation');
  else if (branch.startsWith('test/')) labels.push('testing');

  // From file types
  const hasDoc = files.some(f => f.match(/\.(md|txt|rst)$/));
  const hasTest = files.some(f => f.match(/(test|spec)/i));
  const hasCI = files.some(f => f.match(/^\.github\//));

  if (hasDoc && !labels.includes('documentation')) labels.push('documentation');
  if (hasTest && !labels.includes('testing')) labels.push('testing');
  if (hasCI) labels.push('ci');

  return {
    success: true,
    message: labels.join(',') || 'none',
    data: { labels },
  };
}

export function inferReviewers(): DefaultsResult {
  const cwd = getCwd();
  const files = getChangedFiles();
  const reviewers: string[] = [];

  // Check CODEOWNERS
  const codeownersPaths = ['.github/CODEOWNERS', 'CODEOWNERS', 'docs/CODEOWNERS'];

  for (const coPath of codeownersPaths) {
    const fullPath = join(cwd, coPath);
    if (existsSync(fullPath)) {
      const content = readFileSync(fullPath, 'utf-8');
      const lines = content.split('\n').filter(l => l && !l.startsWith('#'));

      for (const file of files) {
        for (const line of lines) {
          const [pattern, ...owners] = line.trim().split(/\s+/);
          if (!pattern || !owners.length) continue;

          // Simple pattern matching (basic glob)
          const regex = new RegExp(
            '^' + pattern.replace(/\*/g, '.*').replace(/\?/g, '.') + '$'
          );

          if (regex.test(file) || file.startsWith(pattern.replace('*', ''))) {
            for (const owner of owners) {
              const clean = owner.replace('@', '');
              if (!reviewers.includes(clean)) {
                reviewers.push(clean);
              }
            }
          }
        }
      }
      break;
    }
  }

  // Fallback: get from git history
  if (reviewers.length === 0 && files.length > 0) {
    try {
      for (const file of files.slice(0, 3)) {
        const author = execSync(`git log -1 --format="%an" -- "${file}"`, {
          encoding: 'utf-8',
          cwd,
        }).trim();
        if (author && !reviewers.includes(author)) {
          reviewers.push(author);
        }
      }
    } catch {
      // Ignore
    }
  }

  return {
    success: true,
    message: reviewers.join(',') || 'none',
    data: { reviewers },
  };
}

export function inferWorkingSet(): DefaultsResult {
  const branch = getCurrentBranch();
  const files = getChangedFiles();

  const staged = execSync('git diff --name-only --cached', { encoding: 'utf-8' })
    .trim().split('\n').filter(f => f);
  const unstaged = execSync('git diff --name-only', { encoding: 'utf-8' })
    .trim().split('\n').filter(f => f);

  return {
    success: true,
    message: `branch:${branch}|staged:${staged.length}|unstaged:${unstaged.length}`,
    data: {
      branch,
      staged,
      unstaged,
      total: files.length,
    },
  };
}

export function inferAll(): DefaultsResult {
  const scope = inferScope();
  const labels = inferLabels();
  const reviewers = inferReviewers();
  const workingSet = inferWorkingSet();

  return {
    success: true,
    message: `scope:${scope.message}|labels:${labels.message}`,
    data: {
      scope: scope.data,
      labels: labels.data,
      reviewers: reviewers.data,
      workingSet: workingSet.data,
    },
  };
}
