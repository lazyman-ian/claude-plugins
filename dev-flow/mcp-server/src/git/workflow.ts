import { execSync } from 'child_process';

export type WorkflowPhase =
  | 'IDLE'
  | 'STARTING'
  | 'DEVELOPING'
  | 'READY_TO_PUSH'
  | 'WAITING_QA'
  | 'PR_OPEN'
  | 'PR_MERGED'
  | 'READY_TO_RELEASE';

export interface GitStatus {
  branch: string;
  taskId: string | null;
  hasChanges: boolean;
  hasUnpushedCommits: boolean;
  hasUpstream: boolean;
  prState: 'OPEN' | 'MERGED' | 'CLOSED' | 'NONE';
  prUrl: string | null;
  latestTag: string | null;
  isFeatureBranch: boolean;
  isMasterBranch: boolean;
}

export interface WorkflowStatus {
  phase: WorkflowPhase;
  phaseDescription: string;
  git: GitStatus;
}

function execCommand(cmd: string): string {
  try {
    return execSync(cmd, { encoding: 'utf-8', stdio: ['pipe', 'pipe', 'pipe'] }).trim();
  } catch {
    return '';
  }
}

/**
 * Get current Git status
 */
export function getGitStatus(): GitStatus {
  const branch = execCommand('git branch --show-current');
  const taskIdMatch = branch.match(/TASK-\d+/i);
  const taskId = taskIdMatch ? taskIdMatch[0].toUpperCase() : null;

  const hasChanges = execCommand('git status --porcelain').length > 0;
  const hasUpstream = execCommand('git rev-parse --abbrev-ref @{upstream} 2>/dev/null').length > 0;

  // Check for unpushed commits
  let hasUnpushedCommits = false;
  if (hasUpstream) {
    // Compare with upstream
    hasUnpushedCommits = execCommand('git log @{upstream}..HEAD --oneline').length > 0;
  } else {
    // No upstream - check if we have local commits ahead of origin/master or origin/main
    const baseBranch = execCommand('git rev-parse --verify origin/master 2>/dev/null')
      ? 'origin/master'
      : execCommand('git rev-parse --verify origin/main 2>/dev/null')
        ? 'origin/main'
        : '';
    if (baseBranch) {
      hasUnpushedCommits = execCommand(`git log ${baseBranch}..HEAD --oneline`).length > 0;
    }
  }

  // PR status
  let prState: 'OPEN' | 'MERGED' | 'CLOSED' | 'NONE' = 'NONE';
  let prUrl: string | null = null;

  const prJson = execCommand('gh pr view --json state,url 2>/dev/null');
  if (prJson) {
    try {
      const pr = JSON.parse(prJson);
      prState = pr.state as 'OPEN' | 'MERGED' | 'CLOSED';
      prUrl = pr.url;
    } catch {
      // ignore
    }
  }

  const latestTag = execCommand('git describe --tags --abbrev=0 2>/dev/null') || null;

  // Recognize common Git Flow branch types as "work branches"
  const isFeatureBranch = /^(feature|fix|feat|hotfix|release|chore|refactor|bugfix|docs|test|ci)\//.test(branch);
  const isMasterBranch = branch === 'master' || branch === 'main';

  return {
    branch,
    taskId,
    hasChanges,
    hasUnpushedCommits,
    hasUpstream,
    prState,
    prUrl,
    latestTag,
    isFeatureBranch,
    isMasterBranch
  };
}

/**
 * Determine workflow phase based on Git status
 */
export function determinePhase(git: GitStatus): WorkflowPhase {
  if (git.isMasterBranch) {
    if (!git.hasChanges && !git.hasUnpushedCommits) {
      // Check if there are new commits since last tag
      if (git.latestTag) {
        const commitsAfterTag = execCommand(
          `git log ${git.latestTag}..HEAD --oneline 2>/dev/null`
        );
        if (commitsAfterTag) {
          return 'READY_TO_RELEASE';
        }
      }
      return 'IDLE';
    }
    return 'STARTING';
  }

  if (git.isFeatureBranch) {
    if (git.prState === 'MERGED') {
      return 'PR_MERGED';
    }
    // Check for uncommitted changes first, even if PR exists
    if (git.hasChanges) {
      return 'DEVELOPING';
    }
    if (git.prState === 'OPEN') {
      return 'PR_OPEN';
    }
    if (git.hasUnpushedCommits) {
      return 'READY_TO_PUSH';
    }
    if (git.hasUpstream) {
      return 'WAITING_QA';
    }
    return 'DEVELOPING';
  }

  return 'IDLE';
}

const phaseDescriptions: Record<WorkflowPhase, string> = {
  IDLE: '空闲，准备开始新任务',
  STARTING: '需要创建功能分支',
  DEVELOPING: '开发中',
  READY_TO_PUSH: '准备推送触发 QA',
  WAITING_QA: '等待 QA 测试',
  PR_OPEN: 'PR 审核中 / Staging 测试',
  PR_MERGED: '已合并，返回 master',
  READY_TO_RELEASE: '可以创建发布 tag'
};

/**
 * Get complete workflow status
 */
export function getWorkflowStatus(): WorkflowStatus {
  const git = getGitStatus();
  const phase = determinePhase(git);

  return {
    phase,
    phaseDescription: phaseDescriptions[phase],
    git
  };
}

/**
 * Get recent commits
 */
export function getRecentCommits(count: number = 5): string[] {
  const output = execCommand(`git log --oneline -${count}`);
  return output ? output.split('\n') : [];
}
