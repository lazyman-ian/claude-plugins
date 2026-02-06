/**
 * Task Coordinator
 * Manages task queue, conflict detection, and agent completion
 */

import { TaskItem, Conflict, HandoffResult, TaskStatus } from './types';

export interface CoordinatorStatus {
  queuedTasks: number;
  activeTasks: number;
  completedTasks: number;
  tasks: TaskItem[];
}

export class TaskCoordinator {
  private tasks: Map<string, TaskItem> = new Map();

  enqueue(task: TaskItem): void {
    this.tasks.set(task.id, task);
  }

  detectConflicts(tasks: TaskItem[]): Conflict[] {
    const fileToTasks = new Map<string, string[]>();

    for (const task of tasks) {
      for (const file of task.targetFiles) {
        if (!fileToTasks.has(file)) {
          fileToTasks.set(file, []);
        }
        fileToTasks.get(file)!.push(task.id);
      }
    }

    const conflicts: Conflict[] = [];
    for (const [file, taskIds] of fileToTasks.entries()) {
      if (taskIds.length > 1) {
        conflicts.push({ file, tasks: taskIds });
      }
    }

    return conflicts;
  }

  onAgentComplete(agentId: string, result: HandoffResult): void {
    for (const [taskId, task] of this.tasks.entries()) {
      if (task.agentId === agentId && task.status === 'in_progress') {
        let newStatus: TaskStatus;

        switch (result.status) {
          case 'success':
            newStatus = 'completed';
            break;
          case 'blocked':
            newStatus = 'blocked';
            break;
          case 'failed':
            newStatus = 'failed';
            break;
          case 'partial':
          default:
            newStatus = 'in_progress';
        }

        this.tasks.set(taskId, { ...task, status: newStatus });
        break;
      }
    }
  }

  getStatus(): CoordinatorStatus {
    const tasks = Array.from(this.tasks.values());
    return {
      queuedTasks: tasks.filter(t => t.status === 'pending').length,
      activeTasks: tasks.filter(t => t.status === 'in_progress').length,
      completedTasks: tasks.filter(t => t.status === 'completed').length,
      tasks
    };
  }

  clear(): void {
    this.tasks.clear();
  }
}
