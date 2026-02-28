/**
 * Knowledge Consolidation Engine
 * Scans session artifacts (auto-handoffs, reasoning, ledgers) and
 * consolidates them into persistent, searchable knowledge entries.
 */

import { execSync } from 'child_process';
import { existsSync, readdirSync, readFileSync, writeFileSync, mkdirSync, statSync } from 'fs';
import { join, basename } from 'path';
import { homedir } from 'os';
import { detectPlatformSimple } from '../detector';

// --- Types ---

interface KnowledgeEntry {
  id: string;
  type: 'pitfall' | 'pattern' | 'decision';
  platform: string;
  title: string;
  problem: string;
  solution: string;
  sourceProject: string;
  sourceSession: string;
  createdAt: string;
  filePath: string;
}

interface ConsolidationResult {
  success: boolean;
  message: string;
  data?: {
    pitfalls: number;
    patterns: number;
    decisions: number;
    skippedDuplicates: number;
  };
}

interface MemoryStatus {
  totalEntries: number;
  byType: Record<string, number>;
  unprocessedHandoffs: number;
  unprocessedReasoning: number;
  knowledgeDir: string;
}

// --- Helpers ---

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

function ensureKnowledgeDirs(): void {
  const base = getKnowledgeDir();
  mkdirSync(join(base, 'platforms'), { recursive: true });
  mkdirSync(join(base, 'patterns'), { recursive: true });
  mkdirSync(join(base, 'discoveries'), { recursive: true });
}

function getProjectName(): string {
  const cwd = getCwd();
  return basename(cwd);
}

function generateId(type: string, title: string): string {
  const slug = title.toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 40);
  const ts = Date.now().toString(36);
  return `${type}-${slug}-${ts}`;
}

function isDuplicate(existingContent: string, title: string, problem: string): boolean {
  const lower = existingContent.toLowerCase();
  const titleLower = title.toLowerCase();
  const problemLower = problem.toLowerCase();
  if (lower.includes(titleLower) && titleLower.length > 10) return true;
  if (problemLower.length > 20 && lower.includes(problemLower.slice(0, 50))) return true;
  return false;
}

// --- DB helpers (sqlite3 CLI) ---

function ensureDbSchema(): void {
  const dbPath = getDbPath();
  const dbDir = join(getCwd(), '.claude', 'cache', 'artifact-index');
  mkdirSync(dbDir, { recursive: true });

  const schema = `
CREATE TABLE IF NOT EXISTS knowledge (
  id TEXT PRIMARY KEY,
  type TEXT NOT NULL,
  platform TEXT,
  title TEXT NOT NULL,
  problem TEXT,
  solution TEXT,
  source_project TEXT,
  source_session TEXT,
  created_at TEXT NOT NULL,
  file_path TEXT NOT NULL
);

CREATE VIRTUAL TABLE IF NOT EXISTS knowledge_fts USING fts5(
  title, problem, solution, content=knowledge, content_rowid=rowid,
  tokenize='porter unicode61', prefix='2,3'
);

CREATE TRIGGER IF NOT EXISTS knowledge_ai AFTER INSERT ON knowledge BEGIN
  INSERT INTO knowledge_fts(rowid, title, problem, solution) VALUES (new.rowid, new.title, new.problem, new.solution);
END;

CREATE TRIGGER IF NOT EXISTS knowledge_ad AFTER DELETE ON knowledge BEGIN
  INSERT INTO knowledge_fts(knowledge_fts, rowid, title, problem, solution) VALUES('delete', old.rowid, old.title, old.problem, old.solution);
END;

CREATE TABLE IF NOT EXISTS reasoning (
  commit_hash TEXT PRIMARY KEY,
  branch TEXT,
  commit_message TEXT,
  failed_attempts TEXT,
  decisions TEXT,
  created_at TEXT NOT NULL
);

CREATE VIRTUAL TABLE IF NOT EXISTS reasoning_fts USING fts5(
  commit_message, failed_attempts, decisions, content=reasoning,
  tokenize='porter unicode61'
);

CREATE TRIGGER IF NOT EXISTS reasoning_ai AFTER INSERT ON reasoning BEGIN
  INSERT INTO reasoning_fts(rowid, commit_message, failed_attempts, decisions) VALUES (new.rowid, new.commit_message, new.failed_attempts, new.decisions);
END;

CREATE TRIGGER IF NOT EXISTS reasoning_ad AFTER DELETE ON reasoning BEGIN
  INSERT INTO reasoning_fts(reasoning_fts, rowid, commit_message, failed_attempts, decisions) VALUES('delete', old.rowid, old.commit_message, old.failed_attempts, old.decisions);
END;

CREATE TABLE IF NOT EXISTS synonyms (
  term TEXT PRIMARY KEY,
  expansions TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS session_summaries (
  id TEXT PRIMARY KEY,
  session_id TEXT,
  project TEXT NOT NULL,
  request TEXT,
  investigated TEXT,
  learned TEXT,
  completed TEXT,
  next_steps TEXT,
  files_modified TEXT,
  created_at TEXT NOT NULL,
  created_at_epoch INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_session_summaries_project ON session_summaries(project);
CREATE INDEX IF NOT EXISTS idx_session_summaries_epoch ON session_summaries(created_at_epoch DESC);

CREATE VIRTUAL TABLE IF NOT EXISTS session_summaries_fts USING fts5(
  request, investigated, learned, completed, next_steps,
  content=session_summaries, content_rowid=rowid,
  tokenize='porter unicode61'
);

CREATE TRIGGER IF NOT EXISTS session_summaries_ai AFTER INSERT ON session_summaries BEGIN
  INSERT INTO session_summaries_fts(rowid, request, investigated, learned, completed, next_steps)
  VALUES (new.rowid, new.request, new.investigated, new.learned, new.completed, new.next_steps);
END;

CREATE TRIGGER IF NOT EXISTS session_summaries_ad AFTER DELETE ON session_summaries BEGIN
  INSERT INTO session_summaries_fts(session_summaries_fts, rowid, request, investigated, learned, completed, next_steps)
  VALUES('delete', old.rowid, old.request, old.investigated, old.learned, old.completed, old.next_steps);
END;

`;

  try {
    execSync(`sqlite3 "${dbPath}" "${schema.replace(/"/g, '\\"')}"`, {
      encoding: 'utf-8',
      timeout: 5000,
    });
  } catch {
    // DB may already have tables, ignore errors
  }

  seedSynonyms();
}

function dbInsertKnowledge(entry: KnowledgeEntry): boolean {
  const dbPath = getDbPath();
  if (!existsSync(dbPath)) return false;

  const sql = `INSERT OR IGNORE INTO knowledge (id, type, platform, title, problem, solution, source_project, source_session, created_at, file_path) VALUES ('${esc(entry.id)}', '${esc(entry.type)}', '${esc(entry.platform)}', '${esc(entry.title)}', '${esc(entry.problem)}', '${esc(entry.solution)}', '${esc(entry.sourceProject)}', '${esc(entry.sourceSession)}', '${esc(entry.createdAt)}', '${esc(entry.filePath)}');`;

  try {
    execSync(`sqlite3 "${dbPath}" "${sql}"`, { encoding: 'utf-8', timeout: 3000 });
    return true;
  } catch {
    return false;
  }
}

function dbInsertReasoning(commitHash: string, branch: string, commitMessage: string, failedAttempts: string, decisions: string): boolean {
  const dbPath = getDbPath();
  if (!existsSync(dbPath)) return false;

  const sql = `INSERT OR REPLACE INTO reasoning (commit_hash, branch, commit_message, failed_attempts, decisions, created_at) VALUES ('${esc(commitHash)}', '${esc(branch)}', '${esc(commitMessage)}', '${esc(failedAttempts)}', '${esc(decisions)}', '${esc(new Date().toISOString())}');`;

  try {
    execSync(`sqlite3 "${dbPath}" "${sql}"`, { encoding: 'utf-8', timeout: 3000 });
    return true;
  } catch {
    return false;
  }
}

function dbQueryKnowledge(query: string, limit: number = 10): KnowledgeEntry[] {
  const dbPath = getDbPath();
  if (!existsSync(dbPath)) return [];

  const sql = `SELECT k.id, k.type, k.platform, k.title, k.problem, k.solution, k.source_project, k.source_session, k.created_at, k.file_path FROM knowledge k JOIN knowledge_fts f ON k.rowid = f.rowid WHERE knowledge_fts MATCH '${esc(query)}' ORDER BY rank LIMIT ${limit};`;

  try {
    const result = execSync(`sqlite3 -separator '|||' "${dbPath}" "${sql}"`, {
      encoding: 'utf-8',
      timeout: 3000,
    }).trim();
    if (!result) return [];

    return result.split('\n').map(line => {
      const [id, type, platform, title, problem, solution, sourceProject, sourceSession, createdAt, filePath] = line.split('|||');
      return { id, type: type as any, platform, title, problem, solution, sourceProject, sourceSession, createdAt, filePath };
    });
  } catch {
    return [];
  }
}

function dbQueryReasoning(query: string, limit: number = 10): Array<{ commitHash: string; branch: string; commitMessage: string; failedAttempts: string; decisions: string }> {
  const dbPath = getDbPath();
  if (!existsSync(dbPath)) return [];

  const sql = `SELECT r.commit_hash, r.branch, r.commit_message, r.failed_attempts, r.decisions FROM reasoning r JOIN reasoning_fts f ON r.rowid = f.rowid WHERE reasoning_fts MATCH '${esc(query)}' ORDER BY rank LIMIT ${limit};`;

  try {
    const result = execSync(`sqlite3 -separator '|||' "${dbPath}" "${sql}"`, {
      encoding: 'utf-8',
      timeout: 3000,
    }).trim();
    if (!result) return [];

    return result.split('\n').map(line => {
      const [commitHash, branch, commitMessage, failedAttempts, decisions] = line.split('|||');
      return { commitHash, branch, commitMessage, failedAttempts, decisions };
    });
  } catch {
    return [];
  }
}

function esc(s: string): string {
  return (s || '').replace(/'/g, "''");
}

// --- FTS5 Synonym Expansion ---

function expandQuery(query: string): string {
  const dbPath = getDbPath();
  if (!existsSync(dbPath)) return query;

  const terms = query.split(/\s+/).filter(Boolean);
  const expanded = terms.map(term => {
    try {
      const sql = `SELECT expansions FROM synonyms WHERE term = '${esc(term.toLowerCase())}';`;
      const result = execSync(`sqlite3 "${dbPath}" "${sql}"`, { encoding: 'utf-8', timeout: 2000 }).trim();
      if (result) {
        const synonyms: string[] = JSON.parse(result);
        return `(${term} OR ${synonyms.join(' OR ')})`;
      }
    } catch { /* no synonym found */ }
    return term;
  });
  return expanded.join(' ');
}

function seedSynonyms(): void {
  const dbPath = getDbPath();
  if (!existsSync(dbPath)) return;

  const defaults: Record<string, string[]> = {
    concurrency: ['thread', 'race condition', 'async', 'await', 'actor', 'sendable'],
    auth: ['authentication', 'authorization', 'jwt', 'token', 'login', 'session'],
    crash: ['fatal', 'exception', 'abort', 'signal', 'SIGABRT'],
    performance: ['slow', 'latency', 'memory leak', 'cpu', 'optimize'],
    ui: ['layout', 'view', 'component', 'render', 'display'],
    network: ['http', 'api', 'request', 'response', 'fetch', 'url'],
    database: ['sqlite', 'core data', 'realm', 'migration', 'schema'],
    test: ['unit test', 'integration', 'mock', 'stub', 'assert'],
  };

  for (const [term, expansions] of Object.entries(defaults)) {
    try {
      const sql = `INSERT OR IGNORE INTO synonyms (term, expansions) VALUES ('${esc(term)}', '${esc(JSON.stringify(expansions))}');`;
      execSync(`sqlite3 "${dbPath}" "${sql}"`, { encoding: 'utf-8', timeout: 2000 });
    } catch { /* ignore */ }
  }
}

// --- Source Scanners ---

function scanHandoffs(): Array<{ title: string; problem: string; solution: string; session: string; platform: string }> {
  const cwd = getCwd();
  const entries: Array<{ title: string; problem: string; solution: string; session: string; platform: string }> = [];

  // Scan both thoughts/handoffs/ and thoughts/shared/handoffs/*/
  const searchDirs: string[] = [];
  const handoffsDir = join(cwd, 'thoughts', 'handoffs');
  if (existsSync(handoffsDir)) searchDirs.push(handoffsDir);
  const sharedBase = join(cwd, 'thoughts', 'shared', 'handoffs');
  if (existsSync(sharedBase)) {
    for (const sub of readdirSync(sharedBase)) {
      const subPath = join(sharedBase, sub);
      if (existsSync(subPath) && statSync(subPath).isDirectory()) searchDirs.push(subPath);
    }
  }

  for (const dir of searchDirs) {
    for (const file of readdirSync(dir)) {
      if (!file.endsWith('.md')) continue;

      const content = readFileSync(join(dir, file), 'utf-8');

      // Extract "Decisions Made" — the most valuable section in real handoffs
      const decisionsMatch = content.match(/## Decisions Made\n([\s\S]*?)(?=\n## |$)/);
      if (!decisionsMatch) continue;

      const decisionsBlock = decisionsMatch[1].trim();
      if (!decisionsBlock || decisionsBlock.length < 30) continue;

      // Extract title from H1
      const titleMatch = content.match(/^# (.+)/m);
      const title = titleMatch ? titleMatch[1].slice(0, 80) : file.replace('.md', '');

      // Extract "What Was Done" for context
      const whatMatch = content.match(/## What Was Done\n([\s\S]*?)(?=\n## |$)/);
      const context = whatMatch ? whatMatch[1].trim().slice(0, 300) : '';

      entries.push({
        title,
        problem: context || title,
        solution: decisionsBlock.slice(0, 500),
        session: file.replace('.md', ''),
        platform: detectPlatformFromContent(content),
      });
    }
  }

  return entries;
}

function scanReasoning(): Array<{ title: string; problem: string; solution: string; session: string }> {
  const cwd = getCwd();
  const reasoningDir = join(cwd, '.git', 'claude', 'commits');
  if (!existsSync(reasoningDir)) return [];

  const entries: Array<{ title: string; problem: string; solution: string; session: string }> = [];

  for (const commitDir of readdirSync(reasoningDir)) {
    const reasoningPath = join(reasoningDir, commitDir, 'reasoning.md');
    if (!existsSync(reasoningPath)) continue;

    const content = readFileSync(reasoningPath, 'utf-8');
    const commitMatch = content.match(/## What was committed\n([\s\S]*?)(?=\n## |$)/);
    const commitMsg = commitMatch ? commitMatch[1].trim().split('\n')[0] : commitDir.slice(0, 8);

    // Only extract failed attempts — these contain real problem/solution knowledge
    const failedMatch = content.match(/### Failed attempts\n([\s\S]*?)(?=### Summary|## |$)/);
    if (!failedMatch) continue;

    const failedText = failedMatch[1].trim();
    if (!failedText || failedText.length < 20) continue;

    // Try to extract what actually worked from Summary or "Why this approach"
    const summaryMatch = content.match(/### (?:Summary|Why this approach)\n([\s\S]*?)(?=### |## |$)/);
    const solution = summaryMatch ? summaryMatch[1].trim().slice(0, 500) : '';
    if (!solution) continue;

    entries.push({
      title: `Failed approach: ${commitMsg.slice(0, 60)}`,
      problem: failedText.slice(0, 500),
      solution,
      session: commitDir.slice(0, 8),
    });
  }

  return entries;
}

function scanLedgers(): Array<{ title: string; problem: string; solution: string; session: string }> {
  const cwd = getCwd();
  const ledgersDir = join(cwd, 'thoughts', 'ledgers');
  if (!existsSync(ledgersDir)) return [];

  const entries: Array<{ title: string; problem: string; solution: string; session: string }> = [];

  for (const file of readdirSync(ledgersDir)) {
    if (!file.endsWith('.md')) continue;

    const content = readFileSync(join(ledgersDir, file), 'utf-8');
    const questionsMatch = content.match(/## Open Questions\n([\s\S]*?)(?=\n## |$)/);
    if (!questionsMatch) continue;

    const lines = questionsMatch[1].trim().split('\n');
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      // Look for resolved questions: lines starting with - [x] or ~~
      const resolvedMatch = line.match(/^-\s*\[x\]\s*(.+)/i) || line.match(/^-\s*~~(.+)~~/);
      if (!resolvedMatch) continue;

      const questionText = resolvedMatch[1].replace(/~~/g, '').trim();

      // Extract answer from indented lines following the resolved question
      const answerLines: string[] = [];
      for (let j = i + 1; j < lines.length; j++) {
        const nextLine = lines[j];
        if (nextLine.match(/^\s{2,}/) || nextLine.match(/^\s*→/)) {
          answerLines.push(nextLine.trim());
        } else {
          break;
        }
      }
      const answer = answerLines.join(' ').trim();

      // Skip entries without a real answer
      if (!answer) continue;

      entries.push({
        title: `Decision: ${questionText.slice(0, 60)}`,
        problem: questionText,
        solution: answer.slice(0, 500),
        session: file.replace('.md', ''),
      });
    }
  }

  return entries;
}

function detectPlatformFromContent(content: string): string {
  const lower = content.toLowerCase();
  if (lower.includes('.swift') || lower.includes('swiftui') || lower.includes('xcode')) return 'ios';
  if (lower.includes('.kt') || lower.includes('kotlin') || lower.includes('gradle')) return 'android';
  if (lower.includes('.tsx') || lower.includes('.jsx') || lower.includes('react')) return 'web';
  return 'general';
}

function detectCurrentPlatform(): string {
  return detectPlatformSimple(getCwd());
}

// --- Write knowledge files ---

function writeKnowledgeEntry(entry: KnowledgeEntry): void {
  ensureKnowledgeDirs();

  let filePath: string;
  let content: string;
  const date = entry.createdAt.slice(0, 10);
  const platformLink = entry.platform === 'ios' ? '[[iOS 常见陷阱]]'
    : entry.platform === 'android' ? '[[Android 常见陷阱]]'
    : '';

  switch (entry.type) {
    case 'pitfall': {
      const platformDir = join(getKnowledgeDir(), 'platforms', entry.platform);
      mkdirSync(platformDir, { recursive: true });
      filePath = join(platformDir, 'pitfalls.md');
      const newEntry = `\n### ${entry.title}\n**Source**: ${entry.sourceProject}, ${date}\n**Problem**: ${entry.problem}\n**Solution**: ${entry.solution}\n`;
      if (existsSync(filePath)) {
        const existing = readFileSync(filePath, 'utf-8');
        if (isDuplicate(existing, entry.title, entry.problem)) return;
        content = existing + newEntry;
      } else {
        content = `---\ntype: pitfall\nplatform: ${entry.platform}\nupdated: ${date}\n---\n\n# ${entry.platform.toUpperCase()} Pitfalls\n` + newEntry;
      }
      break;
    }
    case 'pattern': {
      const slug = entry.title.toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 50);
      filePath = join(getKnowledgeDir(), 'patterns', `${slug}.md`);
      content = `---\ntype: pattern\nplatform: ${entry.platform}\ntags: [${entry.type}]\nproject: ${entry.sourceProject}\ndate: ${date}\n---\n\n# ${entry.title}\n\n## Problem\n${entry.problem}\n\n## Solution\n${entry.solution}\n\n${platformLink ? `Related: ${platformLink}` : ''}\n`;
      break;
    }
    case 'decision': {
      const slug = entry.title.toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 50);
      filePath = join(getKnowledgeDir(), 'discoveries', `${date}-${slug}.md`);
      content = `---\ntype: decision\nplatform: ${entry.platform}\ntags: [decision]\nproject: ${entry.sourceProject}\ndate: ${date}\n---\n\n# ${entry.title}\n\n## Question\n${entry.problem}\n\n## Answer\n${entry.solution}\n\n${platformLink ? `Related: ${platformLink}` : ''}\n`;
      break;
    }
    default:
      return;
  }

  entry.filePath = filePath;
  writeFileSync(filePath, content);
}

// --- Public API ---

export function memoryConsolidate(): ConsolidationResult {
  ensureDbSchema();

  const project = getProjectName();
  const platform = detectCurrentPlatform();
  const now = new Date().toISOString();
  let pitfalls = 0, patterns = 0, decisions = 0, skippedDuplicates = 0;

  // Scan handoffs → pitfalls
  for (const item of scanHandoffs()) {
    const entry: KnowledgeEntry = {
      id: generateId('pitfall', item.title),
      type: 'pitfall',
      platform: item.platform || platform,
      title: item.title,
      problem: item.problem,
      solution: item.solution,
      sourceProject: project,
      sourceSession: item.session,
      createdAt: now,
      filePath: '',
    };

    // Check existing pitfalls file for duplicates
    const pitfallsPath = join(getKnowledgeDir(), 'platforms', entry.platform, 'pitfalls.md');
    if (existsSync(pitfallsPath) && isDuplicate(readFileSync(pitfallsPath, 'utf-8'), entry.title, entry.problem)) {
      skippedDuplicates++;
      continue;
    }

    writeKnowledgeEntry(entry);
    dbInsertKnowledge(entry);
    pitfalls++;
  }

  // Scan reasoning → patterns
  for (const item of scanReasoning()) {
    const entry: KnowledgeEntry = {
      id: generateId('pattern', item.title),
      type: 'pattern',
      platform,
      title: item.title,
      problem: item.problem,
      solution: item.solution,
      sourceProject: project,
      sourceSession: item.session,
      createdAt: now,
      filePath: '',
    };

    writeKnowledgeEntry(entry);
    dbInsertKnowledge(entry);
    patterns++;
  }

  // Scan ledgers → decisions
  for (const item of scanLedgers()) {
    const entry: KnowledgeEntry = {
      id: generateId('decision', item.title),
      type: 'decision',
      platform,
      title: item.title,
      problem: item.problem,
      solution: item.solution,
      sourceProject: project,
      sourceSession: item.session,
      createdAt: now,
      filePath: '',
    };

    writeKnowledgeEntry(entry);
    dbInsertKnowledge(entry);
    decisions++;
  }

  const total = pitfalls + patterns + decisions;

  // Write topic files to Auto Memory directory (graceful degradation if not present)
  const autoMemDir = getAutoMemoryDir();
  if (autoMemDir) {
    writeTopicFiles(autoMemDir);
  }

  return {
    success: true,
    message: `Consolidated:${total}|pitfalls:${pitfalls}|patterns:${patterns}|decisions:${decisions}|skipped:${skippedDuplicates}`,
    data: { pitfalls, patterns, decisions, skippedDuplicates },
  };
}

export function memoryStatus(): MemoryStatus {
  const knowledgeDir = getKnowledgeDir();
  const cwd = getCwd();
  const status: MemoryStatus = {
    totalEntries: 0,
    byType: { pitfall: 0, pattern: 0, decision: 0 },
    unprocessedHandoffs: 0,
    unprocessedReasoning: 0,
    knowledgeDir,
  };

  // Count knowledge entries from files
  const platformsDir = join(knowledgeDir, 'platforms');
  if (existsSync(platformsDir)) {
    for (const platform of readdirSync(platformsDir)) {
      const pitfallsPath = join(platformsDir, platform, 'pitfalls.md');
      if (existsSync(pitfallsPath)) {
        const content = readFileSync(pitfallsPath, 'utf-8');
        const count = (content.match(/^### /gm) || []).length;
        status.byType.pitfall += count;
        status.totalEntries += count;
      }
    }
  }

  const patternsDir = join(knowledgeDir, 'patterns');
  if (existsSync(patternsDir)) {
    const count = readdirSync(patternsDir).filter(f => f.endsWith('.md')).length;
    status.byType.pattern = count;
    status.totalEntries += count;
  }

  const discoveriesDir = join(knowledgeDir, 'discoveries');
  if (existsSync(discoveriesDir)) {
    const count = readdirSync(discoveriesDir).filter(f => f.endsWith('.md')).length;
    status.byType.decision = count;
    status.totalEntries += count;
  }

  // Count unprocessed sources
  const handoffsBase = join(cwd, 'thoughts', 'shared', 'handoffs');
  if (existsSync(handoffsBase)) {
    for (const sessionDir of readdirSync(handoffsBase)) {
      const sessionPath = join(handoffsBase, sessionDir);
      if (!statSync(sessionPath).isDirectory()) continue;
      for (const file of readdirSync(sessionPath)) {
        if (file.startsWith('auto-handoff-') && file.endsWith('.md')) {
          const content = readFileSync(join(sessionPath, file), 'utf-8');
          if (content.includes('## Errors Encountered') && !content.includes('No errors.')) {
            status.unprocessedHandoffs++;
          }
        }
      }
    }
  }

  const reasoningDir = join(cwd, '.git', 'claude', 'commits');
  if (existsSync(reasoningDir)) {
    for (const commitDir of readdirSync(reasoningDir)) {
      const reasoningPath = join(reasoningDir, commitDir, 'reasoning.md');
      if (!existsSync(reasoningPath)) continue;
      const content = readFileSync(reasoningPath, 'utf-8');
      if (content.includes('### Failed attempts')) {
        status.unprocessedReasoning++;
      }
    }
  }

  return status;
}

export function memoryQuery(query: string, limit: number = 10): KnowledgeEntry[] {
  ensureDbSchema();
  return dbQueryKnowledge(expandQuery(query), limit);
}

export function memoryList(type?: string): KnowledgeEntry[] {
  const dbPath = getDbPath();
  if (!existsSync(dbPath)) return [];

  const whereClause = type ? `WHERE type = '${esc(type)}'` : '';
  const sql = `SELECT id, type, platform, title, problem, solution, source_project, source_session, created_at, file_path FROM knowledge ${whereClause} ORDER BY created_at DESC LIMIT 50;`;

  try {
    const result = execSync(`sqlite3 -separator '|||' "${dbPath}" "${sql}"`, {
      encoding: 'utf-8',
      timeout: 3000,
    }).trim();
    if (!result) return [];

    return result.split('\n').map(line => {
      const [id, type, platform, title, problem, solution, sourceProject, sourceSession, createdAt, filePath] = line.split('|||');
      return { id, type: type as any, platform, title, problem, solution, sourceProject, sourceSession, createdAt, filePath };
    });
  } catch {
    return [];
  }
}

// --- Memory Config ---

function getMemoryConfig(): { tier: number; sessionSummary: boolean } {
  const configPath = join(getCwd(), '.dev-flow.json');
  try {
    if (existsSync(configPath)) {
      const config = JSON.parse(readFileSync(configPath, 'utf-8'));
      const tier = config?.memory?.tier ?? 0;
      return {
        tier,
        sessionSummary: config?.memory?.sessionSummary ?? (tier >= 1),
      };
    }
  } catch { /* ignore */ }
  return { tier: 0, sessionSummary: false };
}

// --- Ad-hoc Memory Storage ---

export function memorySave(text: string, title?: string, tags?: string[], type?: string): { id: string; message: string; saved?: boolean; reason?: string } {
  ensureDbSchema();
  const project = getProjectName();
  const platform = detectCurrentPlatform();
  const autoTitle = title || text.slice(0, 60).replace(/\n/g, ' ');
  const entryType = (type === 'pitfall' || type === 'pattern' || type === 'decision') ? type : 'decision';

  try {
    const dedupResult = smartDedup(
      { type: entryType, title: autoTitle, content: text, platform },
      getDbPath()
    );
    if (dedupResult.action === 'NOOP') {
      return { id: '', message: `Duplicate: ${dedupResult.reason} (${dedupResult.method})`, saved: false, reason: `Duplicate: ${dedupResult.reason} (${dedupResult.method})` };
    }
  } catch {
    // Dedup failed (e.g., no knowledge_fts table), proceed with save
  }

  const entry: KnowledgeEntry = {
    id: generateId(entryType, autoTitle),
    type: entryType as 'pitfall' | 'pattern' | 'decision',
    platform,
    title: autoTitle,
    problem: text,
    solution: tags?.join(', ') || '',
    sourceProject: project,
    sourceSession: 'manual',
    createdAt: new Date().toISOString(),
    filePath: '',
  };
  writeKnowledgeEntry(entry);
  dbInsertKnowledge(entry);

  return { id: entry.id, message: `Saved: ${autoTitle}` };
}

// --- Lightweight Search (3-layer index) ---

export function memorySearch(query: string, limit: number = 10, type?: string): Array<{
  id: string; type: string; title: string; platform: string; createdAt: string;
}> {
  ensureDbSchema();
  const dbPath = getDbPath();
  if (!existsSync(dbPath)) return [];

  const expandedQuery = expandQuery(query);
  const typeFilter = type ? ` AND k.type = '${esc(type)}'` : '';
  const sql = `SELECT k.id, k.type, k.title, k.platform, k.created_at FROM knowledge k JOIN knowledge_fts f ON k.rowid = f.rowid WHERE knowledge_fts MATCH '${esc(expandedQuery)}'${typeFilter} ORDER BY rank LIMIT ${limit};`;

  try {
    const result = execSync(`sqlite3 -separator '|||' "${dbPath}" "${sql}"`, {
      encoding: 'utf-8',
      timeout: 3000,
    }).trim();
    if (!result) return [];

    return result.split('\n').map(line => {
      const [id, entryType, title, platform, createdAt] = line.split('|||');
      return { id, type: entryType, title, platform, createdAt };
    });
  } catch {
    return [];
  }
}

// --- Full Entry Retrieval ---

export function memoryGet(ids: string[]): KnowledgeEntry[] {
  ensureDbSchema();
  const dbPath = getDbPath();
  if (!existsSync(dbPath) || ids.length === 0) return [];

  const idList = ids.map(id => `'${esc(id)}'`).join(',');
  const sql = `SELECT id, type, platform, title, problem, solution, source_project, source_session, created_at, file_path FROM knowledge WHERE id IN (${idList});`;

  try {
    const result = execSync(`sqlite3 -separator '|||' "${dbPath}" "${sql}"`, {
      encoding: 'utf-8',
      timeout: 3000,
    }).trim();
    if (!result) return [];

    return result.split('\n').map(line => {
      const [id, type, platform, title, problem, solution, sourceProject, sourceSession, createdAt, filePath] = line.split('|||');
      return { id, type: type as any, platform, title, problem, solution, sourceProject, sourceSession, createdAt, filePath };
    });
  } catch {
    return [];
  }
}

// --- Extract knowledge from session summaries (batch backfill) ---

/**
 * Extract knowledge from recent session summaries (batch).
 * Called via dev_memory(action="extract") for retrospective processing.
 * Primary extraction already happens in session-summary.sh Stop hook.
 */
export function extractFromProject(dryRun: boolean = false): ConsolidationResult {
  ensureDbSchema();

  const dbPath = getDbPath();
  if (!existsSync(dbPath)) {
    return { success: false, message: 'NO_DB', data: { pitfalls: 0, patterns: 0, decisions: 0, skippedDuplicates: 0 } };
  }

  const project = getProjectName();
  const now = new Date().toISOString();
  let added = 0;
  let skippedDuplicates = 0;

  // Query session_summaries with non-empty learned field
  // that don't already have corresponding knowledge entries
  const sql = `SELECT id, session_id, project, learned FROM session_summaries
    WHERE learned IS NOT NULL AND learned != '' AND learned != 'null'
    AND id NOT IN (SELECT source_session FROM knowledge WHERE source_session LIKE 'summary-%')
    ORDER BY created_at_epoch DESC LIMIT 50;`;

  try {
    const result = execSync(`sqlite3 -separator '|||' "${dbPath}" "${sql}"`, {
      encoding: 'utf-8',
      timeout: 5000,
    }).trim();

    if (!result) {
      return { success: true, message: 'EXTRACTED:0|no unprocessed summaries', data: { pitfalls: 0, patterns: 0, decisions: 0, skippedDuplicates: 0 } };
    }

    for (const line of result.split('\n')) {
      const [summaryId, sessionId, summaryProject, learned] = line.split('|||');
      if (!learned || learned === 'null') {
        skippedDuplicates++;
        continue;
      }

      const entryId = generateId('discovery', learned.slice(0, 40));
      const entry: KnowledgeEntry = {
        id: entryId,
        type: 'decision',
        platform: 'general',
        title: learned.slice(0, 80),
        problem: learned,
        solution: '',
        sourceProject: summaryProject || project,
        sourceSession: summaryId,
        createdAt: now,
        filePath: '',
      };

      if (!dryRun) {
        writeKnowledgeEntry(entry);
        dbInsertKnowledge(entry);
      }
      added++;
    }
  } catch {
    // Query failed, return what we have
  }

  const mode = dryRun ? 'DRY_RUN' : 'EXTRACTED';
  return {
    success: true,
    message: `${mode}:${added}|discoveries:${added}|skipped:${skippedDuplicates}`,
    data: { pitfalls: 0, patterns: 0, decisions: added, skippedDuplicates },
  };
}

// --- Auto Memory Topic File Writer ---

/**
 * Derive the ~/.claude/projects/<hash>/memory/ directory for the current project.
 * Returns null if the directory does not exist (graceful degradation).
 */
function getAutoMemoryDir(): string | null {
  const projectDir = getCwd();
  // Claude's Auto Memory uses the path with slashes replaced by dashes
  const escapedPath = projectDir.replace(/\//g, '-').replace(/^-/, '');
  const memDir = join(homedir(), '.claude', 'projects', escapedPath, 'memory');
  return existsSync(memDir) ? memDir : null;
}

/**
 * After consolidation, write pitfalls.md / patterns.md / decisions.md
 * into the Auto Memory directory so Claude's built-in system can read them.
 */
function writeTopicFiles(memDir: string): void {
  const dbPath = getDbPath();
  if (!existsSync(dbPath)) return;

  const now = new Date().toISOString();
  const types: Array<'pitfall' | 'pattern' | 'decision'> = ['pitfall', 'pattern', 'decision'];
  const fileNames: Record<string, string> = {
    pitfall: 'pitfalls.md',
    pattern: 'patterns.md',
    decision: 'decisions.md',
  };
  const headings: Record<string, string> = {
    pitfall: 'Pitfalls',
    pattern: 'Patterns',
    decision: 'Decisions',
  };

  for (const type of types) {
    const sql = `SELECT platform, title, problem, solution, source_project, created_at, file_path FROM knowledge WHERE type = '${esc(type)}' ORDER BY created_at DESC LIMIT 50;`;
    let rows: Array<{ platform: string; title: string; problem: string; solution: string; sourceProject: string; createdAt: string; filePath: string }> = [];

    try {
      const result = execSync(`sqlite3 -separator '|||' "${dbPath}" "${sql}"`, {
        encoding: 'utf-8',
        timeout: 3000,
      }).trim();

      if (result) {
        rows = result.split('\n').map(line => {
          const [platform, title, problem, solution, sourceProject, createdAt, filePath] = line.split('|||');
          return { platform, title, problem, solution, sourceProject, createdAt, filePath };
        });
      }
    } catch {
      continue;
    }

    if (rows.length === 0) continue;

    const header = `# ${headings[type]}\n\nLast updated: ${now}\n\n`;
    const entries = rows.map(r => {
      const lines = [
        `## ${r.platform ? r.platform + ' — ' : ''}${r.title}`,
      ];
      if (r.problem) lines.push(r.problem.trim());
      const meta: string[] = [];
      if (r.sourceProject) meta.push(`Source: ${r.sourceProject}`);
      if (r.solution) meta.push(`Tags: ${r.solution.slice(0, 80)}`);
      if (meta.length > 0) lines.push(meta.join(' | '));
      lines.push('---');
      return lines.join('\n');
    });

    const content = header + entries.join('\n\n');
    const outPath = join(memDir, fileNames[type]);
    try {
      writeFileSync(outPath, content, 'utf-8');
    } catch {
      // Ignore write errors — graceful degradation
    }
  }
}

// --- Smart Dedup ---

interface DedupResult {
  action: 'ADD' | 'UPDATE' | 'NOOP';
  targetId?: string;
  reason: string;
  method: 'fts5' | 'token-overlap' | 'llm';
}

function extractKeyTerms(text: string): string[] {
  const stopWords = new Set(['the','a','an','is','are','was','were','be','been',
    'have','has','had','do','does','did','will','would','could','should',
    'and','or','but','in','on','at','to','for','of','with','by','from','as','it','this','that']);
  return text.toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter(w => w.length > 2 && !stopWords.has(w));
}

function tokenOverlap(textA: string, textB: string): number {
  const tokensA = new Set(extractKeyTerms(textA));
  const tokensB = new Set(extractKeyTerms(textB));
  if (tokensA.size === 0 || tokensB.size === 0) return 0;
  const intersection = [...tokensA].filter(t => tokensB.has(t)).length;
  const union = new Set([...tokensA, ...tokensB]).size;
  return intersection / union;
}

function smartDedup(
  newEntry: { type: string; title: string; content: string; platform: string },
  dbPath: string
): DedupResult {
  const keyTerms = extractKeyTerms(`${newEntry.title} ${newEntry.content}`);
  if (keyTerms.length === 0) {
    return { action: 'ADD', reason: 'No extractable terms', method: 'fts5' };
  }

  const ftsQuery = keyTerms.slice(0, 8).join(' OR ');
  let candidates: Array<{ id: string; title: string; content: string }> = [];
  try {
    const sql = `SELECT k.id, k.title, k.problem || ' ' || k.solution as content FROM knowledge k JOIN knowledge_fts f ON k.rowid = f.rowid WHERE knowledge_fts MATCH '${esc(ftsQuery)}' ORDER BY rank LIMIT 5;`;
    const result = execSync(`sqlite3 -separator '|||' "${dbPath}" "${sql}"`, {
      encoding: 'utf-8',
      timeout: 3000,
    }).trim();
    if (result) {
      candidates = result.split('\n').map(line => {
        const [id, title, content] = line.split('|||');
        return { id, title, content };
      });
    }
  } catch {
    return { action: 'ADD', reason: 'FTS5 query failed', method: 'fts5' };
  }

  if (candidates.length === 0) {
    return { action: 'ADD', reason: 'No FTS5 matches', method: 'fts5' };
  }

  const newText = `${newEntry.title} ${newEntry.content}`;
  for (const candidate of candidates) {
    const existingText = `${candidate.title} ${candidate.content}`;
    const overlap = tokenOverlap(newText, existingText);

    if (overlap > 0.7) {
      return { action: 'NOOP', targetId: candidate.id, reason: `Token overlap ${(overlap*100).toFixed(0)}%`, method: 'token-overlap' };
    }

    if (overlap > 0.3) {
      const llmResult = llmCompare(
        { type: newEntry.type, title: newEntry.title, content: newEntry.content },
        { id: candidate.id, type: 'knowledge', title: candidate.title, content: candidate.content }
      );
      if (llmResult) return llmResult;
      return { action: 'ADD', reason: `Overlap ${(overlap*100).toFixed(0)}%, no API key for disambiguation`, method: 'token-overlap' };
    }
  }

  return { action: 'ADD', reason: 'Low similarity to all candidates', method: 'fts5' };
}

function llmCompare(
  newEntry: { type: string; title: string; content: string },
  existing: { id: string; type: string; title: string; content: string }
): DedupResult | null {
  const apiKey = process.env.DEV_FLOW_API_KEY || process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return null;

  const apiUrl = process.env.DEV_FLOW_API_URL || 'https://api.anthropic.com/v1/messages';
  const model = process.env.DEV_FLOW_MODEL || 'claude-haiku-4-5-20251001';
  const isAnthropic = apiUrl.includes('api.anthropic.com');

  const prompt = `Are these the same knowledge? Reply ONLY: SAME or DIFFERENT
A: [${newEntry.type}] ${newEntry.title}: ${newEntry.content}
B: [${existing.type}] ${existing.title}: ${existing.content}`;

  try {
    const https = require('https');
    const url = new URL(apiUrl);
    const headers: Record<string, string> = { 'content-type': 'application/json' };
    if (isAnthropic) {
      headers['x-api-key'] = apiKey;
      headers['anthropic-version'] = '2023-06-01';
    } else {
      headers['authorization'] = `Bearer ${apiKey}`;
    }

    const body = JSON.stringify({
      model, max_tokens: 10,
      messages: [{ role: 'user', content: prompt }]
    });

    const result = execSync(
      `node -e "const https=require('https');const o={hostname:'${url.hostname}',port:${url.port || 443},path:'${url.pathname}',method:'POST',headers:${JSON.stringify(headers)},timeout:5000};const r=https.request(o,res=>{let d='';res.on('data',c=>d+=c);res.on('end',()=>process.stdout.write(d))});r.on('error',()=>process.exit(1));r.write(${JSON.stringify(body)});r.end()"`,
      { encoding: 'utf-8', timeout: 8000 }
    );
    const text = (JSON.parse(result)?.content?.[0]?.text || '').trim().toUpperCase();

    if (text.includes('SAME')) {
      return { action: 'NOOP', targetId: existing.id, reason: 'LLM confirmed duplicate', method: 'llm' };
    }
    return { action: 'ADD', reason: 'LLM confirmed different', method: 'llm' };
  } catch {
    return null;
  }
}

// Exposed for reasoning module and other modules to use
export { dbInsertReasoning, dbQueryReasoning, ensureDbSchema, getMemoryConfig, extractKeyTerms, tokenOverlap, smartDedup };
