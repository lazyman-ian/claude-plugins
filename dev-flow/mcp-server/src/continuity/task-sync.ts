/**
 * Task Sync - Bridge between Continuity Ledger and Claude Code Task Management
 *
 * Provides bidirectional sync:
 * - Ledger → Tasks: Export ledger state as task format
 * - Tasks → Ledger: Update ledger from task progress
 */

import { readFileSync, writeFileSync, existsSync } from 'fs';

interface TaskState {
  id: string;
  subject: string;
  status: 'pending' | 'in_progress' | 'completed';
  blockedBy?: string[];
}

interface LedgerTaskSync {
  ledgerPath: string;
  taskId: string;
  tasks: TaskState[];
  lastSync: string;
}

/**
 * Parse ledger State section to extract task-like items
 */
export function parseLedgerState(ledgerPath: string): TaskState[] {
  if (!existsSync(ledgerPath)) return [];

  const content = readFileSync(ledgerPath, 'utf-8');
  const tasks: TaskState[] = [];

  // Extract State section
  const stateMatch = content.match(/## State\s*\n([\s\S]*?)(?=\n## |$)/m);
  if (!stateMatch) return [];

  const stateContent = stateMatch[1];
  let currentSection: 'done' | 'now' | 'next' | null = null;
  let taskIndex = 0;

  for (const line of stateContent.split('\n')) {
    // Detect section headers
    if (line.match(/^\s*-?\s*Done:/i)) {
      currentSection = 'done';
      continue;
    }
    if (line.match(/^\s*-?\s*Now:/i)) {
      currentSection = 'now';
      continue;
    }
    if (line.match(/^\s*-?\s*Next:/i)) {
      currentSection = 'next';
      continue;
    }

    // Parse checkbox items
    const checkboxMatch = line.match(/^\s*-?\s*\[(x|→| )\]\s*(.+)$/i);
    if (checkboxMatch && currentSection) {
      const [, marker, subject] = checkboxMatch;
      taskIndex++;

      let status: TaskState['status'];
      if (marker.toLowerCase() === 'x') {
        status = 'completed';
      } else if (marker === '→') {
        status = 'in_progress';
      } else {
        status = 'pending';
      }

      tasks.push({
        id: `task-${taskIndex}`,
        subject: subject.trim(),
        status,
      });
    }
  }

  // Add dependencies (sequential by default)
  for (let i = 1; i < tasks.length; i++) {
    if (tasks[i].status === 'pending') {
      // Find last non-completed task before this one
      for (let j = i - 1; j >= 0; j--) {
        if (tasks[j].status !== 'completed') {
          tasks[i].blockedBy = [tasks[j].id];
          break;
        }
      }
    }
  }

  return tasks;
}

/**
 * Generate TaskCreate commands for ledger state
 */
export function generateTaskCommands(tasks: TaskState[]): string {
  const commands: string[] = [];

  for (const task of tasks) {
    if (task.status === 'completed') continue; // Skip completed tasks

    commands.push(`TaskCreate({
  subject: "${task.subject}",
  description: "From ledger state",
  activeForm: "${task.status === 'in_progress' ? task.subject : 'Waiting to start'}"
});`);
  }

  // Add dependency setup
  for (const task of tasks) {
    if (task.blockedBy && task.blockedBy.length > 0) {
      commands.push(`TaskUpdate({ taskId: "${task.id}", addBlockedBy: ${JSON.stringify(task.blockedBy)} });`);
    }
  }

  return commands.join('\n\n');
}

/**
 * Format tasks as markdown table for ledger
 */
export function formatTasksAsMarkdown(tasks: TaskState[]): string {
  if (tasks.length === 0) return 'No tasks defined.';

  const statusEmoji: Record<string, string> = {
    completed: '✅',
    in_progress: '→',
    pending: '⏳',
  };

  const lines = [
    '| ID | Subject | Status | Blocked By |',
    '|----|---------|--------|------------|',
  ];

  for (const task of tasks) {
    const blocked = task.blockedBy?.join(', ') || '-';
    lines.push(`| ${task.id} | ${task.subject} | ${statusEmoji[task.status]} ${task.status} | ${blocked} |`);
  }

  return lines.join('\n');
}

/**
 * Update ledger State section from task updates
 */
export function updateLedgerFromTasks(
  ledgerPath: string,
  taskUpdates: { id: string; status: TaskState['status'] }[]
): boolean {
  if (!existsSync(ledgerPath)) return false;

  let content = readFileSync(ledgerPath, 'utf-8');

  for (const update of taskUpdates) {
    // Map task ID to subject (simplified - in practice would need better mapping)
    const tasks = parseLedgerState(ledgerPath);
    const task = tasks.find(t => t.id === update.id);
    if (!task) continue;

    const subject = task.subject;
    const escapedSubject = subject.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

    // Update checkbox marker based on new status
    let newMarker: string;
    switch (update.status) {
      case 'completed':
        newMarker = '[x]';
        break;
      case 'in_progress':
        newMarker = '[→]';
        break;
      default:
        newMarker = '[ ]';
    }

    // Replace the checkbox for this task
    content = content.replace(
      new RegExp(`\\[(x|→| )\\]\\s*${escapedSubject}`, 'i'),
      `${newMarker} ${subject}`
    );
  }

  // Update timestamp
  content = content.replace(
    /^Updated:\s*.+$/m,
    `Updated: ${new Date().toISOString()}`
  );

  writeFileSync(ledgerPath, content);
  return true;
}

/**
 * Generate sync summary for dev_tasks tool
 */
export function getTaskSyncSummary(ledgerPath: string): string {
  const tasks = parseLedgerState(ledgerPath);

  if (tasks.length === 0) {
    return 'NO_TASKS|0 total';
  }

  const completed = tasks.filter(t => t.status === 'completed').length;
  const inProgress = tasks.filter(t => t.status === 'in_progress').length;
  const pending = tasks.filter(t => t.status === 'pending').length;

  return `TASKS|${tasks.length} total|${completed} done|${inProgress} active|${pending} pending`;
}

/**
 * Export ledger state as JSON for integration
 */
export function exportLedgerAsJson(ledgerPath: string): LedgerTaskSync | null {
  if (!existsSync(ledgerPath)) return null;

  const content = readFileSync(ledgerPath, 'utf-8');

  // Extract task ID from filename
  const taskIdMatch = ledgerPath.match(/TASK-\d+/);
  const taskId = taskIdMatch ? taskIdMatch[0] : 'unknown';

  return {
    ledgerPath,
    taskId,
    tasks: parseLedgerState(ledgerPath),
    lastSync: new Date().toISOString(),
  };
}
