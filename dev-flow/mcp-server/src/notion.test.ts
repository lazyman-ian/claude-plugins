/**
 * Notion module tests
 */

import * as fs from 'fs';
import * as path from 'path';
import {
  getNotionConfig,
  buildInboxFilter,
  formatTaskSummary,
  extractSpecFields,
  updateNotionConfig,
} from './notion';

vi.mock('fs');
vi.mock('path', async () => {
  const actual = await vi.importActual<typeof path>('path');
  return { ...actual };
});

const mockFs = vi.mocked(fs);

// ---- helpers ----

function setupConfig(projectDir: string, configObj: Record<string, any>) {
  const configPath = `${projectDir}/.dev-flow.json`;
  mockFs.existsSync.mockImplementation((p) => p.toString() === configPath);
  mockFs.readFileSync.mockImplementation((p: fs.PathOrFileDescriptor, _opts?: unknown) => {
    if (p.toString() === configPath) return JSON.stringify(configObj);
    throw new Error(`ENOENT: ${p}`);
  });
}

function makePage(overrides: Record<string, any> = {}): any {
  return {
    url: 'https://notion.so/page-123',
    properties: {
      Name: { title: [{ plain_text: 'My Feature' }] },
      Status: { status: { name: 'In Progress' } },
      Priority: { select: { name: 'High' } },
      Type: { select: { name: 'feature' } },
      Platform: { multi_select: [{ name: 'iOS' }, { name: 'Android' }] },
      Description: { rich_text: [{ plain_text: 'Some description here' }] },
      ...overrides.properties,
    },
    ...overrides,
  };
}

// ---- getNotionConfig ----

describe('getNotionConfig', () => {
  beforeEach(() => vi.resetAllMocks());

  test('returns null when .dev-flow.json does not exist', () => {
    mockFs.existsSync.mockReturnValue(false);
    expect(getNotionConfig('/some/project')).toBeNull();
  });

  test('returns null when notion section is absent', () => {
    setupConfig('/some/project', { platform: 'ios', commands: { fix: 'x', check: 'y' } });
    expect(getNotionConfig('/some/project')).toBeNull();
  });

  test('returns null when database_id is missing', () => {
    setupConfig('/some/project', { notion: { status_field: 'Status' } });
    expect(getNotionConfig('/some/project')).toBeNull();
  });

  test('returns config with defaults when only database_id is set', () => {
    setupConfig('/some/project', { notion: { database_id: 'abc-123' } });
    const cfg = getNotionConfig('/some/project');
    expect(cfg).not.toBeNull();
    expect(cfg?.database_id).toBe('abc-123');
    expect(cfg?.status_field).toBe('Status');
    expect(cfg?.priority_field).toBe('Priority');
    expect(cfg?.type_field).toBe('Type');
    expect(cfg?.platform_field).toBe('Platform');
  });

  test('returns config with custom field names', () => {
    setupConfig('/some/project', {
      notion: {
        database_id: 'db-456',
        status_field: 'State',
        priority_field: 'Urgency',
        type_field: 'Category',
        platform_field: 'OS',
      },
    });
    const cfg = getNotionConfig('/some/project');
    expect(cfg?.status_field).toBe('State');
    expect(cfg?.priority_field).toBe('Urgency');
  });

  test('returns null when JSON is malformed', () => {
    const configPath = '/some/project/.dev-flow.json';
    mockFs.existsSync.mockImplementation((p) => p.toString() === configPath);
    mockFs.readFileSync.mockReturnValue('{ bad json }');
    expect(getNotionConfig('/some/project')).toBeNull();
  });
});

// ---- buildInboxFilter ----

describe('buildInboxFilter', () => {
  test('returns empty object when no options provided', () => {
    expect(buildInboxFilter({})).toEqual({});
  });

  test('builds status filter', () => {
    const result = buildInboxFilter({ status: 'In Progress' });
    expect(result).toEqual({
      filter: {
        property: 'Status',
        status: { equals: 'In Progress' },
      },
    });
  });

  test('builds priority filter', () => {
    const result = buildInboxFilter({ priority: 'High' });
    expect(result).toEqual({
      filter: {
        property: 'Priority',
        select: { equals: 'High' },
      },
    });
  });

  test('builds platform filter', () => {
    const result = buildInboxFilter({ platform: 'iOS' });
    expect(result).toEqual({
      filter: {
        property: 'Platform',
        multi_select: { contains: 'iOS' },
      },
    });
  });

  test('combines multiple filters with AND', () => {
    const result = buildInboxFilter({ priority: 'High', status: 'Todo' });
    expect(result.filter).toHaveProperty('and');
    expect(result.filter.and).toHaveLength(2);
  });

  test('combines all three filters with AND', () => {
    const result = buildInboxFilter({ priority: 'High', platform: 'iOS', status: 'In Progress' });
    expect(result.filter.and).toHaveLength(3);
  });
});

// ---- formatTaskSummary ----

describe('formatTaskSummary', () => {
  test('returns "No tasks found." for empty array', () => {
    expect(formatTaskSummary([])).toBe('No tasks found.');
  });

  test('returns markdown table with header', () => {
    const result = formatTaskSummary([makePage()]);
    expect(result).toContain('| Title |');
    expect(result).toContain('My Feature');
    expect(result).toContain('In Progress');
    expect(result).toContain('High');
  });

  test('handles pages without url', () => {
    const page = makePage({ url: undefined });
    const result = formatTaskSummary([page]);
    expect(result).toContain('My Feature');
  });

  test('handles multiple pages', () => {
    const pages = [makePage(), makePage({ properties: { Name: { title: [{ plain_text: 'Bug Fix' }] } } })];
    const result = formatTaskSummary(pages);
    expect(result).toContain('My Feature');
    expect(result).toContain('Bug Fix');
  });
});

// ---- extractSpecFields ----

describe('extractSpecFields', () => {
  test('extracts all fields from a complete page', () => {
    const spec = extractSpecFields(makePage());
    expect(spec.title).toBe('My Feature');
    expect(spec.type).toBe('feature');
    expect(spec.priority).toBe('High');
    expect(spec.platform).toEqual(['iOS', 'Android']);
    expect(spec.description).toBe('Some description here');
    expect(spec.notion_url).toBe('https://notion.so/page-123');
  });

  test('defaults type to "feature" for unknown type string', () => {
    const page = makePage({ properties: { Type: { select: { name: 'unknown-xyz' } } } });
    expect(extractSpecFields(page).type).toBe('feature');
  });

  test('maps bug type correctly', () => {
    const page = makePage({ properties: { Type: { select: { name: 'Bug' } } } });
    expect(extractSpecFields(page).type).toBe('bug');
  });

  test('maps tech-debt type correctly', () => {
    const page = makePage({ properties: { Type: { select: { name: 'Tech Debt' } } } });
    expect(extractSpecFields(page).type).toBe('tech-debt');
  });

  test('maps improvement type correctly', () => {
    const page = makePage({ properties: { Type: { select: { name: 'Enhancement' } } } });
    expect(extractSpecFields(page).type).toBe('improvement');
  });

  test('handles missing fields gracefully with defaults', () => {
    const spec = extractSpecFields({ properties: {} });
    expect(spec.title).toBe('Untitled');
    expect(spec.priority).toBe('Medium');
    expect(spec.platform).toEqual([]);
    expect(spec.description).toBe('');
    expect(spec.notion_url).toBe('');
  });

  test('handles page with no properties key', () => {
    const spec = extractSpecFields({});
    expect(spec.title).toBe('Untitled');
    expect(spec.platform).toEqual([]);
  });
});

// ---- updateNotionConfig ----

describe('updateNotionConfig', () => {
  beforeEach(() => vi.resetAllMocks());

  test('creates .dev-flow.json with notion section when file does not exist', () => {
    const configPath = '/my/project/.dev-flow.json';
    mockFs.existsSync.mockReturnValue(false);

    let written = '';
    mockFs.writeFileSync.mockImplementation((_p, data) => {
      written = data as string;
    });

    updateNotionConfig('/my/project', { database_id: 'db-new' });

    const parsed = JSON.parse(written);
    expect(parsed.notion.database_id).toBe('db-new');
  });

  test('merges into existing .dev-flow.json preserving other keys', () => {
    const configPath = '/my/project/.dev-flow.json';
    const existing = { platform: 'ios', commands: { fix: 'x', check: 'y' } };
    mockFs.existsSync.mockImplementation((p) => p.toString() === configPath);
    mockFs.readFileSync.mockReturnValue(JSON.stringify(existing));

    let written = '';
    mockFs.writeFileSync.mockImplementation((_p, data) => {
      written = data as string;
    });

    updateNotionConfig('/my/project', { database_id: 'db-123', status_field: 'State' });

    const parsed = JSON.parse(written);
    expect(parsed.platform).toBe('ios');
    expect(parsed.notion.database_id).toBe('db-123');
    expect(parsed.notion.status_field).toBe('State');
  });

  test('merges partial config into existing notion section', () => {
    const configPath = '/my/project/.dev-flow.json';
    const existing = { notion: { database_id: 'db-old', status_field: 'Status' } };
    mockFs.existsSync.mockImplementation((p) => p.toString() === configPath);
    mockFs.readFileSync.mockReturnValue(JSON.stringify(existing));

    let written = '';
    mockFs.writeFileSync.mockImplementation((_p, data) => {
      written = data as string;
    });

    updateNotionConfig('/my/project', { database_id: 'db-new' });

    const parsed = JSON.parse(written);
    expect(parsed.notion.database_id).toBe('db-new');
    expect(parsed.notion.status_field).toBe('Status');
  });
});
