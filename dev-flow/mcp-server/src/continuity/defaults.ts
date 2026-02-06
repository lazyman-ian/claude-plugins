/**
 * Smart Defaults Inference
 * Provides tools for inferring scope, labels, reviewers from code changes
 */

import { execSync } from 'child_process';
import { existsSync, readFileSync } from 'fs';
import { join } from 'path';

interface DefaultsResult {
  success: boolean;
  message: string;
  data?: any;
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

export function inferScope(files?: string[]): DefaultsResult {
  const changedFiles = files || getChangedFiles();

  if (changedFiles.length === 0) {
    return { success: false, message: 'No changes' };
  }

  // Count files per component
  const componentCounts: Record<string, number> = {};

  for (const file of changedFiles) {
    let component = '';

    // iOS/Swift patterns
    if (file.match(/^HouseSigma\/UI\//)) component = 'ui';
    else if (file.match(/^HouseSigma\/Network/)) component = 'network';
    else if (file.match(/^HouseSigma\/Model\//)) component = 'model';
    else if (file.match(/^HouseSigma\/Helper\//)) component = 'helper';
    else if (file.match(/^HouseSigma\/Router\//)) component = 'router';
    else if (file.match(/Auth|Login|Token/i)) component = 'auth';
    else if (file.match(/Home|Dashboard/i)) component = 'home';
    else if (file.match(/Search/i)) component = 'search';
    else if (file.match(/Map/i)) component = 'map';
    else if (file.match(/Property|Listing/i)) component = 'property';
    // Android patterns
    else if (file.match(/^app\/src\/main\/java\/.*\/ui\//)) component = 'ui';
    else if (file.match(/^app\/src\/main\/java\/.*\/network\//)) component = 'network';
    else if (file.match(/^app\/src\/main\/java\/.*\/data\//)) component = 'data';
    // Web patterns
    else if (file.match(/^src\/components\//)) component = 'components';
    else if (file.match(/^src\/pages\//)) component = 'pages';
    else if (file.match(/^src\/api\//)) component = 'api';
    else if (file.match(/^src\/hooks\//)) component = 'hooks';
    else if (file.match(/^src\/utils\//)) component = 'utils';
    // Config files
    else if (file.match(/^\.github\//)) component = 'ci';
    else if (file.match(/(package|Podfile|build\.gradle|Cargo)/)) component = 'deps';
    else if (file.match(/(README|CHANGELOG|\.md$)/)) component = 'docs';
    else if (file.match(/(test|spec|Test)/i)) component = 'test';

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
