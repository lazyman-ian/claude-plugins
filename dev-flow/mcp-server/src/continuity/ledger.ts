/**
 * Ledger Management for Continuity
 * Provides tools for managing task ledgers
 */

import { execSync } from 'child_process';
import { existsSync, readdirSync, readFileSync, writeFileSync, mkdirSync } from 'fs';
import { join, basename } from 'path';

const LEDGERS_DIR = 'thoughts/ledgers';
const ARCHIVE_DIR = 'thoughts/ledgers/archive';

interface LedgerInfo {
  name: string;
  path: string;
  taskId: string;
  updated: string;
  goal?: string;
  progress?: {
    done: number;
    inProgress: number;
    pending: number;
    total: number;
  };
  prUrl?: string;
}

interface LedgerResult {
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

function getTaskFromBranch(branch: string): string | null {
  const match = branch.match(/TASK-(\d+)/);
  return match ? `TASK-${match[1]}` : null;
}

function findActiveLedger(): LedgerInfo | null {
  const cwd = getCwd();
  const branch = getCurrentBranch();
  const taskId = getTaskFromBranch(branch);

  if (!taskId) return null;

  const ledgersPath = join(cwd, LEDGERS_DIR);
  if (!existsSync(ledgersPath)) return null;

  const files = readdirSync(ledgersPath).filter(f => f.startsWith(taskId) && f.endsWith('.md'));
  if (files.length === 0) return null;

  const ledgerPath = join(ledgersPath, files[0]);
  return parseLedger(ledgerPath);
}

function parseLedger(path: string): LedgerInfo {
  const content = readFileSync(path, 'utf-8');
  const name = basename(path, '.md');

  // Extract task ID
  const taskMatch = name.match(/TASK-\d+/);
  const taskId = taskMatch ? taskMatch[0] : '';

  // Extract updated timestamp
  const updatedMatch = content.match(/^Updated:\s*(.+)$/m);
  const updated = updatedMatch ? updatedMatch[1] : '';

  // Extract goal
  const goalMatch = content.match(/^## Goal\s*\n([\s\S]*?)(?=\n## |$)/m);
  const goal = goalMatch ? goalMatch[1].trim().split('\n')[0] : '';

  // Count checkboxes for progress
  const doneCount = (content.match(/\[x\]/gi) || []).length;
  const inProgressCount = (content.match(/\[→\]/g) || []).length;
  const pendingCount = (content.match(/\[ \]/g) || []).length;

  // Extract PR URL
  const prMatch = content.match(/https:\/\/github\.com\/[^\s)]+\/pull\/\d+/);
  const prUrl = prMatch ? prMatch[0] : undefined;

  return {
    name,
    path,
    taskId,
    updated,
    goal,
    progress: {
      done: doneCount,
      inProgress: inProgressCount,
      pending: pendingCount,
      total: doneCount + inProgressCount + pendingCount,
    },
    prUrl,
  };
}

/**
 * Get path to active ledger (for task-sync integration)
 */
export function getActiveLedgerPath(): string | null {
  const ledger = findActiveLedger();
  return ledger?.path || null;
}

export function ledgerStatus(): LedgerResult {
  const ledger = findActiveLedger();

  if (!ledger) {
    return {
      success: false,
      message: 'No active ledger',
    };
  }

  const p = ledger.progress!;
  const pct = p.total > 0 ? Math.round((p.done / p.total) * 100) : 0;

  return {
    success: true,
    message: `${ledger.taskId}|${pct}%|D:${p.done}|N:${p.inProgress}|P:${p.pending}`,
    data: ledger,
  };
}

export function ledgerList(): LedgerResult {
  const cwd = getCwd();
  const ledgersPath = join(cwd, LEDGERS_DIR);
  const archivePath = join(cwd, ARCHIVE_DIR);

  const active: string[] = [];
  const archived: string[] = [];

  if (existsSync(ledgersPath)) {
    active.push(...readdirSync(ledgersPath)
      .filter(f => f.endsWith('.md') && f.startsWith('TASK-')));
  }

  if (existsSync(archivePath)) {
    archived.push(...readdirSync(archivePath)
      .filter(f => f.endsWith('.md')));
  }

  return {
    success: true,
    message: `Active:${active.length}|Archived:${archived.length}`,
    data: { active, archived },
  };
}

export function ledgerCreate(taskId: string, branchName: string): LedgerResult {
  const cwd = getCwd();
  const ledgersPath = join(cwd, LEDGERS_DIR);

  if (!taskId.match(/^TASK-\d+$/)) {
    return { success: false, message: 'Invalid TASK format' };
  }

  // Extract description from branch name
  const desc = branchName
    .replace(/^(feature|fix|refactor|perf|test|docs|hotfix)\/TASK-\d+-/, '')
    .replace(/-/g, ' ')
    .replace(/\b\w/g, c => c.toUpperCase());

  const fileName = `${taskId}-${desc.replace(/\s+/g, '-')}.md`;
  const filePath = join(ledgersPath, fileName);

  if (existsSync(filePath)) {
    return { success: false, message: 'Ledger already exists' };
  }

  mkdirSync(ledgersPath, { recursive: true });

  const template = `# Session: ${taskId}-${desc.replace(/\s+/g, '-')}
Updated: ${new Date().toISOString()}

## Goal
${desc}

## Constraints
- 遵循项目规范
- 通过 make check 验证

## Key Decisions

## State
- Done:
  - [ ] 初始化
- Now:
  - [→] 开发功能
- Next:
  - [ ] 代码审查
  - [ ] 测试

## Open Questions

## Working Set
- Branch: \`${branchName}\`

## Development Notes
### ${new Date().toISOString().split('T')[0]}
- 🚀 Started: ${taskId}
`;

  writeFileSync(filePath, template);

  return {
    success: true,
    message: `Created:${fileName}`,
    data: { path: filePath, taskId },
  };
}

export function ledgerUpdate(commitHash: string, commitMessage: string): LedgerResult {
  const ledger = findActiveLedger();

  if (!ledger) {
    return { success: false, message: 'No active ledger' };
  }

  let content = readFileSync(ledger.path, 'utf-8');

  // Update timestamp
  content = content.replace(
    /^Updated:\s*.+$/m,
    `Updated: ${new Date().toISOString()}`
  );

  // Add commit to development notes
  const today = new Date().toISOString().split('T')[0];
  const commitNote = `- 📝 Commit: \`${commitHash.slice(0, 8)}\` - ${commitMessage}`;

  if (content.includes(`### ${today}`)) {
    content = content.replace(
      new RegExp(`(### ${today})`),
      `$1\n${commitNote}`
    );
  } else {
    content += `\n### ${today}\n${commitNote}\n`;
  }

  writeFileSync(ledger.path, content);

  return {
    success: true,
    message: `Updated:${ledger.taskId}`,
  };
}

export function ledgerAddPr(prUrl: string): LedgerResult {
  const ledger = findActiveLedger();

  if (!ledger) {
    return { success: false, message: 'No active ledger' };
  }

  let content = readFileSync(ledger.path, 'utf-8');

  // Add PR to Working Set
  if (!content.includes(prUrl)) {
    content = content.replace(
      /## Working Set/,
      `## Working Set\n- PR: ${prUrl}`
    );
    writeFileSync(ledger.path, content);
  }

  return {
    success: true,
    message: `PR added:${ledger.taskId}`,
  };
}

export function ledgerArchive(taskId?: string): LedgerResult {
  const cwd = getCwd();
  const ledgersPath = join(cwd, LEDGERS_DIR);
  const archivePath = join(cwd, ARCHIVE_DIR);

  let targetLedger: LedgerInfo | null = null;

  if (taskId) {
    // Find specific ledger
    if (existsSync(ledgersPath)) {
      const files = readdirSync(ledgersPath)
        .filter(f => f.startsWith(taskId) && f.endsWith('.md'));
      if (files.length > 0) {
        targetLedger = parseLedger(join(ledgersPath, files[0]));
      }
    }
  } else {
    targetLedger = findActiveLedger();
  }

  if (!targetLedger) {
    return { success: false, message: 'No ledger found' };
  }

  mkdirSync(archivePath, { recursive: true });

  const srcPath = targetLedger.path;
  const destPath = join(archivePath, basename(srcPath));

  try {
    const content = readFileSync(srcPath, 'utf-8');
    writeFileSync(destPath, content);
    execSync(`rm "${srcPath}"`);

    return {
      success: true,
      message: `Archived:${targetLedger.taskId}`,
    };
  } catch (error: any) {
    return { success: false, message: error.message };
  }
}

export function ledgerSearch(keyword: string): LedgerResult {
  const cwd = getCwd();
  const ledgersPath = join(cwd, LEDGERS_DIR);
  const archivePath = join(cwd, ARCHIVE_DIR);

  const matches: { name: string; context: string; archived: boolean }[] = [];

  const searchDir = (dir: string, archived: boolean) => {
    if (!existsSync(dir)) return;

    for (const file of readdirSync(dir)) {
      if (!file.endsWith('.md')) continue;

      const content = readFileSync(join(dir, file), 'utf-8');
      if (content.toLowerCase().includes(keyword.toLowerCase())) {
        const lineMatch = content.split('\n')
          .find(l => l.toLowerCase().includes(keyword.toLowerCase()));
        matches.push({
          name: file,
          context: lineMatch?.trim().slice(0, 80) || '',
          archived,
        });
      }
    }
  };

  searchDir(ledgersPath, false);
  searchDir(archivePath, true);

  return {
    success: true,
    message: `Found:${matches.length}`,
    data: matches,
  };
}
