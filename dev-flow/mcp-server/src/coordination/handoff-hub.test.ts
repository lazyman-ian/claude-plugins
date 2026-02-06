/**
 * HandoffHub Tests
 */

import { HandoffHub } from './handoff-hub';
import { Handoff, HandoffStatus } from './types';

describe('HandoffHub', () => {
  let hub: HandoffHub;
  const baseDir = '/tmp/test-handoffs';

  beforeEach(() => {
    hub = new HandoffHub(baseDir);
  });

  describe('write', () => {
    test('should write handoff and return ID', () => {
      const handoff: Handoff = {
        version: '2.0',
        agent_id: 'agent-001',
        task_id: 'TASK-123',
        timestamp: '2026-01-27T10:00:00Z',
        status: 'success',
        summary: 'Completed task',
        changes_made: ['file1.ts', 'file2.ts'],
        decisions: { 'auth-method': 'JWT' },
        verification: ['Tests pass'],
        for_next_agent: 'Continue with API',
        open_questions: []
      };

      const handoffId = hub.write(handoff);

      expect(handoffId).toMatch(/^handoff-\d{8}-\d{6}\.md$/);
    });
  });

  describe('read', () => {
    test('should read handoff by ID', () => {
      const handoff: Handoff = {
        version: '2.0',
        agent_id: 'agent-001',
        task_id: 'TASK-123',
        timestamp: '2026-01-27T10:00:00Z',
        status: 'success',
        summary: 'Completed task',
        changes_made: ['file1.ts'],
        decisions: {},
        verification: [],
        for_next_agent: 'Next steps',
        open_questions: []
      };

      const handoffId = hub.write(handoff);
      const retrieved = hub.read(handoffId);

      expect(retrieved.agent_id).toBe('agent-001');
      expect(retrieved.task_id).toBe('TASK-123');
      expect(retrieved.status).toBe('success');
    });
  });

  describe('readChain', () => {
    test('should read all handoffs for a task', () => {
      const handoff1: Handoff = {
        version: '2.0',
        agent_id: 'agent-001',
        task_id: 'TASK-123',
        timestamp: '2026-01-27T10:00:00Z',
        status: 'success',
        summary: 'Phase 1',
        changes_made: ['file1.ts'],
        decisions: {},
        verification: [],
        for_next_agent: 'Continue',
        open_questions: []
      };

      const handoff2: Handoff = {
        version: '2.0',
        agent_id: 'agent-002',
        task_id: 'TASK-123',
        parent_handoff: hub.write(handoff1),
        timestamp: '2026-01-27T11:00:00Z',
        status: 'success',
        summary: 'Phase 2',
        changes_made: ['file2.ts'],
        decisions: {},
        verification: [],
        for_next_agent: 'Done',
        open_questions: []
      };

      hub.write(handoff2);
      const chain = hub.readChain('TASK-123');

      expect(chain).toHaveLength(2);
      expect(chain[0].agent_id).toBe('agent-001');
      expect(chain[1].agent_id).toBe('agent-002');
    });
  });

  describe('aggregate', () => {
    test('should aggregate multiple handoffs', () => {
      const handoff1: Handoff = {
        version: '2.0',
        agent_id: 'agent-001',
        task_id: 'TASK-123',
        timestamp: '2026-01-27T10:00:00Z',
        status: 'success',
        summary: 'Part 1',
        changes_made: ['file1.ts'],
        decisions: { 'key1': 'value1' },
        verification: ['Test 1 pass'],
        for_next_agent: '',
        open_questions: ['Q1?']
      };

      const handoff2: Handoff = {
        version: '2.0',
        agent_id: 'agent-002',
        task_id: 'TASK-124',
        timestamp: '2026-01-27T11:00:00Z',
        status: 'partial',
        summary: 'Part 2',
        changes_made: ['file2.ts'],
        decisions: { 'key2': 'value2' },
        verification: ['Test 2 pass'],
        for_next_agent: '',
        open_questions: ['Q2?']
      };

      const id1 = hub.write(handoff1);
      const id2 = hub.write(handoff2);

      const result = hub.aggregate([id1, id2]);

      expect(result.totalHandoffs).toBe(2);
      expect(result.successCount).toBe(1);
      expect(result.partialCount).toBe(1);
      expect(result.filesModified).toEqual(['file1.ts', 'file2.ts']);
      expect(result.openQuestions).toEqual(['Q1?', 'Q2?']);
    });
  });
});
