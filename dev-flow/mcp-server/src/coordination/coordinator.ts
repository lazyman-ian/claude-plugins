/**
 * Task Coordinator
 * Manages task queue, conflict detection, and agent completion
 * Persists to thoughts/.dev-flow-cache/coordinator.json
 */

import * as fs from 'fs';
import * as path from 'path';
import { TaskItem, Conflict, HandoffResult, TaskStatus } from './types';

export interface CoordinatorStatus {
  queuedTasks: number;
  activeTasks: number;
  completedTasks: number;
  tasks: TaskItem[];
}

export class TaskCoordinator {
  private tasks: Map<string, TaskItem> = new Map();
  private persistPath: string;

  constructor(projectDir?: string) {
    const base = projectDir || process.cwd();
    this.persistPath = path.join(base, 'thoughts', '.dev-flow-cache', 'coordinator.json');
    this.load();
  }

  private load(): void {
    try {
      if (!fs.existsSync(this.persistPath)) return;
      const raw = fs.readFileSync(this.persistPath, 'utf-8');
      const data: TaskItem[] = JSON.parse(raw);
      this.tasks = new Map(data.map(t => [t.id, t]));
    } catch {
      // Corrupt or missing file — start fresh
      this.tasks = new Map();
    }
  }

  private save(): void {
    try {
      const dir = path.dirname(this.persistPath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      const data = JSON.stringify(Array.from(this.tasks.values()), null, 2);
      const tmpPath = this.persistPath + '.tmp';
      fs.writeFileSync(tmpPath, data, 'utf-8');
      fs.renameSync(tmpPath, this.persistPath);
    } catch {
      // Non-fatal: in-memory state is still valid
    }
  }

  enqueue(task: TaskItem): void {
    this.tasks.set(task.id, task);
    this.save();
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
    this.save();
  }

  cancel(taskId: string): boolean {
    const task = this.tasks.get(taskId);
    if (!task) return false;
    this.tasks.set(taskId, { ...task, status: 'cancelled' as TaskStatus });
    this.save();
    return true;
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
    this.save();
  }
}
