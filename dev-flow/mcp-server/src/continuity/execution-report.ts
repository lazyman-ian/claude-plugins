/**
 * Execution Report Generator
 * Generates a markdown report from v2 ledger gate data and .proof/ manifests.
 */

import { execSync } from 'child_process';
import { existsSync, readFileSync, writeFileSync, readdirSync, mkdirSync } from 'fs';
import { join } from 'path';
import { parseLedgerV2 } from './ledger';

// --- Helpers ---

function getCwd(): string {
  try {
    return execSync('git rev-parse --show-toplevel', { encoding: 'utf-8' }).trim();
  } catch {
    return process.cwd();
  }
}

interface ProofManifest {
  taskId: string;
  verdict: string;
  commands?: string[];
  diff_stats?: string;
}

function loadProofManifests(proofDir: string): ProofManifest[] {
  if (!existsSync(proofDir)) return [];
  const manifests: ProofManifest[] = [];
  for (const file of readdirSync(proofDir)) {
    if (!file.endsWith('.json')) continue;
    try {
      const content = readFileSync(join(proofDir, file), 'utf-8');
      manifests.push(JSON.parse(content));
    } catch { /* skip malformed */ }
  }
  return manifests;
}

// --- Public API ---

export interface ExecutionReportResult {
  reportPath: string;
  summary: string;
}

/**
 * Generate an execution report from a v2 ledger file and associated .proof/ manifests.
 * Writes the report to .proof/execution-report.md and returns summary text.
 */
export function generateExecutionReport(ledgerPath: string): ExecutionReportResult {
  const cwd = getCwd();
  const proofDir = join(cwd, '.proof');

  if (!existsSync(ledgerPath)) {
    return { reportPath: '', summary: 'Ledger not found' };
  }

  const content = readFileSync(ledgerPath, 'utf-8');
  const entries = parseLedgerV2(content);

  // Task completion summary
  const done = entries.filter(e => e.status === 'done').length;
  const skipped = entries.filter(e => e.status === 'pending').length;
  const inProgress = entries.filter(e => e.status === 'in_progress').length;
  const total = entries.length;

  // Gate pass rates per gate type
  const gateStats: Record<string, { pass: number; fail: number; skip: number; total: number }> = {};
  for (const entry of entries) {
    for (const g of (entry.gates || [])) {
      if (!gateStats[g.gate]) gateStats[g.gate] = { pass: 0, fail: 0, skip: 0, total: 0 };
      gateStats[g.gate].total++;
      if (g.result === 'pass') gateStats[g.gate].pass++;
      else if (g.result === 'fail') gateStats[g.gate].fail++;
      else if (g.result === 'skip') gateStats[g.gate].skip++;
    }
  }

  // Self-healing stats
  let totalRetries = 0;
  let tasksWithRetries = 0;
  for (const entry of entries) {
    if (entry.retries && entry.retries > 0) {
      totalRetries += entry.retries;
      tasksWithRetries++;
    }
  }

  // Decision agent usage
  let totalDecisions = 0;
  let escalatedDecisions = 0;
  for (const entry of entries) {
    if (entry.decisions) {
      totalDecisions += entry.decisions.length;
      escalatedDecisions += entry.decisions.filter(d => d.escalated).length;
    }
  }

  // Top pitfalls: tasks with spec fail > 1 or high retry count
  const pitfalls: string[] = [];
  for (const entry of entries) {
    const specGate = (entry.gates || []).find(g => g.gate === 'spec');
    if (specGate) {
      const failRounds = specGate.detail?.match(/r(\d+)/) ? parseInt(specGate.detail!.match(/r(\d+)/)![1], 10) : 0;
      if (failRounds > 1) {
        pitfalls.push(`Task ${entry.id} (${entry.name}): spec-review failed ${failRounds} rounds`);
      }
    }
    if (entry.retries && entry.retries > 1) {
      pitfalls.push(`Task ${entry.id} (${entry.name}): ${entry.retries} verify retries`);
    }
  }

  // Load proof manifests
  const manifests = loadProofManifests(proofDir);
  const verifiedTasks = manifests.filter(m => m.verdict === 'pass').length;

  // Build markdown report
  const lines: string[] = [
    '# Execution Report',
    '',
    `Generated: ${new Date().toISOString()}`,
    '',
    '## Task Completion',
    '',
    `- Total: ${total}`,
    `- Done: ${done}`,
    `- In Progress: ${inProgress}`,
    `- Skipped/Pending: ${skipped}`,
    ...(manifests.length > 0 ? [`- Verified via .proof/: ${verifiedTasks}/${manifests.length}`] : []),
    '',
    '## Gate Pass Rates',
    '',
  ];

  if (Object.keys(gateStats).length > 0) {
    for (const [gate, stats] of Object.entries(gateStats)) {
      const pct = stats.total > 0 ? Math.round((stats.pass / stats.total) * 100) : 0;
      const bar = pct >= 80 ? '✅' : pct >= 50 ? '⚠️' : '❌';
      lines.push(`- ${gate}: ${stats.pass}/${stats.total} pass (${pct}%) ${bar}`);
    }
  } else {
    lines.push('- No gate data (v1 ledger or no tasks with gates)');
  }

  lines.push('');
  lines.push('## Self-Healing Stats');
  lines.push('');
  lines.push(`- Total retries: ${totalRetries} across ${tasksWithRetries} tasks`);

  lines.push('');
  lines.push('## Decision Agent Usage');
  lines.push('');
  if (totalDecisions > 0) {
    lines.push(`- Decisions made: ${totalDecisions}`);
    lines.push(`- Escalated to human: ${escalatedDecisions}`);
  } else {
    lines.push('- No decision agent invocations recorded');
  }

  if (pitfalls.length > 0) {
    lines.push('');
    lines.push('## Top Pitfalls Encountered');
    lines.push('');
    for (const p of pitfalls.slice(0, 5)) {
      lines.push(`- ${p}`);
    }
  }

  const report = lines.join('\n') + '\n';

  // Write to .proof/execution-report.md
  mkdirSync(proofDir, { recursive: true });
  const reportPath = join(proofDir, 'execution-report.md');
  writeFileSync(reportPath, report, 'utf-8');

  // Build summary string for pr_ready integration
  const gateLines = Object.entries(gateStats)
    .map(([gate, s]) => `${gate}:${Math.round((s.pass / s.total) * 100)}%`)
    .join(' ');
  const summary = `${done}/${total} tasks done | ${gateLines || 'no gates'} | ${totalRetries} retries`;

  return { reportPath, summary };
}
