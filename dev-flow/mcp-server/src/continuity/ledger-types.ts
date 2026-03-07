/**
 * Ledger v2 TypeScript interfaces
 * Structured gate/decision data for agentic loop tracking
 */

export interface GateRecord {
  gate: string;
  result: 'pass' | 'fail' | 'skip';
  detail?: string;
  duration_ms?: number;
}

export interface DecisionRecord {
  question: string;
  decision: string;
  escalated: boolean;
}

export interface LedgerTaskEntry {
  id: string;
  name: string;
  status: 'done' | 'in_progress' | 'pending';
  timestamp?: string;
  gates?: GateRecord[];
  retries?: number;
  duration_ms?: number;
  decisions?: DecisionRecord[];
}
