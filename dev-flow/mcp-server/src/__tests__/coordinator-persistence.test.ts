/**
 * TaskCoordinator Persistence Tests
 * Verifies file-backed state survives re-construction
 */

import { TaskCoordinator } from '../coordination/coordinator';
import { TaskItem, HandoffResult } from '../coordination/types';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

function makeTmpDir(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'coordinator-test-'));
}

describe('TaskCoordinator persistence', () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = makeTmpDir();
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  test('persists enqueued task and reloads after re-construction', () => {
    const task: TaskItem = {
      id: 'persist-1',
      description: 'Persistence test task',
      targetFiles: ['src/foo.ts'],
      dependencies: [],
      status: 'pending',
    };

    const c1 = new TaskCoordinator(tmpDir);
    c1.enqueue(task);

    const c2 = new TaskCoordinator(tmpDir);
    const status = c2.getStatus();
    expect(status.queuedTasks).toBe(1);
    expect(status.tasks.find(t => t.id === 'persist-1')).toBeDefined();
  });

  test('uses project-scoped path thoughts/.dev-flow-cache/coordinator.json', () => {
    const c = new TaskCoordinator(tmpDir);
    const task: TaskItem = {
      id: 'scope-1',
      description: 'Scope test',
      targetFiles: [],
      dependencies: [],
      status: 'pending',
    };
    c.enqueue(task);

    const expectedPath = path.join(tmpDir, 'thoughts', '.dev-flow-cache', 'coordinator.json');
    expect(fs.existsSync(expectedPath)).toBe(true);
  });

  test('atomic write: coordinator.json.tmp is not left behind', () => {
    const c = new TaskCoordinator(tmpDir);
    c.enqueue({ id: 'a1', description: 'x', targetFiles: [], dependencies: [], status: 'pending' });

    const tmpFile = path.join(tmpDir, 'thoughts', '.dev-flow-cache', 'coordinator.json.tmp');
    expect(fs.existsSync(tmpFile)).toBe(false);
  });

  test('recovers gracefully from corrupt persist file', () => {
    const cacheDir = path.join(tmpDir, 'thoughts', '.dev-flow-cache');
    fs.mkdirSync(cacheDir, { recursive: true });
    fs.writeFileSync(path.join(cacheDir, 'coordinator.json'), 'not valid json{{{{');

    expect(() => new TaskCoordinator(tmpDir)).not.toThrow();
    const c = new TaskCoordinator(tmpDir);
    expect(c.getStatus().tasks).toHaveLength(0);
  });

  test('recovers gracefully from missing persist file', () => {
    expect(() => new TaskCoordinator(tmpDir)).not.toThrow();
    const c = new TaskCoordinator(tmpDir);
    expect(c.getStatus().tasks).toHaveLength(0);
  });

  test('persists status update from onAgentComplete', () => {
    const task: TaskItem = {
      id: 'complete-1',
      description: 'Agent complete test',
      targetFiles: ['file.ts'],
      dependencies: [],
      agentId: 'agent-xyz',
      status: 'in_progress',
    };

    const c1 = new TaskCoordinator(tmpDir);
    c1.enqueue(task);

    const result: HandoffResult = { handoffId: 'h1', status: 'success', summary: 'Done' };
    c1.onAgentComplete('agent-xyz', result);

    const c2 = new TaskCoordinator(tmpDir);
    const updated = c2.getStatus().tasks.find(t => t.id === 'complete-1');
    expect(updated?.status).toBe('completed');
  });

  test('clear removes all tasks and persists empty state', () => {
    const c1 = new TaskCoordinator(tmpDir);
    c1.enqueue({ id: 'clr-1', description: 'x', targetFiles: [], dependencies: [], status: 'pending' });
    c1.clear();

    const c2 = new TaskCoordinator(tmpDir);
    expect(c2.getStatus().tasks).toHaveLength(0);
  });

  test('multiple projects do not collide when using different dirs', () => {
    const tmpDir2 = makeTmpDir();
    try {
      const c1 = new TaskCoordinator(tmpDir);
      const c2 = new TaskCoordinator(tmpDir2);

      c1.enqueue({ id: 'proj1-t1', description: 'proj1', targetFiles: [], dependencies: [], status: 'pending' });
      c2.enqueue({ id: 'proj2-t1', description: 'proj2', targetFiles: [], dependencies: [], status: 'pending' });

      const status1 = new TaskCoordinator(tmpDir).getStatus();
      const status2 = new TaskCoordinator(tmpDir2).getStatus();

      expect(status1.tasks.find(t => t.id === 'proj1-t1')).toBeDefined();
      expect(status1.tasks.find(t => t.id === 'proj2-t1')).toBeUndefined();
      expect(status2.tasks.find(t => t.id === 'proj2-t1')).toBeDefined();
    } finally {
      fs.rmSync(tmpDir2, { recursive: true, force: true });
    }
  });
});
