/**
 * Knowledge Storage Engine
 * Provides persistent, searchable knowledge entries via per-project SQLite.
 * Supports save, search (FTS5 with synonym expansion + temporal decay),
 * dedup (token overlap + optional LLM), and TTL pruning.
 */

import { execSync } from 'child_process';
import { existsSync, readdirSync, readFileSync, mkdirSync, statSync, writeFileSync, renameSync } from 'fs';
import { join, basename } from 'path';
import { detectPlatformSimple } from '../detector';

// --- Types ---

interface KnowledgeEntry {
  id: string;
  type: 'pitfall' | 'pattern' | 'decision' | 'habit';
  platform: string;
  title: string;
  problem: string;
  solution: string;
  sourceProject: string;
  sourceSession: string;
  createdAt: string;
  filePath: string;
}

interface MemoryStatus {
  totalEntries: number;
  byType: Record<string, number>;
  unprocessedHandoffs: number;
  knowledgeDir: string;
  vaultPath: string;
  vaultFiles: number;
}

// --- Helpers ---

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

function getProjectName(): string {
  const cwd = getCwd();
  return basename(cwd);
}

function generateId(type: string, title: string): string {
  const slug = title.toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 40);
  const ts = Date.now().toString(36);
  return `${type}-${slug}-${ts}`;
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
  file_path TEXT NOT NULL,
  access_count INTEGER DEFAULT 0,
  last_accessed TEXT
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

CREATE TABLE IF NOT EXISTS synonyms (
  term TEXT PRIMARY KEY,
  expansions TEXT NOT NULL
);

`;

  try {
    execSync(`sqlite3 "${dbPath}" "${schema.replace(/"/g, '\\"')}"`, {
      encoding: 'utf-8',
      timeout: 5000,
    });
  } catch {
    // DB may already have tables, ignore errors
  }

  // Migration: add access_count/last_accessed to existing knowledge tables
  try {
    execSync(`sqlite3 "${dbPath}" "ALTER TABLE knowledge ADD COLUMN access_count INTEGER DEFAULT 0;"`, { encoding: 'utf-8', timeout: 2000 });
  } catch { /* column already exists */ }
  try {
    execSync(`sqlite3 "${dbPath}" "ALTER TABLE knowledge ADD COLUMN last_accessed TEXT;"`, { encoding: 'utf-8', timeout: 2000 });
  } catch { /* column already exists */ }
  try {
    execSync(`sqlite3 "${dbPath}" "ALTER TABLE knowledge ADD COLUMN priority TEXT DEFAULT 'important';"`, { encoding: 'utf-8', timeout: 2000 });
  } catch { /* column already exists */ }

  seedSynonyms();
}

function dbInsertKnowledge(entry: KnowledgeEntry & { priority?: string }): boolean {
  const dbPath = getDbPath();
  if (!existsSync(dbPath)) return false;

  const priority = entry.priority || 'important';
  const sql = `INSERT OR IGNORE INTO knowledge (id, type, platform, title, problem, solution, source_project, source_session, created_at, file_path, access_count, last_accessed, priority) VALUES ('${esc(entry.id)}', '${esc(entry.type)}', '${esc(entry.platform)}', '${esc(entry.title)}', '${esc(entry.problem)}', '${esc(entry.solution)}', '${esc(entry.sourceProject)}', '${esc(entry.sourceSession)}', '${esc(entry.createdAt)}', '${esc(entry.filePath)}', 0, NULL, '${esc(priority)}');`;

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

function detectCurrentPlatform(): string {
  return detectPlatformSimple(getCwd());
}

// --- Vault helpers ---

function getVaultPath(): string {
  const cwd = getCwd();
  const configPath = join(cwd, '.dev-flow.json');
  try {
    const config = JSON.parse(readFileSync(configPath, 'utf-8'));
    if (config?.memory?.vault) return join(cwd, config.memory.vault);
  } catch {}
  return join(cwd, 'thoughts', 'knowledge');
}

export function parseFrontmatter(content: string): { data: Record<string, string>; body: string } {
  const match = content.match(/^---\n([\s\S]*?)\n---\n?([\s\S]*)$/);
  if (!match) return { data: {}, body: content };
  const data: Record<string, string> = {};
  for (const line of match[1].split('\n')) {
    const kv = line.match(/^(\w[\w-]*):\s*(.+)$/);
    if (kv) data[kv[1]] = kv[2].trim();
  }
  return { data, body: match[2] };
}

function generateFrontmatter(meta: { type: string; priority?: string; platform: string; tags?: string[]; created: string; access_count?: number }): string {
  const lines = ['---'];
  lines.push(`type: ${meta.type}`);
  lines.push(`priority: ${meta.priority || 'important'}`);
  lines.push(`platform: ${meta.platform}`);
  if (meta.tags?.length) lines.push(`tags: [${meta.tags.join(', ')}]`);
  lines.push(`created: ${meta.created}`);
  lines.push(`access_count: ${meta.access_count || 0}`);
  lines.push('---');
  return lines.join('\n');
}

function ensureVaultDirs(): void {
  const vault = getVaultPath();
  for (const dir of ['pitfalls', 'patterns', 'decisions', 'habits']) {
    mkdirSync(join(vault, dir), { recursive: true });
  }
}

function generateSlug(title: string): string {
  return title.toLowerCase().replace(/[^a-z0-9\u4e00-\u9fff]+/g, '-').replace(/^-|-$/g, '').slice(0, 60);
}

function countVaultFiles(): number {
  const vaultPath = getVaultPath();
  let count = 0;
  for (const dir of ['pitfalls', 'patterns', 'decisions', 'habits']) {
    const dirPath = join(vaultPath, dir);
    if (!existsSync(dirPath)) continue;
    for (const file of readdirSync(dirPath)) {
      if (file.endsWith('.md') && !file.startsWith('_')) count++;
    }
  }
  return count;
}

// --- Public API ---

export function memoryStatus(): MemoryStatus {
  const cwd = getCwd();
  const status: MemoryStatus = {
    totalEntries: 0,
    byType: { pitfall: 0, pattern: 0, decision: 0, habit: 0 },
    unprocessedHandoffs: 0,
    knowledgeDir: getDbPath(),
    vaultPath: getVaultPath(),
    vaultFiles: countVaultFiles(),
  };

  // Count knowledge entries from SQLite
  const dbPath = getDbPath();
  if (existsSync(dbPath)) {
    try {
      const countResult = execSync(
        `sqlite3 "${dbPath}" "SELECT type, COUNT(*) FROM knowledge GROUP BY type;"`,
        { encoding: 'utf-8', timeout: 3000 }
      ).trim();
      if (countResult) {
        for (const line of countResult.split('\n')) {
          const [type, countStr] = line.split('|');
          const count = parseInt(countStr, 10) || 0;
          if (type in status.byType) {
            status.byType[type] = count;
          }
          status.totalEntries += count;
        }
      }
    } catch { /* DB query failed, return zeros */ }
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

// --- Quality Gate ---

export function qualityCheck(text: string, title?: string): { pass: boolean; reason: string } {
  if (text.length < 20) return { pass: false, reason: 'Too short (<20 chars)' };

  if (/^(Significant|There were|Updated|Modified|Changed|Made|Added several|Removed several) /i.test(text))
    return { pass: false, reason: 'Generic description, not actionable knowledge' };

  if (/^\d+ (files?|insertions?|deletions?|changes?)/i.test(text))
    return { pass: false, reason: 'Statistics, not knowledge' };

  const words = text.toLowerCase().split(/\s+/).filter(w => w.length > 0);
  if (words.length > 10) {
    const ttr = new Set(words).size / words.length;
    if (ttr < 0.3) return { pass: false, reason: 'Low lexical diversity (repetitive content)' };
  }

  return { pass: true, reason: 'OK' };
}

// --- Ad-hoc Memory Storage ---

export function memorySave(text: string, title?: string, tags?: string[], type?: string, priority?: string): { id: string; message: string; saved?: boolean; reason?: string; filePath?: string } {
  ensureDbSchema();
  ensureVaultDirs();

  const project = getProjectName();
  const platform = detectCurrentPlatform();
  const autoTitle = title || text.slice(0, 60).replace(/\n/g, ' ').trim();
  const validTypes = ['pitfall', 'pattern', 'decision', 'habit'];
  const entryType = validTypes.includes(type || '') ? type! : 'decision';
  const validPriorities = ['critical', 'important', 'reference'];
  const entryPriority = validPriorities.includes(priority || '') ? priority! : 'important';

  // Quality gate
  const qc = qualityCheck(text, autoTitle);
  if (!qc.pass) {
    return { id: '', message: `Rejected: ${qc.reason}`, saved: false, reason: qc.reason };
  }

  // Smart dedup
  try {
    const dedupResult = smartDedup(
      { type: entryType, title: autoTitle, content: text, platform },
      getDbPath()
    );
    if (dedupResult.action === 'NOOP') {
      return { id: '', message: `Duplicate: ${dedupResult.reason} (${dedupResult.method})`, saved: false, reason: `Duplicate: ${dedupResult.reason}` };
    }
  } catch {}

  // Generate vault file
  const slug = generateSlug(autoTitle);
  const today = new Date().toISOString().slice(0, 10);
  const id = generateId(entryType, autoTitle);
  const typeDir = entryType === 'habit' ? 'habits' : `${entryType}s`;
  const filePath = join(getVaultPath(), typeDir, `${slug}.md`);

  const frontmatter = generateFrontmatter({
    type: entryType,
    priority: entryPriority,
    platform,
    tags,
    created: today,
    access_count: 0,
  });

  const mdContent = `${frontmatter}\n\n# ${autoTitle}\n\n${text}\n`;
  writeFileSync(filePath, mdContent, 'utf-8');

  // Also index in SQLite for fast search
  const entry: KnowledgeEntry & { priority?: string } = {
    id,
    type: entryType as any,
    platform,
    title: autoTitle,
    problem: text,
    solution: tags?.join(', ') || '',
    sourceProject: project,
    sourceSession: 'manual',
    createdAt: new Date().toISOString(),
    filePath,
    priority: entryPriority,
  };
  dbInsertKnowledge(entry);

  return { id, message: `Saved: ${autoTitle}`, saved: true, filePath };
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
  // Scoring: FTS rank * priority weight * temporal decay
  // Priority: critical=3x, important=2x, reference=1x
  // Temporal decay: 1/(1 + days_since_last_access/30)
  const sql = `SELECT k.id, k.type, k.title, k.platform, k.created_at
   FROM knowledge k JOIN knowledge_fts f ON k.rowid = f.rowid
   WHERE knowledge_fts MATCH '${esc(expandedQuery)}'${typeFilter}
   ORDER BY rank * CASE COALESCE(k.priority, 'important') WHEN 'critical' THEN 3.0 WHEN 'important' THEN 2.0 ELSE 1.0 END * (1.0 / (1.0 + COALESCE(julianday('now') - julianday(COALESCE(k.last_accessed, k.created_at)), 0) / 30.0))
   LIMIT ${limit};`;

  try {
    const result = execSync(`sqlite3 -separator '|||' "${dbPath}" "${sql}"`, {
      encoding: 'utf-8',
      timeout: 3000,
    }).trim();
    if (!result) return [];

    const entries = result.split('\n').map(line => {
      const [id, entryType, title, platform, createdAt] = line.split('|||');
      return { id, type: entryType, title, platform, createdAt };
    });

    // Touch last_accessed for retrieved entries
    if (entries.length > 0) {
      const idList = entries.map(e => `'${esc(e.id)}'`).join(',');
      try {
        execSync(`sqlite3 "${dbPath}" "UPDATE knowledge SET access_count = COALESCE(access_count, 0) + 1, last_accessed = datetime('now') WHERE id IN (${idList});"`, {
          encoding: 'utf-8', timeout: 2000,
        });
      } catch { /* non-critical */ }
    }

    return entries;
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

    const vaultPrefix = getVaultPath();
    return result.split('\n').map(line => {
      const [id, type, platform, title, problem, solution, sourceProject, sourceSession, createdAt, filePath] = line.split('|||');
      const entry: KnowledgeEntry = { id, type: type as any, platform, title, problem, solution, sourceProject, sourceSession, createdAt, filePath };

      // If entry has a vault file, read full content from the .md file
      if (filePath && filePath.startsWith(vaultPrefix) && existsSync(filePath)) {
        try {
          const content = readFileSync(filePath, 'utf-8');
          const { body } = parseFrontmatter(content);
          entry.problem = body.replace(/^#\s+.+\n+/, '').trim();
        } catch {}
      }

      return entry;
    });
  } catch {
    return [];
  }
}

// --- Vault File Priority Update ---

function updateVaultFilePriority(filePath: string, newPriority: string): void {
  if (!filePath || !existsSync(filePath)) return;
  try {
    const content = readFileSync(filePath, 'utf-8');
    const updated = content.replace(/^priority:\s*.+$/m, `priority: ${newPriority}`);
    if (updated !== content) writeFileSync(filePath, updated, 'utf-8');
  } catch {}
}

// --- Decay-based Pruning ---

export function memoryPrune(dryRun: boolean = false): { pruned: number; promoted: number; demoted: number; archived: number; message: string } {
  ensureDbSchema();
  const dbPath = getDbPath();
  if (!existsSync(dbPath)) return { pruned: 0, promoted: 0, demoted: 0, archived: 0, message: 'No database' };

  let promoted = 0, demoted = 0, archived = 0;

  // 1. Promote: access_count >= 3 AND priority != 'critical'
  try {
    const promoteQuery = `SELECT id, file_path FROM knowledge WHERE COALESCE(access_count, 0) >= 3 AND COALESCE(priority, 'important') != 'critical';`;
    const promoteResult = execSync(`sqlite3 -separator '|||' "${dbPath}" "${promoteQuery}"`, { encoding: 'utf-8', timeout: 3000 }).trim();
    if (promoteResult) {
      for (const line of promoteResult.split('\n')) {
        const [id, filePath] = line.split('|||');
        if (!dryRun) {
          execSync(`sqlite3 "${dbPath}" "UPDATE knowledge SET priority = 'critical' WHERE id = '${esc(id)}';"`, { encoding: 'utf-8', timeout: 2000 });
          updateVaultFilePriority(filePath, 'critical');
        }
        promoted++;
      }
    }
  } catch {}

  // 2. Demote: important + 0 access + >90 days → reference
  try {
    const demoteQuery = `SELECT id, file_path FROM knowledge WHERE COALESCE(priority, 'important') = 'important' AND COALESCE(access_count, 0) = 0 AND julianday('now') - julianday(created_at) > 90;`;
    const demoteResult = execSync(`sqlite3 -separator '|||' "${dbPath}" "${demoteQuery}"`, { encoding: 'utf-8', timeout: 3000 }).trim();
    if (demoteResult) {
      for (const line of demoteResult.split('\n')) {
        const [id, filePath] = line.split('|||');
        if (!dryRun) {
          execSync(`sqlite3 "${dbPath}" "UPDATE knowledge SET priority = 'reference' WHERE id = '${esc(id)}';"`, { encoding: 'utf-8', timeout: 2000 });
          updateVaultFilePriority(filePath, 'reference');
        }
        demoted++;
      }
    }
  } catch {}

  // 3. Archive: reference + 0 access + >90 days → move to .archive/
  try {
    const archiveQuery = `SELECT id, file_path FROM knowledge WHERE COALESCE(priority, 'important') = 'reference' AND COALESCE(access_count, 0) = 0 AND julianday('now') - julianday(created_at) > 90;`;
    const archiveResult = execSync(`sqlite3 -separator '|||' "${dbPath}" "${archiveQuery}"`, { encoding: 'utf-8', timeout: 3000 }).trim();
    if (archiveResult) {
      for (const line of archiveResult.split('\n')) {
        const [id, filePath] = line.split('|||');
        if (!dryRun) {
          if (filePath && existsSync(filePath)) {
            const archiveDir = join(getVaultPath(), '.archive');
            mkdirSync(archiveDir, { recursive: true });
            const archivePath = join(archiveDir, basename(filePath));
            renameSync(filePath, archivePath);
          }
          execSync(`sqlite3 "${dbPath}" "DELETE FROM knowledge WHERE id = '${esc(id)}';"`, { encoding: 'utf-8', timeout: 2000 });
        }
        archived++;
      }
    }
  } catch {}

  const total = promoted + demoted + archived;
  const parts: string[] = [];
  if (promoted > 0) parts.push(`${promoted} promoted to critical`);
  if (demoted > 0) parts.push(`${demoted} demoted to reference`);
  if (archived > 0) parts.push(`${archived} archived`);

  const prefix = dryRun ? 'Would: ' : '';
  const msg = parts.length > 0 ? `${prefix}${parts.join(', ')}` : 'No entries need maintenance';

  return { pruned: total, promoted, demoted, archived, message: msg };
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

    // Pass all dynamic values via JSON env to avoid shell injection (P0 fix)
    const opts = JSON.stringify({
      hostname: url.hostname, port: Number(url.port) || 443,
      path: url.pathname, method: 'POST', headers, timeout: 5000
    });
    const script = `const https=require('https');const o=JSON.parse(process.env.OPTS);const r=https.request(o,res=>{let d='';res.on('data',c=>d+=c);res.on('end',()=>process.stdout.write(d))});r.on('error',()=>process.exit(1));r.write(process.env.BODY);r.end()`;
    const result = execSync(`node -e "${script}"`, {
      encoding: 'utf-8', timeout: 8000,
      env: { ...process.env, OPTS: opts, BODY: body }
    });
    const text = (JSON.parse(result)?.content?.[0]?.text || '').trim().toUpperCase();

    if (text.includes('SAME')) {
      return { action: 'NOOP', targetId: existing.id, reason: 'LLM confirmed duplicate', method: 'llm' };
    }
    return { action: 'ADD', reason: 'LLM confirmed different', method: 'llm' };
  } catch {
    return null;
  }
}

// --- Vault Reindex ---

export function reindexVault(): { indexed: number; message: string } {
  ensureDbSchema();
  ensureVaultDirs();

  const vaultPath = getVaultPath();
  const dbPath = getDbPath();
  let indexed = 0;

  // Clear existing knowledge entries that came from vault
  try {
    execSync(`sqlite3 "${dbPath}" "DELETE FROM knowledge WHERE file_path LIKE '%${vaultPath.replace(/'/g, "''")}%';"`, {
      encoding: 'utf-8', timeout: 5000,
    });
    // Rebuild FTS index
    execSync(`sqlite3 "${dbPath}" "INSERT INTO knowledge_fts(knowledge_fts) VALUES('rebuild');"`, {
      encoding: 'utf-8', timeout: 5000,
    });
  } catch {}

  // Scan vault directories
  for (const typeDir of ['pitfalls', 'patterns', 'decisions', 'habits']) {
    const dirPath = join(vaultPath, typeDir);
    if (!existsSync(dirPath)) continue;

    for (const file of readdirSync(dirPath)) {
      if (!file.endsWith('.md') || file.startsWith('_')) continue;
      const filePath = join(dirPath, file);
      try {
        const content = readFileSync(filePath, 'utf-8');
        const { data, body } = parseFrontmatter(content);

        const entryType = data.type || typeDir.replace(/s$/, '');
        const titleMatch = body.match(/^#\s+(.+)$/m);
        const title = titleMatch?.[1] || file.replace('.md', '');
        const platform = data.platform || 'general';

        const id = generateId(entryType, title);
        const entry: KnowledgeEntry = {
          id,
          type: entryType as any,
          platform,
          title,
          problem: body.replace(/^#\s+.+\n+/, '').trim(),
          solution: data.tags || '',
          sourceProject: getProjectName(),
          sourceSession: 'vault',
          createdAt: data.created || new Date().toISOString().slice(0, 10),
          filePath,
        };
        dbInsertKnowledge(entry);
        indexed++;
      } catch {}
    }
  }

  return { indexed, message: `Reindexed ${indexed} entries from vault` };
}

// Exposed for other modules to use
export { ensureDbSchema, extractKeyTerms, tokenOverlap, smartDedup };
