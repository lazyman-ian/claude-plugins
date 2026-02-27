/**
 * Instinct Extraction Engine
 * Clusters session observations into atomic behavioral instincts
 * that persist and strengthen across sessions.
 */

import { execSync } from 'child_process';
import { existsSync } from 'fs';
import { join } from 'path';

// --- Types ---

export interface Instinct {
  id: string;
  trigger: string;
  action: string;
  confidence: number;
  domain: string;
  source: 'session-observation' | 'user-correction' | 'manual';
  evidenceCount: number;
  lastSeen: string;
  examples: string[];
}

interface Observation {
  title: string;
  narrative: string;
  concepts: string;
}

// --- Helpers ---

function getDbPath(projectDir: string): string {
  return join(projectDir, '.claude', 'cache', 'artifact-index', 'context.db');
}

function esc(s: string): string {
  return (s || '').replace(/'/g, "''");
}

function dbQuery(dbPath: string, sql: string): string {
  try {
    return execSync(`sqlite3 -separator '|||' "${dbPath}" "${sql}"`, {
      encoding: 'utf-8',
      timeout: 5000,
    }).trim();
  } catch {
    return '';
  }
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

function ensureInstinctsTable(dbPath: string): void {
  const schema = `CREATE TABLE IF NOT EXISTS instincts (id TEXT PRIMARY KEY, trigger TEXT, action TEXT, confidence REAL, domain TEXT, source TEXT, evidence_count INTEGER, last_seen TEXT, examples TEXT);`;
  dbExec(dbPath, schema);
}

function hasObservationsTable(dbPath: string): boolean {
  const result = dbQuery(
    dbPath,
    `SELECT name FROM sqlite_master WHERE type='table' AND name='observations';`
  );
  return result.trim() === 'observations';
}

function loadObservations(dbPath: string): Observation[] {
  const result = dbQuery(
    dbPath,
    `SELECT title, narrative, concepts FROM observations ORDER BY created_at_epoch DESC LIMIT 200;`
  );
  if (!result) return [];

  return result.split('\n').map(line => {
    const [title, narrative, concepts] = line.split('|||');
    return { title: title || '', narrative: narrative || '', concepts: concepts || '' };
  }).filter(o => o.title || o.narrative);
}

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter(w => w.length > 3);
}

function sharedKeywords(a: string[], b: string[]): string[] {
  const setB = new Set(b);
  return a.filter(w => setB.has(w));
}

// --- Clustering ---

interface Cluster {
  keywords: string[];
  observations: Observation[];
}

function clusterObservations(observations: Observation[]): Cluster[] {
  // Tokenize each observation
  const tokenized = observations.map(o => ({
    obs: o,
    tokens: tokenize(`${o.title} ${o.narrative} ${o.concepts}`),
  }));

  const clusters: Cluster[] = [];
  const assigned = new Set<number>();

  for (let i = 0; i < tokenized.length; i++) {
    if (assigned.has(i)) continue;

    const cluster: Cluster = {
      keywords: tokenized[i].tokens,
      observations: [tokenized[i].obs],
    };
    assigned.add(i);

    for (let j = i + 1; j < tokenized.length; j++) {
      if (assigned.has(j)) continue;
      const shared = sharedKeywords(tokenized[i].tokens, tokenized[j].tokens);
      if (shared.length >= 2) {
        cluster.observations.push(tokenized[j].obs);
        assigned.add(j);
      }
    }

    // Only emit clusters with 3+ observations
    if (cluster.observations.length >= 3) {
      clusters.push(cluster);
    }
  }

  return clusters;
}

function deriveInstinct(cluster: Cluster): Instinct {
  // Use keyword frequency to derive trigger + action
  const allText = cluster.observations.map(o => `${o.title} ${o.narrative}`).join(' ');
  const tokens = tokenize(allText);

  // Count keyword frequencies
  const freq: Record<string, number> = {};
  for (const t of tokens) {
    freq[t] = (freq[t] || 0) + 1;
  }

  // Top keywords become the trigger
  const topKeywords = Object.entries(freq)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 4)
    .map(([k]) => k);

  // Derive domain from keyword set
  const domain = deriveDomain(topKeywords);

  // Build trigger and action from most common observation title
  const titleFreq: Record<string, number> = {};
  for (const o of cluster.observations) {
    titleFreq[o.title] = (titleFreq[o.title] || 0) + 1;
  }
  const topTitle = Object.entries(titleFreq).sort((a, b) => b[1] - a[1])[0]?.[0] || topKeywords.join(' ');

  const idBase = topKeywords.slice(0, 3).join('-').replace(/[^a-z0-9-]/g, '');
  // Add content hash suffix to prevent ID collision between clusters sharing top keywords
  const contentSig = cluster.observations.map(o => o.title).join('|');
  const hashSuffix = contentSig.split('').reduce((h, c) => ((h << 5) - h + c.charCodeAt(0)) | 0, 0).toString(36).replace('-', 'n');
  const id = (idBase ? `${idBase}-${hashSuffix}` : `instinct-${Date.now().toString(36)}`);
  const trigger = `when working with ${topKeywords.slice(0, 3).join(', ')}`;
  const action = topTitle.slice(0, 120);

  const examples = cluster.observations
    .slice(0, 5)
    .map(o => o.title.slice(0, 80))
    .filter(Boolean);

  return {
    id,
    trigger,
    action,
    confidence: Math.min(0.3 + cluster.observations.length * 0.1, 0.9),
    domain,
    source: 'session-observation',
    evidenceCount: cluster.observations.length,
    lastSeen: new Date().toISOString(),
    examples,
  };
}

function deriveDomain(keywords: string[]): string {
  const domainMap: Record<string, string[]> = {
    'swift-style': ['swift', 'guard', 'optional', 'closure', 'protocol'],
    'git-workflow': ['commit', 'branch', 'merge', 'rebase', 'push'],
    'testing': ['test', 'mock', 'assert', 'spec', 'unit'],
    'performance': ['performance', 'memory', 'optimize', 'cache', 'slow'],
    'android-kotlin': ['kotlin', 'android', 'compose', 'coroutine', 'flow'],
    'typescript': ['typescript', 'type', 'interface', 'generic', 'async'],
  };

  for (const [domain, markers] of Object.entries(domainMap)) {
    if (keywords.some(k => markers.includes(k))) {
      return domain;
    }
  }
  return 'general';
}

// --- DB read/write ---

function loadExistingInstinct(dbPath: string, id: string): Instinct | null {
  const result = dbQuery(
    dbPath,
    `SELECT id, trigger, action, confidence, domain, source, evidence_count, last_seen, examples FROM instincts WHERE id = '${esc(id)}';`
  );
  if (!result) return null;

  const [rid, trigger, action, confidence, domain, source, evidenceCount, lastSeen, examples] = result.split('|||');
  if (!rid) return null;

  return {
    id: rid,
    trigger,
    action,
    confidence: parseFloat(confidence) || 0,
    domain,
    source: source as Instinct['source'],
    evidenceCount: parseInt(evidenceCount, 10) || 0,
    lastSeen,
    examples: (() => { try { return JSON.parse(examples || '[]'); } catch { return []; } })(),
  };
}

function upsertInstinct(dbPath: string, instinct: Instinct): boolean {
  const existing = loadExistingInstinct(dbPath, instinct.id);
  let toWrite = instinct;

  if (existing) {
    toWrite = {
      ...existing,
      confidence: Math.min(existing.confidence + 0.1, 1.0),
      evidenceCount: existing.evidenceCount + instinct.evidenceCount,
      lastSeen: new Date().toISOString(),
      examples: [...new Set([...existing.examples, ...instinct.examples])].slice(0, 5),
    };
  }

  const sql = `INSERT OR REPLACE INTO instincts (id, trigger, action, confidence, domain, source, evidence_count, last_seen, examples) VALUES ('${esc(toWrite.id)}', '${esc(toWrite.trigger)}', '${esc(toWrite.action)}', ${toWrite.confidence}, '${esc(toWrite.domain)}', '${esc(toWrite.source)}', ${toWrite.evidenceCount}, '${esc(toWrite.lastSeen)}', '${esc(JSON.stringify(toWrite.examples))}');`;

  return dbExec(dbPath, sql);
}

// --- Public API ---

export function instinctExtract(projectDir: string): { success: boolean; extracted: number; message: string } {
  const dbPath = getDbPath(projectDir);

  if (!existsSync(dbPath)) {
    return { success: false, extracted: 0, message: 'No observations found. Enable Tier 3 in .dev-flow.json' };
  }

  if (!hasObservationsTable(dbPath)) {
    return { success: false, extracted: 0, message: 'No observations found. Enable Tier 3 in .dev-flow.json' };
  }

  const observations = loadObservations(dbPath);
  if (observations.length === 0) {
    return { success: true, extracted: 0, message: 'No observations to process yet. Run more sessions with Tier 3 enabled.' };
  }

  ensureInstinctsTable(dbPath);

  const clusters = clusterObservations(observations);
  if (clusters.length === 0) {
    return { success: true, extracted: 0, message: `Processed ${observations.length} observations. Not enough clustering to extract instincts (need 3+ similar observations).` };
  }

  let extracted = 0;
  for (const cluster of clusters) {
    const instinct = deriveInstinct(cluster);
    if (upsertInstinct(dbPath, instinct)) {
      extracted++;
    }
  }

  return { success: true, extracted, message: `Extracted ${extracted} instincts from ${observations.length} observations (${clusters.length} clusters).` };
}

export function instinctList(projectDir: string, domain?: string): Instinct[] {
  const dbPath = getDbPath(projectDir);

  if (!existsSync(dbPath)) return [];

  ensureInstinctsTable(dbPath);

  const whereClause = domain ? `WHERE domain = '${esc(domain)}'` : '';
  const result = dbQuery(
    dbPath,
    `SELECT id, trigger, action, confidence, domain, source, evidence_count, last_seen, examples FROM instincts ${whereClause} ORDER BY confidence DESC;`
  );

  if (!result) return [];

  return result.split('\n').map(line => {
    const [id, trigger, action, confidence, dom, source, evidenceCount, lastSeen, examples] = line.split('|||');
    if (!id) return null;
    return {
      id,
      trigger,
      action,
      confidence: parseFloat(confidence) || 0,
      domain: dom,
      source: source as Instinct['source'],
      evidenceCount: parseInt(evidenceCount, 10) || 0,
      lastSeen,
      examples: (() => { try { return JSON.parse(examples || '[]'); } catch { return []; } })(),
    } as Instinct;
  }).filter((i): i is Instinct => i !== null);
}
