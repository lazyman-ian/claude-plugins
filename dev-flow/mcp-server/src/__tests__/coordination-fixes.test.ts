/**
 * Coordination Fixes Tests
 * Verifies stub implementations: cancel, search, aggregate chain IDs, memory schema
 */

import { TaskCoordinator } from '../coordination/coordinator';
import { HandoffHub } from '../coordination/handoff-hub';
import { TaskItem, Handoff } from '../coordination/types';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

function makeTmpDir(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'coord-fixes-test-'));
}

describe('TaskCoordinator.cancel', () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = makeTmpDir();
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  test('cancel sets task status to cancelled', () => {
    const c = new TaskCoordinator(tmpDir);
    const task: TaskItem = {
      id: 'cancel-t1',
      description: 'Task to cancel',
      targetFiles: ['foo.ts'],
      dependencies: [],
      status: 'pending',
    };
    c.enqueue(task);
    const result = c.cancel('cancel-t1');
    expect(result).toBe(true);
    const found = c.getStatus().tasks.find(t => t.id === 'cancel-t1');
    expect(found?.status).toBe('cancelled');
  });

  test('cancel returns false for unknown task', () => {
    const c = new TaskCoordinator(tmpDir);
    expect(c.cancel('nonexistent')).toBe(false);
  });

  test('cancelled status persists after reload', () => {
    const c1 = new TaskCoordinator(tmpDir);
    c1.enqueue({ id: 'persist-cancel', description: 'x', targetFiles: [], dependencies: [], status: 'pending' });
    c1.cancel('persist-cancel');

    const c2 = new TaskCoordinator(tmpDir);
    const task = c2.getStatus().tasks.find(t => t.id === 'persist-cancel');
    expect(task?.status).toBe('cancelled');
  });
});

describe('HandoffHub.search', () => {
  let hub: HandoffHub;
  let baseDir: string;

  beforeEach(() => {
    baseDir = makeTmpDir();
    hub = new HandoffHub(baseDir);
  });

  afterEach(() => {
    fs.rmSync(baseDir, { recursive: true, force: true });
  });

  function makeHandoff(overrides: Partial<Handoff> = {}): Handoff {
    return {
      version: '2.0',
      agent_id: 'agent-001',
      task_id: 'TASK-100',
      timestamp: '2026-01-27T10:00:00Z',
      status: 'success',
      summary: 'Default summary',
      changes_made: [],
      decisions: {},
      verification: [],
      for_next_agent: '',
      open_questions: [],
      ...overrides,
    };
  }

  test('returns empty array when no handoffs directory', () => {
    const emptyHub = new HandoffHub(path.join(baseDir, 'nonexistent'));
    expect(emptyHub.search('anything')).toEqual([]);
  });

  test('returns empty array when no matches', () => {
    hub.write(makeHandoff({ summary: 'Authentication fix' }));
    const results = hub.search('database');
    expect(results).toHaveLength(0);
  });

  test('finds handoff matching keyword in summary', async () => {
    hub.write(makeHandoff({ summary: 'Implemented JWT authentication flow' }));
    await new Promise(r => setTimeout(r, 5));
    hub.write(makeHandoff({ summary: 'Database migration complete', task_id: 'TASK-101' }));

    const results = hub.search('JWT');
    expect(results).toHaveLength(1);
    expect(results[0].summary).toContain('JWT');
  });

  test('search is case-insensitive', () => {
    hub.write(makeHandoff({ summary: 'Fixed critical BUG in auth' }));
    const results = hub.search('bug');
    expect(results).toHaveLength(1);
  });

  test('returns handoffId, agentId, taskId, summary in results', () => {
    hub.write(makeHandoff({ agent_id: 'agent-search', task_id: 'TASK-999', summary: 'searchable content here' }));
    const results = hub.search('searchable');
    expect(results).toHaveLength(1);
    expect(results[0].handoffId).toMatch(/^handoff-.*\.md$/);
    expect(results[0].agentId).toBe('agent-search');
    expect(results[0].taskId).toBe('TASK-999');
    expect(results[0].summary).toContain('searchable');
  });
});

describe('HandoffHub.readChainWithIds', () => {
  let hub: HandoffHub;
  let baseDir: string;

  beforeEach(() => {
    baseDir = makeTmpDir();
    hub = new HandoffHub(baseDir);
  });

  afterEach(() => {
    fs.rmSync(baseDir, { recursive: true, force: true });
  });

  test('returns real file-based handoff IDs for taskId chain', async () => {
    const h1: Handoff = {
      version: '2.0', agent_id: 'a1', task_id: 'TASK-chain',
      timestamp: '2026-01-27T10:00:00Z', status: 'success',
      summary: 'Phase 1', changes_made: [], decisions: {},
      verification: [], for_next_agent: '', open_questions: [],
    };
    const id1 = hub.write(h1);
    await new Promise(r => setTimeout(r, 5));

    const h2: Handoff = { ...h1, agent_id: 'a2', summary: 'Phase 2' };
    const id2 = hub.write(h2);

    const chain = hub.readChainWithIds('TASK-chain');
    expect(chain).toHaveLength(2);
    expect(chain.map(c => c.handoffId)).toContain(id1);
    expect(chain.map(c => c.handoffId)).toContain(id2);
    // IDs must be real filenames (handoff-*.md), not timestamp field values
    chain.forEach(({ handoffId }) => {
      expect(handoffId).toMatch(/^handoff-\d{8}-\d{6}-\d{3}\.md$/);
    });
  });

  test('readChain still works (backward compat)', async () => {
    const h: Handoff = {
      version: '2.0', agent_id: 'compat', task_id: 'TASK-compat',
      timestamp: '2026-01-27T10:00:00Z', status: 'success',
      summary: 'Compat test', changes_made: [], decisions: {},
      verification: [], for_next_agent: '', open_questions: [],
    };
    hub.write(h);
    const chain = hub.readChain('TASK-compat');
    expect(chain).toHaveLength(1);
    expect(chain[0].agent_id).toBe('compat');
  });
});
