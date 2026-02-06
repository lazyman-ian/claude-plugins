/**
 * Handoff Hub
 * Manages handoff document storage, retrieval, and aggregation
 */

import * as fs from 'fs';
import * as path from 'path';
import { Handoff, AggregatedResult } from './types';

export class HandoffHub {
  private baseDir: string;

  constructor(baseDir?: string) {
    this.baseDir = baseDir || path.join(process.cwd(), 'thoughts', 'handoffs');
    if (!fs.existsSync(this.baseDir)) {
      fs.mkdirSync(this.baseDir, { recursive: true });
    }
  }

  write(handoff: Handoff): string {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').substring(0, 15);
    const handoffId = `handoff-${timestamp}.md`;
    const filePath = path.join(this.baseDir, handoffId);

    const content = this.serializeHandoff(handoff);
    fs.writeFileSync(filePath, content, 'utf-8');

    return handoffId;
  }

  read(handoffId: string): Handoff {
    const filePath = path.join(this.baseDir, handoffId);
    if (!fs.existsSync(filePath)) {
      throw new Error(`Handoff not found: ${handoffId}`);
    }

    const content = fs.readFileSync(filePath, 'utf-8');
    return this.parseHandoff(content);
  }

  readChain(taskId: string): Handoff[] {
    const files = fs.readdirSync(this.baseDir)
      .filter(f => f.endsWith('.md'))
      .sort();

    const handoffs: Handoff[] = [];
    for (const file of files) {
      try {
        const handoff = this.read(file);
        if (handoff.task_id === taskId) {
          handoffs.push(handoff);
        }
      } catch (err) {
        // Skip invalid files
      }
    }

    return handoffs;
  }

  aggregate(handoffIds: string[]): AggregatedResult {
    const handoffs = handoffIds.map(id => this.read(id));

    const result: AggregatedResult = {
      totalHandoffs: handoffs.length,
      successCount: handoffs.filter(h => h.status === 'success').length,
      partialCount: handoffs.filter(h => h.status === 'partial').length,
      blockedCount: handoffs.filter(h => h.status === 'blocked').length,
      failedCount: handoffs.filter(h => h.status === 'failed').length,
      filesModified: this.collectUniqueFiles(handoffs),
      keyDecisions: this.mergeDecisions(handoffs),
      openQuestions: this.collectQuestions(handoffs),
      summary: this.generateSummary(handoffs)
    };

    return result;
  }

  private serializeHandoff(handoff: Handoff): string {
    const frontmatter = `---
version: "${handoff.version}"
agent_id: "${handoff.agent_id}"
task_id: "${handoff.task_id}"
${handoff.parent_handoff ? `parent_handoff: "${handoff.parent_handoff}"` : ''}
timestamp: "${handoff.timestamp}"
status: ${handoff.status}
---

# Summary
${handoff.summary}

# Changes Made
${handoff.changes_made.map(f => `- ${f}`).join('\n')}

# Decisions
${Object.entries(handoff.decisions).map(([k, v]) => `- **${k}**: ${v}`).join('\n')}

# Verification
${handoff.verification.map(v => `- [ ] ${v}`).join('\n')}

# For Next Agent
${handoff.for_next_agent}

# Open Questions
${handoff.open_questions.map(q => `- [ ] ${q}`).join('\n')}
`;
    return frontmatter.trim() + '\n';
  }

  private parseHandoff(content: string): Handoff {
    const frontmatterMatch = content.match(/^---\n([\s\S]+?)\n---/);
    if (!frontmatterMatch) {
      throw new Error('Invalid handoff format: missing frontmatter');
    }

    const frontmatter = frontmatterMatch[1];
    const body = content.substring(frontmatterMatch[0].length);

    const parseField = (field: string): string => {
      const match = frontmatter.match(new RegExp(`${field}:\\s*"?([^"\n]+)"?`));
      return match ? match[1] : '';
    };

    const parseSection = (section: string): string[] => {
      const sectionMatch = body.match(new RegExp(`# ${section}\\n([\\s\\S]*?)(?=\\n#|$)`));
      if (!sectionMatch) return [];
      return sectionMatch[1]
        .split('\n')
        .filter(line => line.trim().startsWith('-'))
        .map(line => line.replace(/^-\s*(?:\[\s*[x ]?\s*\]\s*)?/, '').trim())
        .filter(Boolean);
    };

    const parseSummary = (): string => {
      const match = body.match(/# Summary\n([^\n]+)/);
      return match ? match[1].trim() : '';
    };

    const parseForNext = (): string => {
      const match = body.match(/# For Next Agent\n([^\n#]+)/);
      return match ? match[1].trim() : '';
    };

    const parseDecisions = (): Record<string, string> => {
      const decisions: Record<string, string> = {};
      const sectionMatch = body.match(/# Decisions\n([\s\S]*?)(?=\n#|$)/);
      if (sectionMatch) {
        const lines = sectionMatch[1].split('\n');
        for (const line of lines) {
          const match = line.match(/^-\s*\*\*(.+?)\*\*:\s*(.+)$/);
          if (match) {
            decisions[match[1]] = match[2];
          }
        }
      }
      return decisions;
    };

    return {
      version: parseField('version'),
      agent_id: parseField('agent_id'),
      task_id: parseField('task_id'),
      parent_handoff: parseField('parent_handoff') || undefined,
      timestamp: parseField('timestamp'),
      status: parseField('status') as any,
      summary: parseSummary(),
      changes_made: parseSection('Changes Made'),
      decisions: parseDecisions(),
      verification: parseSection('Verification'),
      for_next_agent: parseForNext(),
      open_questions: parseSection('Open Questions')
    };
  }

  private collectUniqueFiles(handoffs: Handoff[]): string[] {
    const files = new Set<string>();
    for (const handoff of handoffs) {
      for (const file of handoff.changes_made) {
        files.add(file);
      }
    }
    return Array.from(files).sort();
  }

  private mergeDecisions(handoffs: Handoff[]): Record<string, string> {
    const decisions: Record<string, string> = {};
    for (const handoff of handoffs) {
      Object.assign(decisions, handoff.decisions);
    }
    return decisions;
  }

  private collectQuestions(handoffs: Handoff[]): string[] {
    const questions: string[] = [];
    for (const handoff of handoffs) {
      questions.push(...handoff.open_questions);
    }
    return questions;
  }

  private generateSummary(handoffs: Handoff[]): string {
    const summaries = handoffs.map(h => `${h.agent_id}: ${h.summary}`);
    return summaries.join('; ');
  }
}
