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
`;

  try {
    execSync(`sqlite3 "${dbPath}" "${schema.replace(/"/g, '\\"')}"`, {
      encoding: 'utf-8',
      timeout: 5000,
    });
  } catch {
    // DB may already have tables, ignore errors
  }
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

// --- Source Scanners ---

function scanHandoffs(): Array<{ title: string; problem: string; solution: string; session: string; platform: string }> {
  const cwd = getCwd();
  const handoffsBase = join(cwd, 'thoughts', 'shared', 'handoffs');
  if (!existsSync(handoffsBase)) return [];

  const entries: Array<{ title: string; problem: string; solution: string; session: string; platform: string }> = [];

  for (const sessionDir of readdirSync(handoffsBase)) {
    const sessionPath = join(handoffsBase, sessionDir);
    if (!statSync(sessionPath).isDirectory()) continue;

    for (const file of readdirSync(sessionPath)) {
      if (!file.startsWith('auto-handoff-') || !file.endsWith('.md')) continue;

      const content = readFileSync(join(sessionPath, file), 'utf-8');
      const errorsMatch = content.match(/## Errors Encountered\n([\s\S]*?)(?=\n## |$)/);
      if (!errorsMatch) continue;

      const errorBlock = errorsMatch[1].trim();
      if (!errorBlock || errorBlock === 'No errors.') continue;

      // Extract error lines from code blocks
      const codeBlocks = errorBlock.match(/```[\s\S]*?```/g);
      if (!codeBlocks) continue;

      for (const block of codeBlocks) {
        const errorText = block.replace(/```/g, '').trim();
        if (errorText.length < 10) continue;

        const firstLine = errorText.split('\n')[0].slice(0, 80);
        entries.push({
          title: `Error: ${firstLine}`,
          problem: errorText.slice(0, 300),
          solution: 'See auto-handoff for context',
          session: sessionDir,
          platform: detectPlatformFromContent(content),
        });
      }
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

    // Priority 1: Failed attempts (anti-patterns)
    const failedMatch = content.match(/### Failed attempts\n([\s\S]*?)(?=### Summary|## |$)/);
    if (failedMatch) {
      const failedText = failedMatch[1].trim();
      if (failedText) {
        entries.push({
          title: `Failed approach: ${commitMsg.slice(0, 60)}`,
          problem: failedText.slice(0, 300),
          solution: `Resolved in commit ${commitDir.slice(0, 8)}`,
          session: commitDir.slice(0, 8),
        });
        continue;
      }
    }

    // Priority 2: Successful commits with file changes (decisions/patterns)
    const filesMatch = content.match(/## Files changed\n([\s\S]*?)(?=\n## |$)/);
    const files = filesMatch ? filesMatch[1].trim() : '';
    if (commitMsg && files) {
      entries.push({
        title: `Decision: ${commitMsg.slice(0, 60)}`,
        problem: `Files: ${files.slice(0, 200)}`,
        solution: commitMsg,
        session: commitDir.slice(0, 8),
      });
    }
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
    for (const line of lines) {
      // Look for resolved questions: lines starting with - [x] or ~~
      const resolvedMatch = line.match(/^-\s*\[x\]\s*(.+)/i) || line.match(/^-\s*~~(.+)~~/);
      if (!resolvedMatch) continue;

      const questionText = resolvedMatch[1].replace(/~~/g, '').trim();
      entries.push({
        title: `Decision: ${questionText.slice(0, 60)}`,
        problem: questionText,
        solution: 'Resolved during development',
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

  switch (entry.type) {
    case 'pitfall': {
      const platformDir = join(getKnowledgeDir(), 'platforms', entry.platform);
      mkdirSync(platformDir, { recursive: true });
      filePath = join(platformDir, 'pitfalls.md');
      const newEntry = `\n### ${entry.title}\n**Source**: ${entry.sourceProject}, ${entry.createdAt.slice(0, 10)}\n**Problem**: ${entry.problem}\n**Solution**: ${entry.solution}\n`;
      if (existsSync(filePath)) {
        const existing = readFileSync(filePath, 'utf-8');
        if (isDuplicate(existing, entry.title, entry.problem)) return;
        content = existing + newEntry;
      } else {
        content = `# ${entry.platform.toUpperCase()} Pitfalls\n` + newEntry;
      }
      break;
    }
    case 'pattern': {
      filePath = join(getKnowledgeDir(), 'patterns', `${entry.id}.md`);
      content = `# Pattern: ${entry.title}\n\n## Problem\n${entry.problem}\n\n## Solution\n${entry.solution}\n\n## Source\n${entry.sourceProject}, ${entry.createdAt.slice(0, 10)}\n`;
      break;
    }
    case 'decision': {
      const date = entry.createdAt.slice(0, 10);
      const slug = entry.title.toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 40);
      filePath = join(getKnowledgeDir(), 'discoveries', `${date}-${slug}.md`);
      content = `# Discovery: ${entry.title}\nDate: ${date}\nProject: ${entry.sourceProject}\n\n## What\n${entry.problem}\n\n## Resolution\n${entry.solution}\n`;
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
  return dbQueryKnowledge(query, limit);
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

// --- Extract from project (Phase 4 extension) ---

export function extractFromProject(dryRun: boolean = false): ConsolidationResult {
  ensureDbSchema();

  const cwd = getCwd();
  const project = getProjectName();
  const platform = detectCurrentPlatform();
  const now = new Date().toISOString();
  let pitfalls = 0, patterns = 0, decisions = 0, skippedDuplicates = 0;

  // 1. Scan CLAUDE.md "Known Pitfalls" section
  const claudeMdPath = join(cwd, 'CLAUDE.md');
  if (existsSync(claudeMdPath)) {
    const content = readFileSync(claudeMdPath, 'utf-8');
    const pitfallsMatch = content.match(/## (?:Known Pitfalls|已知陷阱)\n([\s\S]*?)(?=\n## |$)/i);
    if (pitfallsMatch) {
      const lines = pitfallsMatch[1].trim().split('\n');
      let currentTitle = '';
      let currentBody = '';

      for (const line of lines) {
        const headerMatch = line.match(/^###?\s+(.+)/);
        if (headerMatch) {
          if (currentTitle && currentBody) {
            const entry: KnowledgeEntry = {
              id: generateId('pitfall', currentTitle),
              type: 'pitfall',
              platform,
              title: currentTitle,
              problem: currentBody.slice(0, 300),
              solution: 'See CLAUDE.md',
              sourceProject: project,
              sourceSession: 'CLAUDE.md',
              createdAt: now,
              filePath: '',
            };

            const pitfallsPath = join(getKnowledgeDir(), 'platforms', platform, 'pitfalls.md');
            if (existsSync(pitfallsPath) && isDuplicate(readFileSync(pitfallsPath, 'utf-8'), entry.title, entry.problem)) {
              skippedDuplicates++;
            } else if (!dryRun) {
              writeKnowledgeEntry(entry);
              dbInsertKnowledge(entry);
              pitfalls++;
            } else {
              pitfalls++;
            }
          }
          currentTitle = headerMatch[1].trim();
          currentBody = '';
        } else {
          currentBody += line + '\n';
        }
      }

      // Last entry
      if (currentTitle && currentBody) {
        const entry: KnowledgeEntry = {
          id: generateId('pitfall', currentTitle),
          type: 'pitfall',
          platform,
          title: currentTitle,
          problem: currentBody.slice(0, 300),
          solution: 'See CLAUDE.md',
          sourceProject: project,
          sourceSession: 'CLAUDE.md',
          createdAt: now,
          filePath: '',
        };
        const pitfallsPath = join(getKnowledgeDir(), 'platforms', platform, 'pitfalls.md');
        if (existsSync(pitfallsPath) && isDuplicate(readFileSync(pitfallsPath, 'utf-8'), entry.title, entry.problem)) {
          skippedDuplicates++;
        } else if (!dryRun) {
          writeKnowledgeEntry(entry);
          dbInsertKnowledge(entry);
          pitfalls++;
        } else {
          pitfalls++;
        }
      }
    }
  }

  // 2. Scan ledger resolved questions → decisions
  for (const item of scanLedgers()) {
    if (dryRun) {
      decisions++;
      continue;
    }
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

  // 3. Scan reasoning → patterns
  for (const item of scanReasoning()) {
    if (dryRun) {
      patterns++;
      continue;
    }
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

  // 4. Also run standard consolidation (handoffs)
  for (const item of scanHandoffs()) {
    const pitfallsPath = join(getKnowledgeDir(), 'platforms', item.platform || platform, 'pitfalls.md');
    if (existsSync(pitfallsPath) && isDuplicate(readFileSync(pitfallsPath, 'utf-8'), item.title, item.problem)) {
      skippedDuplicates++;
      continue;
    }
    if (dryRun) {
      pitfalls++;
      continue;
    }
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
    writeKnowledgeEntry(entry);
    dbInsertKnowledge(entry);
    pitfalls++;
  }

  const total = pitfalls + patterns + decisions;
  const mode = dryRun ? 'DRY_RUN' : 'EXTRACTED';
  return {
    success: true,
    message: `${mode}:${total}|pitfalls:${pitfalls}|patterns:${patterns}|decisions:${decisions}|skipped:${skippedDuplicates}`,
    data: { pitfalls, patterns, decisions, skippedDuplicates },
  };
}

// Exposed for reasoning module to use
export { dbInsertReasoning, dbQueryReasoning, ensureDbSchema };
