/**
 * TaskCoordinator Tests
 */

import { TaskCoordinator } from './coordinator';
import { TaskItem, Conflict, HandoffResult } from './types';

describe('TaskCoordinator', () => {
  let coordinator: TaskCoordinator;

  beforeEach(() => {
    coordinator = new TaskCoordinator();
  });

  describe('enqueue', () => {
    test('should add task to queue', () => {
      const task: TaskItem = {
        id: 't1',
        description: 'Test task',
        targetFiles: ['file1.ts'],
        dependencies: [],
        status: 'pending'
      };

      coordinator.enqueue(task);
      const status = coordinator.getStatus();

      expect(status.queuedTasks).toBe(1);
      expect(status.tasks.find(t => t.id === 't1')).toBeDefined();
    });
  });

  describe('detectConflicts', () => {
    test('should detect file conflicts between tasks', () => {
      const tasks: TaskItem[] = [
        { id: 't1', description: 'Task 1', targetFiles: ['auth.ts'], dependencies: [], status: 'pending' },
        { id: 't2', description: 'Task 2', targetFiles: ['auth.ts'], dependencies: [], status: 'pending' }
      ];

      const conflicts = coordinator.detectConflicts(tasks);

      expect(conflicts).toHaveLength(1);
      expect(conflicts[0].file).toBe('auth.ts');
      expect(conflicts[0].tasks).toEqual(['t1', 't2']);
    });

    test('should not detect conflicts for different files', () => {
      const tasks: TaskItem[] = [
        { id: 't1', description: 'Task 1', targetFiles: ['auth.ts'], dependencies: [], status: 'pending' },
        { id: 't2', description: 'Task 2', targetFiles: ['user.ts'], dependencies: [], status: 'pending' }
      ];

      const conflicts = coordinator.detectConflicts(tasks);

      expect(conflicts).toHaveLength(0);
    });

    test('should detect multiple file conflicts', () => {
      const tasks: TaskItem[] = [
        { id: 't1', description: 'Task 1', targetFiles: ['auth.ts', 'user.ts'], dependencies: [], status: 'pending' },
        { id: 't2', description: 'Task 2', targetFiles: ['user.ts', 'role.ts'], dependencies: [], status: 'pending' },
        { id: 't3', description: 'Task 3', targetFiles: ['role.ts'], dependencies: [], status: 'pending' }
      ];

      const conflicts = coordinator.detectConflicts(tasks);

      expect(conflicts).toHaveLength(2);
      expect(conflicts.find(c => c.file === 'user.ts')).toBeDefined();
      expect(conflicts.find(c => c.file === 'role.ts')).toBeDefined();
    });
  });

  describe('onAgentComplete', () => {
    test('should update task status on completion', () => {
      const task: TaskItem = {
        id: 't1',
        description: 'Test task',
        targetFiles: ['file1.ts'],
        dependencies: [],
        agentId: 'agent-001',
        status: 'in_progress'
      };

      coordinator.enqueue(task);

      const result: HandoffResult = {
        handoffId: 'h1',
        status: 'success',
        summary: 'Completed successfully'
      };

      coordinator.onAgentComplete('agent-001', result);
      const status = coordinator.getStatus();
      const updatedTask = status.tasks.find(t => t.id === 't1');

      expect(updatedTask?.status).toBe('completed');
    });

    test('should handle partial completion', () => {
      const task: TaskItem = {
        id: 't1',
        description: 'Test task',
        targetFiles: ['file1.ts'],
        dependencies: [],
        agentId: 'agent-001',
        status: 'in_progress'
      };

      coordinator.enqueue(task);

      const result: HandoffResult = {
        handoffId: 'h1',
        status: 'partial',
        summary: 'Partially completed'
      };

      coordinator.onAgentComplete('agent-001', result);
      const status = coordinator.getStatus();
      const updatedTask = status.tasks.find(t => t.id === 't1');

      expect(updatedTask?.status).toBe('in_progress');
    });
  });
});
