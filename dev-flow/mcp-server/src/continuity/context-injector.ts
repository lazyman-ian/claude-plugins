/**
 * Smart Context Injection
 * Extracts signals from current session (branch, platform, recent files)
 * and queries the knowledge base to inject relevant context at session start.
 *
 * Budget: hard limit 2500 chars (~625 tokens)
 *   - Platform pitfalls (always): max 600 chars
 *   - Task-related knowledge (FTS match): max 500 chars
 *   - Recent discoveries (7 days): max 400 chars
 */

import { execSync } from 'child_process';
import { existsSync, readFileSync, writeFileSync } from 'fs';
import { join } from 'path';
import { homedir } from 'os';
import { detectPlatformSimple } from '../detector';

const BUDGET_TOTAL = 2500;
const BUDGET_PITFALLS = 600;
const BUDGET_TASK = 500;
const BUDGET_RECENT = 400;

interface InjectionResult {
  context: string;
  sources: string[];
  totalChars: number;
}

function getCwd(): string {
  try {
    return execSync('git rev-parse --show-toplevel', { encoding: 'utf-8' }).trim();
  } catch {
    return process.cwd();
  }
}

function getDbPath(): string {
  const projectDir = getCwd();
  return join(projectDir, '.claude', 'cache', 'artifact-index', 'context.db');
}

// --- Signal Extraction ---

function extractBranchKeywords(): string[] {
  try {
    const branch = execSync('git branch --show-current', { encoding: 'utf-8' }).trim();
    // Extract keywords from branch: feature/TASK-123-add-auth → ["auth", "add"]
    const parts = branch.replace(/^(feature|bugfix|hotfix|release)\//, '')
      .replace(/TASK-\d+-?/i, '')
      .split(/[-_/]/)
      .filter(p => p.length > 2 && !/^\d+$/.test(p));
    return parts;
  } catch {
    return [];
  }
}

function detectPlatform(): string {
  return detectPlatformSimple(getCwd());
}

function getRecentFileKeywords(): string[] {
  try {
    const files = execSync('git diff --name-only HEAD~3 2>/dev/null || echo ""', {
      encoding: 'utf-8',
      timeout: 3000,
    }).trim();
    if (!files) return [];

    const keywords = new Set<string>();
    for (const file of files.split('\n').slice(0, 10)) {
      // Extract meaningful parts from file paths
      const parts = file.split('/').pop()?.replace(/\.[^.]+$/, '').split(/[-_.]/) || [];
      for (const part of parts) {
        if (part.length > 3 && !/^(index|main|app|test|spec)$/i.test(part)) {
          keywords.add(part.toLowerCase());
        }
      }
    }
    return Array.from(keywords).slice(0, 5);
  } catch {
    return [];
  }
}

// --- Knowledge Loading ---

function loadPlatformPitfalls(platform: string, maxChars: number): string {
  const dbPath = getDbPath();
  if (!existsSync(dbPath)) return '';
  // SQL injection prevention: double single quotes (sqlite3 CLI has no parameterized queries)
  const safePlatform = platform.replace(/'/g, "''");
  const sql = `SELECT title, substr(problem,1,100) FROM knowledge WHERE type='pitfall' AND platform='${safePlatform}' ORDER BY created_at DESC LIMIT 5;`;
  try {
    const result = execSync(`sqlite3 -separator $'\\t' "${dbPath}" "${sql}"`, {
      encoding: 'utf-8', timeout: 3000,
    }).trim();
    if (!result) return '';
    let output = '';
    for (const line of result.split('\n')) {
      const sep = line.indexOf('\t');
      if (sep === -1) continue;
      const title = line.slice(0, sep);
      const problem = line.slice(sep + 1);
      const entry = `### ${title}\n${problem}\n`;
      if (output.length + entry.length > maxChars) break;
      output += entry;
    }
    return output;
  } catch { return ''; }
}

function queryKnowledgeFts(keywords: string[], maxChars: number): string {
  const dbPath = getDbPath();
  if (!existsSync(dbPath) || keywords.length === 0) return '';

  const query = keywords.join(' OR ');
  const sql = `SELECT k.type, k.title, k.problem FROM knowledge k JOIN knowledge_fts f ON k.rowid = f.rowid WHERE knowledge_fts MATCH '${esc(query)}' ORDER BY rank LIMIT 5;`;

  try {
    const result = execSync(`sqlite3 -separator '|||' "${dbPath}" "${sql}"`, {
      encoding: 'utf-8',
      timeout: 3000,
    }).trim();
    if (!result) return '';

    let output = '';
    for (const line of result.split('\n')) {
      const [type, title, problem] = line.split('|||');
      const entry = `- [${type}] ${title}: ${(problem || '').slice(0, 80)}\n`;
      if (output.length + entry.length > maxChars) break;
      output += entry;
    }
    return output;
  } catch {
    return '';
  }
}

function loadRecentDiscoveries(maxChars: number): string {
  const dbPath = getDbPath();
  if (!existsSync(dbPath)) return '';
  const sql = `SELECT type, title, substr(problem,1,80) FROM knowledge WHERE julianday('now') - julianday(created_at) <= 7 ORDER BY created_at DESC LIMIT 3;`;
  try {
    const result = execSync(`sqlite3 -separator $'\\t' "${dbPath}" "${sql}"`, {
      encoding: 'utf-8', timeout: 3000,
    }).trim();
    if (!result) return '';
    let output = '';
    for (const line of result.split('\n')) {
      const sep = line.indexOf('\t');
      if (sep === -1) continue;
      const type = line.slice(0, sep);
      const rest = line.slice(sep + 1);
      const sep2 = rest.indexOf('\t');
      const title = sep2 === -1 ? rest : rest.slice(0, sep2);
      const problem = sep2 === -1 ? '' : rest.slice(sep2 + 1);
      const entry = `- [${type}] ${title}: ${problem}\n`;
      if (output.length + entry.length > maxChars) break;
      output += entry;
    }
    return output;
  } catch { return ''; }
}

function esc(s: string): string {
  return (s || '').replace(/'/g, "''");
}

// --- Public API ---

const MEMORY_MARKER_START = '<!-- DEV-MEMORY-START -->';
const MEMORY_MARKER_END = '<!-- DEV-MEMORY-END -->';
// ~80 lines budget: roughly 4000 chars at ~50 chars/line
const MEMORY_MD_BUDGET = 4000;

/**
 * Sync dev memory context into MEMORY.md between marker comments.
 * Preserves all human-written content outside the markers.
 * If markers don't exist, appends a new Dev Memory section.
 */
export function syncToMemoryMd(memoryMdPath: string): void {
  const platform = detectPlatform();
  const branchKeywords = extractBranchKeywords();
  const fileKeywords = getRecentFileKeywords();
  const allKeywords = [...new Set([...branchKeywords, ...fileKeywords])];

  const lines: string[] = [];

  // 1. Platform pitfalls (always)
  const pitfalls = loadPlatformPitfalls(platform, BUDGET_PITFALLS);
  if (pitfalls) {
    lines.push(`**${platform.toUpperCase()} Pitfalls:**\n${pitfalls.trimEnd()}`);
  }

  // 2. Task-related knowledge (FTS match)
  if (allKeywords.length > 0) {
    const taskKnowledge = queryKnowledgeFts(allKeywords, BUDGET_TASK);
    if (taskKnowledge) {
      lines.push(`**Related** (${allKeywords.join(', ')}):\n${taskKnowledge.trimEnd()}`);
    }
  }

  // 3. Recent discoveries (7 days)
  const recent = loadRecentDiscoveries(BUDGET_RECENT);
  if (recent) {
    lines.push(`**Recent discoveries:**\n${recent.trimEnd()}`);
  }

  // Build replacement block
  let devMemorySection = `## Dev Memory\n\n`;
  if (lines.length === 0) {
    devMemorySection += '_No dev memory entries yet. Run `dev_memory save` to add knowledge._\n';
  } else {
    let body = lines.join('\n\n');
    if (body.length > MEMORY_MD_BUDGET) {
      body = body.slice(0, MEMORY_MD_BUDGET);
      const lastNl = body.lastIndexOf('\n');
      if (lastNl > MEMORY_MD_BUDGET * 0.8) body = body.slice(0, lastNl);
    }
    devMemorySection += body + '\n';
  }

  const newBlock = `${MEMORY_MARKER_START}\n${devMemorySection}\n${MEMORY_MARKER_END}`;

  // Read existing MEMORY.md or create empty baseline
  let existing = '';
  if (existsSync(memoryMdPath)) {
    existing = readFileSync(memoryMdPath, 'utf-8');
  }

  let updated: string;
  if (existing.includes(MEMORY_MARKER_START) && existing.includes(MEMORY_MARKER_END)) {
    // Replace only the region between markers
    const startIdx = existing.indexOf(MEMORY_MARKER_START);
    const endIdx = existing.indexOf(MEMORY_MARKER_END) + MEMORY_MARKER_END.length;
    updated = existing.slice(0, startIdx) + newBlock + existing.slice(endIdx);
  } else {
    // Append at end with blank line separator
    const separator = existing.length > 0 && !existing.endsWith('\n\n') ? '\n\n' : '';
    updated = existing + separator + newBlock + '\n';
  }

  writeFileSync(memoryMdPath, updated, 'utf-8');
}

export function injectKnowledgeContext(): InjectionResult {
  // Attempt to sync to MEMORY.md for Auto Memory integration
  const projectDir = getCwd();
  // Derive the project hash path used by Claude's Auto Memory system
  // Format: ~/.claude/projects/<escaped-path>/memory/MEMORY.md
  const escapedPath = projectDir.replace(/\//g, '-').replace(/^-/, '');
  const memoryMdPath = join(homedir(), '.claude', 'projects', escapedPath, 'memory', 'MEMORY.md');

  try {
    if (existsSync(join(homedir(), '.claude', 'projects', escapedPath, 'memory'))) {
      syncToMemoryMd(memoryMdPath);
      // Continue to legacy injection — syncToMemoryMd writes to MEMORY.md for
      // built-in Auto Memory, but callers may still need the injection text
      // for hook-based SessionStart context injection.
    }
  } catch {
    // Sync failed — continue to legacy injection
  }

  // Return injection text (used by SessionStart hook and as fallback)
  const platform = detectPlatform();
  const branchKeywords = extractBranchKeywords();
  const fileKeywords = getRecentFileKeywords();
  const allKeywords = [...new Set([...branchKeywords, ...fileKeywords])];

  const sources: string[] = [];
  const sections: string[] = [];
  let totalChars = 0;

  // 1. Platform pitfalls (always injected)
  const pitfalls = loadPlatformPitfalls(platform, BUDGET_PITFALLS);
  if (pitfalls) {
    sections.push(`### ${platform.toUpperCase()} Pitfalls\n${pitfalls}`);
    sources.push(`platforms/${platform}/pitfalls.md`);
    totalChars += pitfalls.length;
  }

  // 2. Task-related knowledge (FTS match)
  if (allKeywords.length > 0) {
    const taskKnowledge = queryKnowledgeFts(allKeywords, BUDGET_TASK);
    if (taskKnowledge) {
      sections.push(`### Related Knowledge\nKeywords: ${allKeywords.join(', ')}\n${taskKnowledge}`);
      sources.push('FTS5 query');
      totalChars += taskKnowledge.length;
    }
  }

  // 3. Recent discoveries (7 days)
  const recent = loadRecentDiscoveries(BUDGET_RECENT);
  if (recent) {
    sections.push(`### Recent Discoveries\n${recent}`);
    sources.push('discoveries/');
    totalChars += recent.length;
  }

  if (sections.length === 0) {
    return { context: '', sources: [], totalChars: 0 };
  }

  // Assemble with budget enforcement
  let context = '## Relevant Knowledge\n\n' + sections.join('\n\n');
  if (context.length > BUDGET_TOTAL) {
    context = context.slice(0, BUDGET_TOTAL);
    const lastNewline = context.lastIndexOf('\n');
    if (lastNewline > BUDGET_TOTAL * 0.8) {
      context = context.slice(0, lastNewline);
    }
  }

  return { context, sources, totalChars: context.length };
}
