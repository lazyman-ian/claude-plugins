/**
 * Product Brain
 * Accumulates domain knowledge from every implementation cycle.
 * After each spec→implement→PR cycle, knowledge about the product's
 * architecture, patterns, and domain concepts is extracted and stored.
 */

import { execSync } from 'child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs';
import { join, dirname } from 'path';
import { homedir } from 'os';

// --- Types ---

export interface ProductEntry {
  id: string;
  domain: string;      // e.g., 'ios', 'android', 'web', 'backend', 'shared'
  topic: string;       // e.g., 'authentication', 'navigation', 'data-layer'
  title: string;       // concise title
  content: string;     // detailed knowledge
  source: string;      // which spec/commit generated this
  created_at: string;
  updated_at: string;
}

// --- Helpers ---

function esc(s: string): string {
  return (s || '').replace(/'/g, "''");
}

function getDbPath(projectDir: string): string {
  return join(projectDir, '.claude', 'cache', 'artifact-index', 'context.db');
}

function generateId(): string {
  return `pb-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
}

function dbExec(dbPath: string, sql: string): boolean {
  try {
    execSync(`sqlite3 "${dbPath}" "${sql.replace(/"/g, '\\"')}"`, {
      encoding: 'utf-8',
      timeout: 5000,
    });
    return true;
  } catch {
    return false;
  }
}

function dbQuery(dbPath: string, sql: string): string {
  try {
    return execSync(`sqlite3 -separator '|||' "${dbPath}" "${sql.replace(/"/g, '\\"')}"`, {
      encoding: 'utf-8',
      timeout: 5000,
    }).trim();
  } catch {
    return '';
  }
}

function ensureProductBrainTable(dbPath: string): void {
  mkdirSync(dirname(dbPath), { recursive: true });
  const schema = `CREATE TABLE IF NOT EXISTS product_brain (id TEXT PRIMARY KEY, domain TEXT NOT NULL, topic TEXT NOT NULL, title TEXT NOT NULL, content TEXT NOT NULL, source TEXT NOT NULL, created_at TEXT NOT NULL, updated_at TEXT NOT NULL);`;
  dbExec(dbPath, schema);
}

function ensureDbDir(projectDir: string): void {
  const dbDir = join(projectDir, '.claude', 'cache', 'artifact-index');
  mkdirSync(dbDir, { recursive: true });
}

function inferDomainFromPath(filePath: string): string {
  const lower = filePath.toLowerCase();
  if (lower.includes('/ios/') || lower.includes('.swift') || lower.includes('xcodeproj') || lower.includes('appdelegate')) return 'ios';
  if (lower.includes('/android/') || lower.includes('.kt') || lower.includes('gradle') || lower.includes('androidmanifest')) return 'android';
  if (lower.includes('/web/') || lower.includes('.tsx') || lower.includes('.jsx') || lower.includes('react')) return 'web';
  if (lower.includes('/backend/') || lower.includes('/api/') || lower.includes('/server/') || lower.includes('.go') || lower.includes('.py')) return 'backend';
  return 'shared';
}

function inferTopicFromPath(filePath: string): string {
  const lower = filePath.toLowerCase();
  if (lower.includes('auth') || lower.includes('login') || lower.includes('session')) return 'authentication';
  if (lower.includes('nav') || lower.includes('router') || lower.includes('route')) return 'navigation';
  if (lower.includes('data') || lower.includes('model') || lower.includes('schema') || lower.includes('db') || lower.includes('repository')) return 'data-layer';
  if (lower.includes('ui') || lower.includes('view') || lower.includes('component') || lower.includes('screen')) return 'ui';
  if (lower.includes('network') || lower.includes('api') || lower.includes('request') || lower.includes('http')) return 'networking';
  if (lower.includes('test') || lower.includes('spec')) return 'testing';
  if (lower.includes('config') || lower.includes('setting') || lower.includes('env')) return 'configuration';
  return 'general';
}

// --- Public API ---

/**
 * Extract product knowledge from a completed implementation.
 * Reads recent commits, spec files, and code changes to identify domain knowledge.
 */
export function productExtract(projectDir: string, specPath?: string): ProductEntry[] {
  const dbPath = getDbPath(projectDir);
  ensureDbDir(projectDir);
  ensureProductBrainTable(dbPath);

  const entries: ProductEntry[] = [];
  const now = new Date().toISOString();

  // Read recent commits for context
  let recentCommits = '';
  try {
    recentCommits = execSync('git log --oneline -5 --name-only', {
      cwd: projectDir,
      encoding: 'utf-8',
      timeout: 5000,
    }).trim();
  } catch {
    return entries;
  }

  if (!recentCommits) return entries;

  // Parse commits and changed files
  const commitBlocks = recentCommits.split('\n\n').filter(Boolean);
  const filesByDomain = new Map<string, { files: string[]; commitMsg: string }>();

  for (const block of commitBlocks) {
    const lines = block.split('\n').filter(Boolean);
    if (lines.length === 0) continue;

    const commitMsg = lines[0].replace(/^[a-f0-9]+ /, '');
    const changedFiles = lines.slice(1);

    for (const file of changedFiles) {
      const domain = inferDomainFromPath(file);
      const topic = inferTopicFromPath(file);
      const key = `${domain}:${topic}`;

      if (!filesByDomain.has(key)) {
        filesByDomain.set(key, { files: [], commitMsg });
      }
      filesByDomain.get(key)!.files.push(file);
    }
  }

  // Read spec file if provided (use fs.readFileSync to avoid shell injection)
  let specContext = '';
  if (specPath && existsSync(specPath) && specPath.startsWith(projectDir)) {
    try {
      specContext = readFileSync(specPath, 'utf-8').split('\n').slice(0, 50).join('\n').trim();
    } catch {
      // ignore
    }
  }

  // Generate entries grouped by domain/topic
  for (const [key, { files, commitMsg }] of filesByDomain) {
    const [domain, topic] = key.split(':');
    const fileList = files.slice(0, 5).join(', ');
    const content = specContext
      ? `Files: ${fileList}\nCommit: ${commitMsg}\nSpec context: ${specContext.slice(0, 200)}`
      : `Files: ${fileList}\nCommit: ${commitMsg}`;

    entries.push({
      id: generateId(),
      domain,
      topic,
      title: `${commitMsg.slice(0, 60)}`,
      content,
      source: commitMsg.slice(0, 80),
      created_at: now,
      updated_at: now,
    });
  }

  return entries;
}

/**
 * Query product knowledge by domain and/or topic.
 */
export function productQuery(projectDir: string, options: { domain?: string; topic?: string; query?: string }): ProductEntry[] {
  const dbPath = getDbPath(projectDir);
  if (!existsSync(dbPath)) return [];

  ensureProductBrainTable(dbPath);

  const conditions: string[] = [];
  if (options.domain) conditions.push(`domain = '${esc(options.domain)}'`);
  if (options.topic) conditions.push(`topic = '${esc(options.topic)}'`);
  if (options.query) {
    const q = esc(options.query);
    conditions.push(`(title LIKE '%${q}%' OR content LIKE '%${q}%' OR topic LIKE '%${q}%')`);
  }

  const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
  const sql = `SELECT id, domain, topic, title, content, source, created_at, updated_at FROM product_brain ${where} ORDER BY updated_at DESC LIMIT 20;`;

  const result = dbQuery(dbPath, sql);
  if (!result) return [];

  return result.split('\n').map(line => {
    const [id, domain, topic, title, content, source, created_at, updated_at] = line.split('|||');
    if (!id) return null;
    return { id, domain, topic, title, content, source, created_at, updated_at } as ProductEntry;
  }).filter((e): e is ProductEntry => e !== null);
}

/**
 * Save a product knowledge entry.
 * Returns the generated ID.
 */
export function productSave(projectDir: string, entry: Omit<ProductEntry, 'id' | 'created_at' | 'updated_at'>): string {
  const dbPath = getDbPath(projectDir);
  ensureDbDir(projectDir);
  ensureProductBrainTable(dbPath);

  const id = generateId();
  const now = new Date().toISOString();

  const sql = `INSERT INTO product_brain (id, domain, topic, title, content, source, created_at, updated_at) VALUES ('${esc(id)}', '${esc(entry.domain)}', '${esc(entry.topic)}', '${esc(entry.title)}', '${esc(entry.content)}', '${esc(entry.source)}', '${esc(now)}', '${esc(now)}');`;

  dbExec(dbPath, sql);
  return id;
}

/**
 * Write product knowledge to Auto Memory topic files.
 * Writes to ~/.claude/projects/<project>/memory/product-{domain}.md
 */
export function productWriteTopicFiles(projectDir: string): void {
  const dbPath = getDbPath(projectDir);
  if (!existsSync(dbPath)) return;

  // Derive Auto Memory path
  const escapedPath = projectDir.replace(/\//g, '-').replace(/^-/, '');
  const memDir = join(homedir(), '.claude', 'projects', escapedPath, 'memory');
  if (!existsSync(memDir)) return;

  // Query all entries grouped by domain
  const sql = `SELECT DISTINCT domain FROM product_brain ORDER BY domain;`;
  const domainsResult = dbQuery(dbPath, sql);
  if (!domainsResult) return;

  const domains = domainsResult.split('\n').filter(Boolean);
  const now = new Date().toISOString();

  for (const domain of domains) {
    const entriesSql = `SELECT topic, title, content, source, updated_at FROM product_brain WHERE domain = '${esc(domain)}' ORDER BY updated_at DESC LIMIT 30;`;
    const entriesResult = dbQuery(dbPath, entriesSql);
    if (!entriesResult) continue;

    const rows = entriesResult.split('\n').filter(Boolean).map(line => {
      const [topic, title, content, source, updated_at] = line.split('|||');
      return { topic, title, content, source, updated_at };
    });

    const header = `# Product Knowledge: ${domain.charAt(0).toUpperCase() + domain.slice(1)}\nLast updated: ${now}\n\n`;
    const sections = rows.map(r => [
      `## ${r.topic} — ${r.title}`,
      r.content.trim(),
      `Source: ${r.source}`,
      '---',
    ].join('\n'));

    const fileContent = header + sections.join('\n\n');
    const outPath = join(memDir, `product-${domain}.md`);

    try {
      writeFileSync(outPath, fileContent, 'utf-8');
    } catch {
      // Graceful degradation
    }
  }
}
