/**
 * Coordination Module Types
 * Type definitions for multi-agent collaboration
 */

export type TaskStatus = 'pending' | 'in_progress' | 'completed' | 'blocked' | 'failed';
export type HandoffStatus = 'success' | 'partial' | 'blocked' | 'failed';
export type CollaborationMode = 'pipeline' | 'fan-out' | 'master-worker' | 'review-chain';

export interface TaskItem {
  id: string;
  description: string;
  targetFiles: string[];
  dependencies: string[];
  agentId?: string;
  status: TaskStatus;
  metadata?: Record<string, any>;
}

export interface Conflict {
  file: string;
  tasks: string[];
}

export interface Handoff {
  version: string;
  agent_id: string;
  task_id: string;
  parent_handoff?: string;
  timestamp: string;
  status: HandoffStatus;
  summary: string;
  changes_made: string[];
  decisions: Record<string, string>;
  verification: string[];
  for_next_agent: string;
  open_questions: string[];
}

export interface HandoffResult {
  handoffId: string;
  status: HandoffStatus;
  summary: string;
}

export interface AggregatedResult {
  totalHandoffs: number;
  successCount: number;
  partialCount: number;
  blockedCount: number;
  failedCount: number;
  filesModified: string[];
  keyDecisions: Record<string, string>;
  openQuestions: string[];
  summary: string;
}

export interface CoordinationPlan {
  mode: CollaborationMode;
  tasks: TaskItem[];
  expectedParallelism: number;
}
