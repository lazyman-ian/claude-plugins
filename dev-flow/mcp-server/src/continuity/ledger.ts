/**
 * Ledger Management for Continuity
 * Provides tools for managing task ledgers
 */

import { execSync } from 'child_process';
import { existsSync, readdirSync, readFileSync, writeFileSync, mkdirSync, statSync } from 'fs';
import { join, basename } from 'path';
import type { GateRecord, DecisionRecord, LedgerTaskEntry } from './ledger-types';

const LEDGERS_DIR = 'thoughts/ledgers';
const ARCHIVE_DIR = 'thoughts/ledgers/archive';

// Re-export types for consumers
export type { GateRecord, DecisionRecord, LedgerTaskEntry } from './ledger-types';

/**
 * Parse gate notation from a v2 ledger gates line.
 * Format: `  gates: self:pass spec:pass quality:pass(P2x1) verify:pass`
 * Parenthesized suffixes are opaque — we do NOT split on colons inside parens.
 */
export function parseGateLine(line: string): GateRecord[] {
  const records: GateRecord[] = [];
  // Strip leading "gates:" label
  const raw = line.replace(/^\s*gates:\s*/, '');
  if (!raw.trim()) return records;

  // Tokenise: split on whitespace BUT preserve paren-enclosed content
  // We split on spaces that are NOT inside parentheses
  const tokens: string[] = [];
  let current = '';
  let depth = 0;
  for (const ch of raw.trim()) {
    if (ch === '(') { depth++; current += ch; }
    else if (ch === ')') { depth--; current += ch; }
    else if (ch === ' ' && depth === 0) {
      if (current) { tokens.push(current); current = ''; }
    } else {
      current += ch;
    }
  }
  if (current) tokens.push(current);

  for (const token of tokens) {
    // Find first colon that is NOT inside parentheses
    let colonIdx = -1;
    let depth = 0;
    for (let i = 0; i < token.length; i++) {
      if (token[i] === '(') depth++;
      else if (token[i] === ')') depth--;
      else if (token[i] === ':' && depth === 0) { colonIdx = i; break; }
    }
    if (colonIdx === -1) continue;

    const gate = token.slice(0, colonIdx);
    const rest = token.slice(colonIdx + 1);

    // result may be `pass`, `fail`, `skip`, `fail>pass`, etc.
    // detail is everything inside trailing parens
    const detailMatch = rest.match(/\(([^)]*)\)$/);
    const detail = detailMatch ? detailMatch[1] : undefined;
    const resultRaw = rest.replace(/\([^)]*\)$/, '');
    // Normalize result: take last segment after `>` (e.g. `fail>pass` → `pass`)
    const resultSegments = resultRaw.split('>');
    const resultStr = resultSegments[resultSegments.length - 1];
    const result: GateRecord['result'] =
      resultStr === 'pass' ? 'pass' : resultStr === 'skip' ? 'skip' : 'fail';

    records.push({ gate, result, ...(detail !== undefined ? { detail } : {}) });
  }
  return records;
}

/**
 * Parse ## State section of a ledger, supporting both v1 and v2 formats.
 * v2 entries have structured gate/retry lines beneath them.
 * v1 entries are simple checkbox lines.
 */
export function parseLedgerV2(content: string): LedgerTaskEntry[] {
  const entries: LedgerTaskEntry[] = [];

  const stateMatch = content.match(/## State\s*\n([\s\S]*?)(?=\n## |\n# |$)/);
  if (!stateMatch) return entries;

  const stateBlock = stateMatch[1];
  const lines = stateBlock.split('\n');

  let current: LedgerTaskEntry | null = null;

  for (const line of lines) {
    // v2 task line: `- [x] id: name (timestamp, dur)` or `- [→] ...` or `- [->] ...` or `- [ ] ...`
    // v1 task line: `- Done: [x] subject (time)` or plain `- [x] subject`
    const taskMatch = line.match(/^- \[(x|→|->| )\]\s+(.+)$/);
    if (taskMatch) {
      if (current) entries.push(current);

      const marker = taskMatch[1];
      const rest = taskMatch[2];

      // Determine status
      const status: LedgerTaskEntry['status'] =
        marker === 'x' ? 'done' : (marker === '→' || marker === '->') ? 'in_progress' : 'pending';

      // Extract id: name if present — id is a dotted number prefix before colon
      // but NOT a colon inside parens
      const idNameMatch = rest.match(/^(\d+(?:\.\d+)*(?:-\d+)?)\s*:\s*(.+)$/);
      let id: string;
      let name: string;
      let timestamp: string | undefined;

      if (idNameMatch) {
        id = idNameMatch[1];
        const nameAndMeta = idNameMatch[2];
        // Strip trailing (timestamp, duration) — must be last paren group
        const metaMatch = nameAndMeta.match(/^(.*?)\s*\(([^)]+)\)\s*$/);
        if (metaMatch) {
          name = metaMatch[1].trim();
          timestamp = metaMatch[2];
        } else {
          name = nameAndMeta.trim();
        }
      } else {
        // v1 fallback: whole rest is the name
        id = '';
        const metaMatch = rest.match(/^(.*?)\s*\(([^)]+)\)\s*$/);
        if (metaMatch) {
          name = metaMatch[1].trim();
          timestamp = metaMatch[2];
        } else {
          name = rest.trim();
        }
      }

      current = { id, name, status, ...(timestamp !== undefined ? { timestamp } : {}) };
      continue;
    }

    if (!current) continue;

    // Gates line
    if (/^\s+gates:\s/.test(line)) {
      current.gates = parseGateLine(line);
      continue;
    }

    // Retries line
    const retriesMatch = line.match(/^\s+retries:\s*(\d+)/);
    if (retriesMatch) {
      current.retries = parseInt(retriesMatch[1], 10);
      continue;
    }

    // Duration line
    const durationMatch = line.match(/^\s+duration_ms:\s*(\d+)/);
    if (durationMatch) {
      current.duration_ms = parseInt(durationMatch[1], 10);
      continue;
    }
  }

  if (current) entries.push(current);
  return entries;
}

/**
 * Serialize a single LedgerTaskEntry into v2 markdown lines.
 */
export function serializeLedgerTaskEntry(entry: LedgerTaskEntry): string {
  const marker = entry.status === 'done' ? 'x' : entry.status === 'in_progress' ? '→' : ' ';
  const idPrefix = entry.id ? `${entry.id}: ` : '';
  const meta = entry.timestamp ? ` (${entry.timestamp})` : '';
  let out = `- [${marker}] ${idPrefix}${entry.name}${meta}\n`;

  if (entry.gates && entry.gates.length > 0) {
    const gateParts = entry.gates.map(g => {
      const detail = g.detail !== undefined ? `(${g.detail})` : '';
      return `${g.gate}:${g.result}${detail}`;
    });
    out += `  gates: ${gateParts.join(' ')}\n`;
  }

  if (entry.retries !== undefined) {
    out += `  retries: ${entry.retries}\n`;
  }

  if (entry.duration_ms !== undefined) {
    out += `  duration_ms: ${entry.duration_ms}\n`;
  }

  return out;
}

/**
 * Append or update a task entry in the ## State section of a ledger file.
 * If an entry with the same id already exists, it is replaced; otherwise appended.
 */
export function writeLedgerTaskEntry(filePath: string, entry: LedgerTaskEntry): void {
  let content = readFileSync(filePath, 'utf-8');
  const serialized = serializeLedgerTaskEntry(entry);

  // Update timestamp
  content = content.replace(/^Updated:\s*.+$/m, `Updated: ${new Date().toISOString()}`);

  if (!content.includes('## State')) {
    content += `\n## State\n${serialized}`;
    writeFileSync(filePath, content);
    return;
  }

  // If entry has an id, try to replace existing entry block
  if (entry.id) {
    // Match existing entry block: the task line plus any indented continuation lines
    const escapedId = entry.id.replace(/\./g, '\\.');
    const entryRegex = new RegExp(
      `- \\[[x →\\-]\\] ${escapedId}:[^\\n]*\\n(?:  [^\\n]*\\n)*`,
      'g'
    );
    if (entryRegex.test(content)) {
      content = content.replace(entryRegex, serialized);
      writeFileSync(filePath, content);
      return;
    }
  }

  // Append after ## State header
  content = content.replace(/## State\n/, `## State\n${serialized}`);
  writeFileSync(filePath, content);
}

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
<!-- Gate notation: gate:result(detail) — results: pass|fail|skip, e.g. quality:pass(P2x1) verify:fail>pass(r1: msg) -->
- [ ] 1.1: 初始化
- [→] 1.2: 开发功能
- [ ] 1.3: 代码审查
- [ ] 1.4: 测试

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

/**
 * Load the most recent compact checkpoint.
 * Called by SessionStart to restore context after compaction.
 */
export function loadCompactCheckpoint(): string | null {
  const cwd = getCwd();
  const checkpointPath = join(cwd, LEDGERS_DIR, '.compact-checkpoint.md');
  if (!existsSync(checkpointPath)) return null;

  try {
    const stat = statSync(checkpointPath);
    if (Date.now() - stat.mtime.getTime() > 3600_000) return null;
  } catch { return null; }

  return readFileSync(checkpointPath, 'utf-8');
}
