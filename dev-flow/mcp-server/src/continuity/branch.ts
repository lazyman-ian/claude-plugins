/**
 * Branch Lifecycle Management
 * Provides tools for branch cleanup, stash management, and lifecycle tracking
 */

import { execSync } from 'child_process';

interface BranchResult {
  success: boolean;
  message: string;
  data?: any;
}

function getCwd(): string {
  try {
    return execSync('git rev-parse --show-toplevel', { encoding: 'utf-8' }).trim();
  } catch {
    return process.cwd();
  }
}

function getDefaultBranch(): string {
  try {
    const ref = execSync('git symbolic-ref refs/remotes/origin/HEAD', {
      encoding: 'utf-8',
    }).trim();
    return ref.replace('refs/remotes/origin/', '');
  } catch {
    return 'master';
  }
}

function getCurrentBranch(): string {
  try {
    return execSync('git branch --show-current', { encoding: 'utf-8' }).trim();
  } catch {
    return '';
  }
}

export function branchListMerged(): BranchResult {
  const cwd = getCwd();
  const defaultBranch = getDefaultBranch();
  const currentBranch = getCurrentBranch();

  try {
    const merged = execSync(`git branch --merged ${defaultBranch}`, {
      encoding: 'utf-8',
      cwd,
    })
      .split('\n')
      .map(b => b.trim().replace('* ', ''))
      .filter(b => b && b !== defaultBranch && b !== 'main' && b !== 'master' && b !== 'develop' && b !== currentBranch);

    return {
      success: true,
      message: `Merged:${merged.length}`,
      data: { branches: merged, defaultBranch },
    };
  } catch (error: any) {
    return { success: false, message: error.message };
  }
}

export function branchCleanup(dryRun: boolean = false): BranchResult {
  const cwd = getCwd();
  const { data } = branchListMerged();

  if (!data?.branches || data.branches.length === 0) {
    return { success: true, message: 'No branches to clean' };
  }

  if (dryRun) {
    return {
      success: true,
      message: `Would delete:${data.branches.length}`,
      data: { branches: data.branches },
    };
  }

  const deleted: string[] = [];
  const failed: string[] = [];

  for (const branch of data.branches) {
    try {
      execSync(`git branch -d "${branch}"`, { encoding: 'utf-8', cwd });
      deleted.push(branch);
    } catch {
      failed.push(branch);
    }
  }

  // Prune remote tracking branches
  try {
    execSync('git fetch --prune origin', { encoding: 'utf-8', cwd });
  } catch {
    // Ignore prune errors
  }

  return {
    success: true,
    message: `Deleted:${deleted.length}|Failed:${failed.length}`,
    data: { deleted, failed },
  };
}

export function branchListStale(days: number = 30): BranchResult {
  const cwd = getCwd();
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - days);

  const stale: { name: string; lastCommit: string; daysAgo: number }[] = [];

  try {
    const branches = execSync('git for-each-ref --format="%(refname:short)" refs/heads/', {
      encoding: 'utf-8',
      cwd,
    })
      .split('\n')
      .filter(b => b && !['master', 'main', 'develop'].includes(b));

    for (const branch of branches) {
      try {
        const dateStr = execSync(`git log -1 --format="%ci" "${branch}"`, {
          encoding: 'utf-8',
          cwd,
        }).trim().split(' ')[0];

        const commitDate = new Date(dateStr);
        if (commitDate < cutoffDate) {
          const daysAgo = Math.floor((Date.now() - commitDate.getTime()) / (1000 * 60 * 60 * 24));
          stale.push({ name: branch, lastCommit: dateStr, daysAgo });
        }
      } catch {
        // Skip branches we can't get date for
      }
    }
  } catch (error: any) {
    return { success: false, message: error.message };
  }

  return {
    success: true,
    message: `Stale:${stale.length}|threshold:${days}d`,
    data: { branches: stale },
  };
}

export function branchStashSwitch(targetBranch: string): BranchResult {
  const cwd = getCwd();
  const currentBranch = getCurrentBranch();

  // Check for uncommitted changes
  let hasChanges = false;
  try {
    execSync('git diff --quiet && git diff --cached --quiet', { cwd });
  } catch {
    hasChanges = true;
  }

  // Stash if needed
  if (hasChanges) {
    const stashMsg = `Auto-stash from ${currentBranch} before switching to ${targetBranch}`;
    try {
      execSync(`git stash push -m "${stashMsg}"`, { encoding: 'utf-8', cwd });
    } catch (error: any) {
      return { success: false, message: `Stash failed: ${error.message}` };
    }
  }

  // Switch branch
  try {
    // Check if local branch exists
    try {
      execSync(`git show-ref --verify --quiet refs/heads/${targetBranch}`, { cwd });
      execSync(`git checkout "${targetBranch}"`, { encoding: 'utf-8', cwd });
    } catch {
      // Try remote branch
      try {
        execSync(`git show-ref --verify --quiet refs/remotes/origin/${targetBranch}`, { cwd });
        execSync(`git checkout -b "${targetBranch}" "origin/${targetBranch}"`, { encoding: 'utf-8', cwd });
      } catch {
        return { success: false, message: `Branch not found: ${targetBranch}` };
      }
    }
  } catch (error: any) {
    return { success: false, message: `Checkout failed: ${error.message}` };
  }

  // Check for existing stash for target branch
  let hasStash = false;
  try {
    const stashList = execSync('git stash list', { encoding: 'utf-8', cwd });
    hasStash = stashList.includes(`from ${targetBranch}`);
  } catch {
    // No stash
  }

  return {
    success: true,
    message: hasChanges
      ? `Switched|stashed:${currentBranch}|hasStash:${hasStash}`
      : `Switched|hasStash:${hasStash}`,
    data: { from: currentBranch, to: targetBranch, stashed: hasChanges, hasTargetStash: hasStash },
  };
}

export function branchStashPop(): BranchResult {
  const cwd = getCwd();
  const currentBranch = getCurrentBranch();

  try {
    const stashList = execSync('git stash list', { encoding: 'utf-8', cwd });
    const lines = stashList.split('\n');

    // Find stash for current branch
    const targetStash = lines.findIndex(l => l.includes(`from ${currentBranch}`));

    if (targetStash >= 0) {
      execSync(`git stash pop stash@{${targetStash}}`, { encoding: 'utf-8', cwd });
      return { success: true, message: 'Stash applied' };
    }

    return { success: false, message: 'No stash found for current branch' };
  } catch (error: any) {
    return { success: false, message: error.message };
  }
}

export function branchPrune(): BranchResult {
  const cwd = getCwd();

  try {
    execSync('git fetch --prune origin', { encoding: 'utf-8', cwd });
    return { success: true, message: 'Remote tracking branches pruned' };
  } catch (error: any) {
    return { success: false, message: error.message };
  }
}
