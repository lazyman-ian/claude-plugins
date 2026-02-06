import { execSync } from 'child_process';
import * as fs from 'fs';
import { ProjectType, ProjectInfo } from '../detector';

export interface VersionInfo {
  current: string;
  latestTag: string | null;
  nextMajor: string;
  nextMinor: string;
  nextPatch: string;
  source: 'xcodebuild' | 'gradle' | 'tag' | 'unknown';
}

export interface CommitInfo {
  hash: string;
  type: string;
  scope: string | null;
  subject: string;
  raw: string;
}

export interface CommitsSummary {
  total: number;
  byType: Record<string, CommitInfo[]>;
  range: {
    from: string;
    to: string;
  };
}

function execCommand(cmd: string): string {
  try {
    return execSync(cmd, { encoding: 'utf-8', stdio: ['pipe', 'pipe', 'pipe'] }).trim();
  } catch {
    return '';
  }
}

/**
 * Parse semantic version string
 */
function parseVersion(version: string): { major: number; minor: number; patch: number } | null {
  const match = version.match(/^v?(\d+)\.(\d+)\.(\d+)/);
  if (!match) return null;
  return {
    major: parseInt(match[1]),
    minor: parseInt(match[2]),
    patch: parseInt(match[3])
  };
}

/**
 * Get version info for the project
 */
export function getVersionInfo(project: ProjectInfo): VersionInfo {
  let current = '';
  let source: 'xcodebuild' | 'gradle' | 'tag' | 'unknown' = 'unknown';

  // Try to get version based on project type
  if (project.type === 'ios') {
    // Use xcodebuild to get MARKETING_VERSION
    const files = fs.readdirSync(project.path);
    const xcworkspace = files.find(f => f.endsWith('.xcworkspace'));
    const xcodeproj = files.find(f => f.endsWith('.xcodeproj'));

    let cmd = '';
    if (xcworkspace) {
      cmd = `xcodebuild -workspace "${xcworkspace}" -showBuildSettings 2>/dev/null | grep -m1 MARKETING_VERSION | awk '{print $3}'`;
    } else if (xcodeproj) {
      cmd = `xcodebuild -project "${xcodeproj}" -showBuildSettings 2>/dev/null | grep -m1 MARKETING_VERSION | awk '{print $3}'`;
    }

    if (cmd) {
      current = execCommand(cmd);
      if (current) source = 'xcodebuild';
    }
  } else if (project.type === 'android') {
    // Try to read from build.gradle
    const gradleFiles = ['app/build.gradle', 'app/build.gradle.kts'];
    for (const file of gradleFiles) {
      if (fs.existsSync(file)) {
        const content = fs.readFileSync(file, 'utf-8');
        const match = content.match(/versionName\s*[=:]\s*["']([^"']+)["']/);
        if (match) {
          current = match[1];
          source = 'gradle';
          break;
        }
      }
    }
  }

  // Fallback to git tag
  if (!current) {
    const tag = execCommand('git describe --tags --abbrev=0 2>/dev/null');
    if (tag) {
      current = tag.replace(/^v/, '');
      source = 'tag';
    }
  }

  const latestTag = execCommand('git describe --tags --abbrev=0 2>/dev/null') || null;

  // Calculate next versions
  const parsed = parseVersion(current);
  let nextMajor = '';
  let nextMinor = '';
  let nextPatch = '';

  if (parsed) {
    nextMajor = `${parsed.major + 1}.0.0`;
    nextMinor = `${parsed.major}.${parsed.minor + 1}.0`;
    nextPatch = `${parsed.major}.${parsed.minor}.${parsed.patch + 1}`;
  }

  return {
    current: current || 'unknown',
    latestTag,
    nextMajor,
    nextMinor,
    nextPatch,
    source
  };
}

/**
 * Parse a conventional commit message
 */
function parseCommit(raw: string): CommitInfo {
  const hash = raw.substring(0, 7);
  const message = raw.substring(8);

  // Match conventional commit format: type(scope): subject
  const match = message.match(/^(\w+)(?:\(([^)]+)\))?:\s*(.+)$/);

  if (match) {
    return {
      hash,
      type: match[1],
      scope: match[2] || null,
      subject: match[3],
      raw: message
    };
  }

  // Non-conventional commit
  return {
    hash,
    type: 'other',
    scope: null,
    subject: message,
    raw: message
  };
}

/**
 * Get commits between two refs, grouped by type
 */
export function getCommitsSummary(from?: string, to?: string): CommitsSummary {
  // Determine range
  let fromRef = from;
  let toRef = to || 'HEAD';

  if (!fromRef) {
    // Default: from last tag to HEAD
    const latestTag = execCommand('git describe --tags --abbrev=0 2>/dev/null');
    if (latestTag) {
      // Get the tag before the latest
      const prevTag = execCommand(`git describe --tags --abbrev=0 ${latestTag}^ 2>/dev/null`);
      fromRef = prevTag || latestTag;
    } else {
      // No tags, use first commit
      fromRef = execCommand('git rev-list --max-parents=0 HEAD 2>/dev/null');
    }
  }

  const range = `${fromRef}..${toRef}`;
  const output = execCommand(`git log ${range} --pretty=format:'%h %s' 2>/dev/null`);

  if (!output) {
    return {
      total: 0,
      byType: {},
      range: { from: fromRef || '', to: toRef }
    };
  }

  const lines = output.split('\n').filter(Boolean);
  const commits = lines.map(parseCommit);

  // Group by type
  const byType: Record<string, CommitInfo[]> = {};
  for (const commit of commits) {
    if (!byType[commit.type]) {
      byType[commit.type] = [];
    }
    byType[commit.type].push(commit);
  }

  return {
    total: commits.length,
    byType,
    range: { from: fromRef || '', to: toRef }
  };
}

/**
 * Format commits summary for release notes
 */
export function formatCommitsForReleaseNotes(summary: CommitsSummary): string {
  const typeEmoji: Record<string, string> = {
    feat: '✨', fix: '🐛', perf: '⚡', refactor: '♻️',
    docs: '📚', style: '💄', test: '✅', chore: '🔧', other: '📝'
  };

  let output = `${summary.total} commits (${summary.range.from.slice(0, 7)}..${summary.range.to.slice(0, 7)})\n`;

  // Sort types by importance, only show non-empty
  const typeOrder = ['feat', 'fix', 'perf', 'refactor', 'docs', 'style', 'test', 'chore', 'other'];

  for (const type of typeOrder) {
    const commits = summary.byType[type];
    if (!commits || commits.length === 0) continue;

    output += `${typeEmoji[type] || '📝'}${type}(${commits.length}):`;
    // Show up to 5 commits inline
    const shown = commits.slice(0, 5);
    output += shown.map(c => c.scope ? `${c.scope}/${c.subject}` : c.subject).join(';');
    if (commits.length > 5) output += `;+${commits.length - 5}`;
    output += '\n';
  }

  return output.trim();
}
