/**
 * Reasoning Management for Continuity
 * Provides tools for managing commit reasoning and decision history
 */

import { execSync } from 'child_process';
import { existsSync, readdirSync, readFileSync, writeFileSync, mkdirSync } from 'fs';
import { join, basename, dirname } from 'path';

interface ReasoningResult {
  success: boolean;
  message: string;
  data?: any;
}

interface ReasoningMatch {
  commitHash: string;
  commitMessage: string;
  date: string;
  context: string;
}

function getCwd(): string {
  try {
    return execSync('git rev-parse --show-toplevel', { encoding: 'utf-8' }).trim();
  } catch {
    return process.cwd();
  }
}

function getCurrentBranch(): string {
  try {
    return execSync('git branch --show-current', { encoding: 'utf-8' }).trim();
  } catch {
    return 'detached';
  }
}

function getReasoningDir(): string {
  return join(getCwd(), '.git', 'claude', 'commits');
}

function getBranchAttemptsFile(): string {
  const cwd = getCwd();
  const branch = getCurrentBranch().replace(/\//g, '-');
  return join(cwd, '.git', 'claude', 'branches', branch, 'attempts.jsonl');
}

export function reasoningGenerate(commitHash: string, commitMessage: string): ReasoningResult {
  const cwd = getCwd();
  const branch = getCurrentBranch();
  const outputDir = join(getReasoningDir(), commitHash);
  const attemptsFile = getBranchAttemptsFile();

  mkdirSync(outputDir, { recursive: true });

  let content = `# Commit: ${commitHash.slice(0, 8)}

## Branch
${branch}

## What was committed
${commitMessage}

`;

  // Add ledger context if available
  const ledgersDir = join(cwd, 'thoughts', 'ledgers');
  if (existsSync(ledgersDir)) {
    const ledgers = readdirSync(ledgersDir).filter(f => f.endsWith('.md') && f.startsWith('TASK-'));
    if (ledgers.length > 0) {
      const ledgerPath = join(ledgersDir, ledgers[0]);
      const ledgerContent = readFileSync(ledgerPath, 'utf-8');

      content += `## Context from Ledger\n\n`;
      content += `**Ledger**: \`${ledgers[0]}\`\n\n`;

      // Extract Goal
      const goalMatch = ledgerContent.match(/^## Goal\s*\n([\s\S]*?)(?=\n## |$)/m);
      if (goalMatch) {
        content += `### Goal\n${goalMatch[1].trim().split('\n')[0]}\n\n`;
      }
    }
  }

  // Add build attempts
  content += `## What was tried\n\n`;

  if (existsSync(attemptsFile)) {
    try {
      const attempts = readFileSync(attemptsFile, 'utf-8')
        .split('\n')
        .filter(l => l.trim())
        .map(l => JSON.parse(l));

      const failures = attempts.filter(a => a.type === 'build_fail');
      const passes = attempts.filter(a => a.type === 'build_pass');

      if (failures.length > 0) {
        content += `### Failed attempts\n`;
        for (const f of failures.slice(-5)) {
          const cmd = f.command?.split(' ').slice(0, 3).join(' ') || 'unknown';
          const err = f.error?.split('\n')[0]?.slice(0, 100) || 'unknown error';
          content += `- \`${cmd}...\`: ${err}\n`;
        }
        content += '\n';
      }

      content += `### Summary\n`;
      if (failures.length > 0) {
        content += `Build passed after **${failures.length} failed attempt(s)**.\n`;
      } else {
        content += `Build passed on first try.\n`;
      }

      // Clear attempts
      writeFileSync(attemptsFile, '');
    } catch {
      content += `_No build attempts recorded._\n`;
    }
  } else {
    content += `_No build attempts recorded._\n`;
  }

  // Add files changed
  content += `\n## Files changed\n`;
  try {
    const files = execSync(`git diff-tree --no-commit-id --name-only -r ${commitHash}`, {
      encoding: 'utf-8',
      cwd,
    }).trim().split('\n');
    for (const f of files) {
      content += `- ${f}\n`;
    }
  } catch {
    content += `- (unable to determine)\n`;
  }

  writeFileSync(join(outputDir, 'reasoning.md'), content);

  return {
    success: true,
    message: `Generated:${commitHash.slice(0, 8)}`,
    data: { path: join(outputDir, 'reasoning.md') },
  };
}

export function reasoningRecall(keyword: string, limit: number = 5): ReasoningResult {
  const reasoningDir = getReasoningDir();
  const cwd = getCwd();
  const matches: ReasoningMatch[] = [];

  // Search reasoning files
  if (existsSync(reasoningDir)) {
    for (const commitDir of readdirSync(reasoningDir)) {
      if (matches.length >= limit) break;

      const reasoningPath = join(reasoningDir, commitDir, 'reasoning.md');
      if (!existsSync(reasoningPath)) continue;

      const content = readFileSync(reasoningPath, 'utf-8');
      if (!content.toLowerCase().includes(keyword.toLowerCase())) continue;

      // Get commit info
      let commitMessage = '';
      let date = '';
      try {
        commitMessage = execSync(`git log -1 --format="%s" ${commitDir}`, {
          encoding: 'utf-8',
          cwd,
        }).trim();
        date = execSync(`git log -1 --format="%ar" ${commitDir}`, {
          encoding: 'utf-8',
          cwd,
        }).trim();
      } catch {
        commitMessage = 'Unknown commit';
        date = 'Unknown date';
      }

      // Extract context around keyword
      const lines = content.split('\n');
      const matchLine = lines.findIndex(l =>
        l.toLowerCase().includes(keyword.toLowerCase())
      );
      const context = matchLine >= 0
        ? lines.slice(Math.max(0, matchLine - 1), matchLine + 2).join('\n').trim()
        : '';

      matches.push({
        commitHash: commitDir.slice(0, 8),
        commitMessage,
        date,
        context: context.slice(0, 200),
      });
    }
  }

  // Search ledgers too
  const ledgersDir = join(cwd, 'thoughts', 'ledgers');
  const ledgerMatches: { name: string; context: string }[] = [];

  if (existsSync(ledgersDir)) {
    for (const file of readdirSync(ledgersDir)) {
      if (!file.endsWith('.md')) continue;

      const content = readFileSync(join(ledgersDir, file), 'utf-8');
      if (content.toLowerCase().includes(keyword.toLowerCase())) {
        const lines = content.split('\n');
        const matchLine = lines.find(l =>
          l.toLowerCase().includes(keyword.toLowerCase())
        );
        ledgerMatches.push({
          name: file,
          context: matchLine?.trim().slice(0, 100) || '',
        });
      }
    }
  }

  const total = matches.length + ledgerMatches.length;

  return {
    success: true,
    message: `Found:${total}|commits:${matches.length}|ledgers:${ledgerMatches.length}`,
    data: { commits: matches, ledgers: ledgerMatches },
  };
}

export function reasoningAggregate(baseBranch: string = 'master'): ReasoningResult {
  const cwd = getCwd();
  const reasoningDir = getReasoningDir();

  let output = '## Approaches Tried\n\n';
  let foundAny = false;

  try {
    const commits = execSync(`git log ${baseBranch}..HEAD --format="%H" --reverse`, {
      encoding: 'utf-8',
      cwd,
    }).trim().split('\n').filter(h => h);

    for (const commit of commits) {
      const reasoningPath = join(reasoningDir, commit, 'reasoning.md');
      if (!existsSync(reasoningPath)) continue;

      foundAny = true;
      const content = readFileSync(reasoningPath, 'utf-8');

      // Get commit message
      const msg = execSync(`git log -1 --format="%s" ${commit}`, {
        encoding: 'utf-8',
        cwd,
      }).trim();

      output += `### ${msg} (\`${commit.slice(0, 8)}\`)\n\n`;

      // Extract failed attempts or summary
      const failedMatch = content.match(/### Failed attempts\s*\n([\s\S]*?)(?=### Summary|$)/);
      const summaryMatch = content.match(/### Summary\s*\n([\s\S]*?)(?=\n## |$)/);

      if (failedMatch) {
        output += failedMatch[1].trim() + '\n\n';
      }
      if (summaryMatch) {
        output += summaryMatch[1].trim() + '\n\n';
      }
    }
  } catch {
    // No commits
  }

  if (!foundAny) {
    output += '_No reasoning files found for commits in this PR._\n';
  }

  output += '\n---\n*Auto-generated from development reasoning.*\n';

  return {
    success: true,
    message: foundAny ? 'Aggregated' : 'No reasoning found',
    data: { content: output },
  };
}
