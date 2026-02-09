/**
 * Smart Context Injection
 * Extracts signals from current session (branch, platform, recent files)
 * and queries the knowledge base to inject relevant context at session start.
 *
 * Budget: hard limit 2500 chars (~625 tokens)
 *   - Platform pitfalls (always): max 600 chars
 *   - Task-related knowledge (FTS match): max 500 chars
 *   - Recent discoveries (7 days): max 400 chars
 *   - Last session summary (Tier 1+): max 500 chars
 */

import { execSync } from 'child_process';
import { existsSync, readFileSync, readdirSync, statSync } from 'fs';
import { join, basename } from 'path';
import { homedir } from 'os';
import { detectPlatformSimple } from '../detector';

const BUDGET_TOTAL = 2500;
const BUDGET_PITFALLS = 600;
const BUDGET_TASK = 500;
const BUDGET_RECENT = 400;
const BUDGET_LAST_SESSION = 500;

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

function getKnowledgeDir(): string {
  return join(homedir(), '.claude', 'knowledge');
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
  const pitfallsPath = join(getKnowledgeDir(), 'platforms', platform, 'pitfalls.md');
  if (!existsSync(pitfallsPath)) return '';

  const content = readFileSync(pitfallsPath, 'utf-8');
  if (content.length <= maxChars) return content;

  // Truncate at last complete entry
  const truncated = content.slice(0, maxChars);
  const lastHeader = truncated.lastIndexOf('\n### ');
  return lastHeader > 0 ? truncated.slice(0, lastHeader) : truncated;
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
  const discoveriesDir = join(getKnowledgeDir(), 'discoveries');
  if (!existsSync(discoveriesDir)) return '';

  const sevenDaysAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
  const files = readdirSync(discoveriesDir)
    .filter(f => f.endsWith('.md'))
    .filter(f => {
      try {
        return statSync(join(discoveriesDir, f)).mtime.getTime() > sevenDaysAgo;
      } catch {
        return false;
      }
    })
    .sort()
    .reverse()
    .slice(0, 3);

  let output = '';
  for (const file of files) {
    const content = readFileSync(join(discoveriesDir, file), 'utf-8');
    const titleMatch = content.match(/^# Discovery: (.+)/m);
    const whatMatch = content.match(/## What\n([\s\S]*?)(?=\n## |$)/);
    const title = titleMatch ? titleMatch[1] : file;
    const what = whatMatch ? whatMatch[1].trim().split('\n')[0] : '';
    const entry = `- ${title}: ${what.slice(0, 80)}\n`;
    if (output.length + entry.length > maxChars) break;
    output += entry;
  }
  return output;
}

function esc(s: string): string {
  return (s || '').replace(/'/g, "''");
}

function getProjectName(): string {
  return basename(getCwd());
}

function loadLastSessionSummary(project: string, maxChars: number): string {
  const dbPath = getDbPath();
  if (!existsSync(dbPath)) return '';

  const sql = `SELECT request, completed, next_steps FROM session_summaries WHERE project = '${esc(project)}' ORDER BY created_at_epoch DESC LIMIT 1;`;

  try {
    const result = execSync(`sqlite3 -separator '|||' "${dbPath}" "${sql}"`, {
      encoding: 'utf-8',
      timeout: 3000,
    }).trim();
    if (!result) return '';

    const [request, completed, nextSteps] = result.split('|||');
    let output = '';
    if (request) output += `**Request**: ${request.slice(0, 120)}\n`;
    if (completed) output += `**Completed**: ${completed.slice(0, 120)}\n`;
    if (nextSteps) output += `**Next**: ${nextSteps.slice(0, 120)}\n`;
    return output.slice(0, maxChars);
  } catch {
    return '';
  }
}

// --- Public API ---

export function injectKnowledgeContext(): InjectionResult {
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

  // 4. Last session summary (Tier 1+)
  const project = getProjectName();
  const lastSession = loadLastSessionSummary(project, BUDGET_LAST_SESSION);
  if (lastSession) {
    sections.push(`### Last Session\n${lastSession}`);
    sources.push('session_summaries');
    totalChars += lastSession.length;
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
