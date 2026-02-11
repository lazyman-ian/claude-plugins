import { execSync } from 'child_process';
import { createHash } from 'crypto';

interface CommitSession {
  token: string;
  diffHash: string;
  files: string[];
  reviewLogMtime: number;
  createdAt: number;
}

let activeSession: CommitSession | null = null;
const SESSION_TTL = 10 * 60 * 1000;

function execCommand(cmd: string): string {
  try {
    return execSync(cmd, { encoding: 'utf-8', stdio: ['pipe', 'pipe', 'pipe'] }).trim();
  } catch {
    return '';
  }
}

function hashDiff(): string {
  const diff = execCommand('git diff --cached');
  return createHash('sha256').update(diff).digest('hex').slice(0, 16);
}

function getReviewLogMtime(): number {
  const branch = execCommand('git branch --show-current');
  const logPath = `.git/claude/review-session-${branch}.md`;
  try {
    const stat = execSync(`/usr/bin/stat -f %m "${logPath}" 2>/dev/null`, {
      encoding: 'utf-8',
      stdio: ['pipe', 'pipe', 'pipe'],
    }).trim();
    return parseInt(stat, 10) || 0;
  } catch {
    return 0;
  }
}

function commitPrepare(): { token: string; files: string[]; diff_stat: string } {
  const diffStat = execCommand('git diff --cached --stat');
  if (!diffStat) {
    throw new Error('No staged changes. Run `git add` first.');
  }

  const files = execCommand('git diff --cached --name-only')
    .split('\n')
    .filter(Boolean);
  const token = hashDiff();
  const reviewLogMtime = getReviewLogMtime();

  activeSession = {
    token,
    diffHash: token,
    files,
    reviewLogMtime,
    createdAt: Date.now(),
  };

  return { token, files, diff_stat: diffStat };
}

function commitFinalize(
  token: string,
  message: string,
  skipReview?: boolean
): { hash: string; message: string } {
  if (!activeSession) {
    throw new Error('No active commit session. Run dev_commit(action="prepare") first.');
  }

  if (Date.now() - activeSession.createdAt > SESSION_TTL) {
    activeSession = null;
    throw new Error('Commit session expired (10min). Run dev_commit(action="prepare") again.');
  }

  if (token !== activeSession.token) {
    throw new Error(
      `Token mismatch. Expected: ${activeSession.token}, got: ${token}. Run prepare again.`
    );
  }

  const currentHash = hashDiff();
  if (currentHash !== activeSession.diffHash) {
    activeSession = null;
    throw new Error(
      'Staged diff changed after prepare (code modified after review). Run prepare → review → finalize again.'
    );
  }

  if (!skipReview) {
    const currentMtime = getReviewLogMtime();
    if (currentMtime <= activeSession.reviewLogMtime) {
      throw new Error(
        'Review session log not updated since prepare. Run code-reviewer before finalize, or use skip_review=true for emergency.'
      );
    }
  }

  const output = execCommand(`DEV_FLOW_COMMIT=1 git commit -m "${message.replace(/"/g, '\\"')}"`);
  if (!output) {
    throw new Error('git commit failed. Check staged changes and message format.');
  }

  const hashMatch = output.match(/\[[\w/.-]+ ([a-f0-9]+)\]/);
  const hash = hashMatch ? hashMatch[1] : execCommand('git rev-parse --short HEAD');

  activeSession = null;

  return { hash, message };
}

export function commitTool(
  action?: string,
  token?: string,
  message?: string,
  skipReview?: boolean
) {
  switch (action) {
    case 'prepare': {
      const result = commitPrepare();
      return {
        content: [
          {
            type: 'text',
            text: `token:${result.token}\nfiles:${result.files.join(',')}\n${result.diff_stat}`,
          },
        ],
      };
    }
    case 'finalize': {
      if (!token) return { content: [{ type: 'text', text: '❌ token required' }] };
      if (!message) return { content: [{ type: 'text', text: '❌ message required' }] };
      const result = commitFinalize(token, message, skipReview);
      return {
        content: [
          {
            type: 'text',
            text: `✅ ${result.hash}|${result.message}`,
          },
        ],
      };
    }
    default:
      return { content: [{ type: 'text', text: '❌ Action required: prepare|finalize' }] };
  }
}
