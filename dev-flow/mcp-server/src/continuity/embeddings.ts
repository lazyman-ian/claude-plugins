/**
 * Embeddings Module — Optional ChromaDB integration for semantic search
 *
 * Design:
 * - Lazy initialization: only connect to ChromaDB when first query/insert
 * - Graceful degradation: if ChromaDB unavailable, returns null (caller falls back to FTS5)
 * - Embedding source: ChromaDB's built-in default embedding function
 *
 * Dependencies:
 * - chromadb (npm package) — optional, dynamically imported
 * - ChromaDB server running locally OR in-process SQLite mode
 */

import { mkdirSync } from 'fs';
import { join } from 'path';
import { homedir } from 'os';

interface SearchResult {
  id: string;
  distance: number;
  metadata: Record<string, any>;
}

interface EmbeddingConfig {
  enabled: boolean;
  persistPath: string;
}

export class SemanticSearch {
  private client: any = null;
  private collection: any = null;
  private initialized: boolean = false;
  private available: boolean = false;
  private config: EmbeddingConfig;

  constructor(config?: Partial<EmbeddingConfig>) {
    this.config = {
      enabled: config?.enabled ?? true,
      persistPath: config?.persistPath ?? join(homedir(), '.claude', 'cache', 'chroma'),
    };
  }

  /**
   * Lazy initialization — called on first search/insert
   * Returns true if ChromaDB is available, false otherwise
   */
  async initialize(): Promise<boolean> {
    if (this.initialized) return this.available;
    this.initialized = true;

    if (!this.config.enabled) {
      this.available = false;
      return false;
    }

    try {
      // Dynamic import to avoid hard dependency — chromadb is optional
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const moduleName = 'chromadb';
      const chromadb = await (Function('m', 'return import(m)')(moduleName) as Promise<any>);

      mkdirSync(this.config.persistPath, { recursive: true });

      this.client = new chromadb.ChromaClient({
        path: this.config.persistPath,
      });

      this.collection = await this.client.getOrCreateCollection({
        name: 'dev_flow_knowledge',
        metadata: { 'hnsw:space': 'cosine' },
      });

      this.available = true;
      return true;
    } catch {
      this.available = false;
      return false;
    }
  }

  isAvailable(): boolean {
    return this.available;
  }

  async addEntry(id: string, text: string, metadata: Record<string, any> = {}): Promise<boolean> {
    if (!await this.initialize()) return false;

    try {
      await this.collection.upsert({
        ids: [id],
        documents: [text],
        metadatas: [metadata],
      });
      return true;
    } catch {
      return false;
    }
  }

  async addEntries(entries: Array<{ id: string; text: string; metadata?: Record<string, any> }>): Promise<boolean> {
    if (!await this.initialize()) return false;
    if (entries.length === 0) return true;

    try {
      await this.collection.upsert({
        ids: entries.map(e => e.id),
        documents: entries.map(e => e.text),
        metadatas: entries.map(e => e.metadata || {}),
      });
      return true;
    } catch {
      return false;
    }
  }

  async search(query: string, limit: number = 10, filter?: Record<string, any>): Promise<SearchResult[]> {
    if (!await this.initialize()) return [];

    try {
      const options: any = {
        queryTexts: [query],
        nResults: limit,
      };

      if (filter && Object.keys(filter).length > 0) {
        options.where = filter;
      }

      const results = await this.collection.query(options);

      if (!results.ids?.[0]) return [];

      return results.ids[0].map((id: string, i: number) => ({
        id,
        distance: results.distances?.[0]?.[i] ?? 1.0,
        metadata: results.metadatas?.[0]?.[i] ?? {},
      }));
    } catch {
      return [];
    }
  }

  async getStats(): Promise<{ count: number; available: boolean }> {
    if (!await this.initialize()) {
      return { count: 0, available: false };
    }

    try {
      const count = await this.collection.count();
      return { count, available: true };
    } catch {
      return { count: 0, available: true };
    }
  }

  async deleteEntries(ids: string[]): Promise<boolean> {
    if (!await this.initialize()) return false;

    try {
      await this.collection.delete({ ids });
      return true;
    } catch {
      return false;
    }
  }

  async rebuildFromEntries(entries: Array<{
    id: string; title: string; problem: string; solution: string;
    type: string; platform: string; sourceProject: string; createdAt: string;
  }>): Promise<number> {
    if (!await this.initialize()) return 0;

    const batchSize = 100;
    let total = 0;

    for (let i = 0; i < entries.length; i += batchSize) {
      const batch = entries.slice(i, i + batchSize);
      const success = await this.addEntries(
        batch.map(e => ({
          id: e.id,
          text: `${e.title} ${e.problem} ${e.solution}`,
          metadata: {
            type: e.type,
            platform: e.platform,
            project: e.sourceProject,
            created_at: e.createdAt,
          },
        }))
      );
      if (success) total += batch.length;
    }

    return total;
  }
}

let instance: SemanticSearch | null = null;

export function getSemanticSearch(config?: Partial<EmbeddingConfig>): SemanticSearch {
  if (!instance) {
    instance = new SemanticSearch(config);
  }
  return instance;
}
