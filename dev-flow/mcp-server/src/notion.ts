import * as fs from 'fs';
import * as path from 'path';

export interface NotionConfig {
  database_id: string;
  status_field: string;
  priority_field: string;
  type_field: string;
  platform_field: string;
}

export interface SpecFields {
  title: string;
  type: 'feature' | 'bug' | 'improvement' | 'tech-debt';
  priority: string;
  platform: string[];
  description: string;
  notion_url: string;
}

/**
 * Read Notion config from .dev-flow.json
 */
export function getNotionConfig(projectDir: string): NotionConfig | null {
  const configPath = path.join(projectDir, '.dev-flow.json');
  if (!fs.existsSync(configPath)) {
    return null;
  }
  try {
    const content = fs.readFileSync(configPath, 'utf-8');
    const config = JSON.parse(content);
    const notion = config.notion;
    if (!notion?.database_id) {
      return null;
    }
    return {
      database_id: notion.database_id,
      status_field: notion.status_field ?? 'Status',
      priority_field: notion.priority_field ?? 'Priority',
      type_field: notion.type_field ?? 'Type',
      platform_field: notion.platform_field ?? 'Platform',
    };
  } catch {
    return null;
  }
}

/**
 * Build a Notion database query filter from inbox parameters
 */
export function buildInboxFilter(options: {
  priority?: string;
  platform?: string;
  status?: string;
}): Record<string, any> {
  const conditions: Record<string, any>[] = [];

  if (options.status) {
    conditions.push({
      property: 'Status',
      status: { equals: options.status },
    });
  }

  if (options.priority) {
    conditions.push({
      property: 'Priority',
      select: { equals: options.priority },
    });
  }

  if (options.platform) {
    conditions.push({
      property: 'Platform',
      multi_select: { contains: options.platform },
    });
  }

  if (conditions.length === 0) {
    return {};
  }

  if (conditions.length === 1) {
    return { filter: conditions[0] };
  }

  return { filter: { and: conditions } };
}

/**
 * Format Notion page properties into a task summary markdown table
 */
export function formatTaskSummary(pages: any[]): string {
  if (pages.length === 0) {
    return 'No tasks found.';
  }

  const rows = pages.map((page) => {
    const props = page.properties ?? {};
    const title = extractTextProperty(props.Name ?? props.Title) ?? '(untitled)';
    const status = extractSelectProperty(props.Status) ?? '-';
    const priority = extractSelectProperty(props.Priority) ?? '-';
    const type = extractSelectProperty(props.Type) ?? '-';
    const url = page.url ?? '';
    return `| ${title} | ${status} | ${priority} | ${type} | ${url} |`;
  });

  const header = '| Title | Status | Priority | Type | URL |';
  const divider = '|-------|--------|----------|------|-----|';
  return [header, divider, ...rows].join('\n');
}

/**
 * Extract spec-relevant fields from a Notion page
 */
export function extractSpecFields(page: any): SpecFields {
  const props = page.properties ?? {};

  const title = extractTextProperty(props.Name ?? props.Title) ?? 'Untitled';
  const rawType = extractSelectProperty(props.Type) ?? '';
  const type = normalizeType(rawType);
  const priority = extractSelectProperty(props.Priority) ?? 'Medium';
  const platform = extractMultiSelectProperty(props.Platform);
  const description = extractTextProperty(props.Description ?? props.Summary) ?? '';
  const notion_url = page.url ?? '';

  return { title, type, priority, platform, description, notion_url };
}

/**
 * Update .dev-flow.json with Notion configuration
 */
export function updateNotionConfig(projectDir: string, config: Partial<NotionConfig>): void {
  const configPath = path.join(projectDir, '.dev-flow.json');
  let existing: Record<string, any> = {};

  if (fs.existsSync(configPath)) {
    try {
      existing = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
    } catch {
      // start fresh if corrupt
    }
  }

  existing.notion = { ...(existing.notion ?? {}), ...config };
  fs.writeFileSync(configPath, JSON.stringify(existing, null, 2) + '\n', 'utf-8');
}

// ---- helpers ----

function extractTextProperty(prop: any): string | undefined {
  if (!prop) return undefined;
  // title type
  if (Array.isArray(prop.title)) {
    return prop.title.map((t: any) => t.plain_text ?? '').join('') || undefined;
  }
  // rich_text type
  if (Array.isArray(prop.rich_text)) {
    return prop.rich_text.map((t: any) => t.plain_text ?? '').join('') || undefined;
  }
  return undefined;
}

function extractSelectProperty(prop: any): string | undefined {
  if (!prop) return undefined;
  // status type
  if (prop.status?.name) return prop.status.name;
  // select type
  if (prop.select?.name) return prop.select.name;
  return undefined;
}

function extractMultiSelectProperty(prop: any): string[] {
  if (!prop) return [];
  if (Array.isArray(prop.multi_select)) {
    return prop.multi_select.map((s: any) => s.name ?? '').filter(Boolean);
  }
  return [];
}

function normalizeType(raw: string): SpecFields['type'] {
  const lower = raw.toLowerCase();
  if (lower.includes('bug') || lower.includes('fix')) return 'bug';
  if (lower.includes('improvement') || lower.includes('enhance')) return 'improvement';
  if (lower.includes('tech') || lower.includes('debt') || lower.includes('refactor')) return 'tech-debt';
  return 'feature';
}
