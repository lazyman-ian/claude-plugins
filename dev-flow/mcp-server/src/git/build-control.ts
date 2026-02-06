import { execSync } from 'child_process';
import { ProjectType } from '../detector';

export interface ChangeStats {
  totalLines: number;
  linesAdded: number;
  linesDeleted: number;
  filesChanged: number;
  // Platform-specific - only non-zero values included
  swiftFiles?: number;
  objcFiles?: number;
  kotlinFiles?: number;
  javaFiles?: number;
  uiFiles?: number;
  dependencyChanged?: boolean;
  projectConfigChanged?: boolean;
  docFiles?: number;
  configFiles?: number;
  totalCodeFiles: number;
  totalNonCodeFiles: number;
}

export interface ChangeAnalysis {
  recommendation: 'should_build' | 'skip' | 'maybe';
  reason: string;
  confidence: 'high' | 'medium' | 'low';
  stats: ChangeStats;
}

export interface PRStatus {
  exists: boolean;
  number: number | null;
  title: string | null;
  isDraft: boolean;
  state: 'OPEN' | 'MERGED' | 'CLOSED' | 'NONE';
  url: string | null;
  checksStatus: 'passing' | 'failing' | 'pending' | 'unknown';
}

export interface BuildControlStatus {
  pr: PRStatus;
  autoBuildEnabled: boolean;
  analysis: ChangeAnalysis | null;
  lastBuildTime: string | null;
}

function execCommand(cmd: string): string {
  try {
    return execSync(cmd, { encoding: 'utf-8', stdio: ['pipe', 'pipe', 'pipe'] }).trim();
  } catch {
    return '';
  }
}

function countFiles(pattern: string, baseBranch: string): number {
  const output = execCommand(`git diff ${baseBranch}...HEAD --name-only 2>/dev/null | grep -E '${pattern}' | wc -l`);
  return parseInt(output) || 0;
}

/**
 * Analyze code changes between current branch and base branch
 */
export function analyzeChanges(baseBranch: string = 'origin/master', projectType: ProjectType): ChangeAnalysis {
  const diffStats = execCommand(`git diff ${baseBranch}...HEAD --shortstat 2>/dev/null`);

  if (!diffStats) {
    return {
      recommendation: 'skip',
      reason: 'No changes detected',
      confidence: 'high',
      stats: emptyStats()
    };
  }

  // Parse diff stats
  const linesAdded = parseInt(diffStats.match(/(\d+) insertion/)?.[1] || '0');
  const linesDeleted = parseInt(diffStats.match(/(\d+) deletion/)?.[1] || '0');
  const filesChanged = parseInt(diffStats.match(/(\d+) file/)?.[1] || '0');
  const totalLines = linesAdded + linesDeleted;

  // Count file types
  const swiftFiles = countFiles('\\.swift$', baseBranch);
  const mFiles = countFiles('\\.m$', baseBranch);
  const hFiles = countFiles('\\.h$', baseBranch);
  const objcFiles = mFiles + hFiles;
  const kotlinFiles = countFiles('\\.kt$', baseBranch);
  const javaFiles = countFiles('\\.java$', baseBranch);

  const storyboardFiles = countFiles('\\.storyboard$', baseBranch);
  const xibFiles = countFiles('\\.xib$', baseBranch);
  const xmlFiles = countFiles('\\.xml$', baseBranch);
  const uiFiles = storyboardFiles + xibFiles + xmlFiles;

  const podfileChanged = countFiles('^Podfile', baseBranch) > 0;
  const xcodeprojChanged = countFiles('\\.xcodeproj', baseBranch) > 0;
  const gradleChanged = countFiles('\\.gradle', baseBranch) > 0;

  const mdFiles = countFiles('\\.md$', baseBranch);
  const txtFiles = countFiles('\\.txt$', baseBranch);
  const docFiles = mdFiles + txtFiles;

  const githubFiles = countFiles('^\\.github/', baseBranch);
  const claudeFiles = countFiles('^\\.claude/', baseBranch);
  const configFiles = githubFiles + claudeFiles;

  // Calculate totals based on project type
  let dependencyChanged = false;
  let projectConfigChanged = false;
  let totalCodeFiles = 0;

  if (projectType === 'ios') {
    dependencyChanged = podfileChanged;
    projectConfigChanged = xcodeprojChanged;
    totalCodeFiles = swiftFiles + objcFiles + uiFiles + (podfileChanged ? 1 : 0) + (xcodeprojChanged ? 1 : 0);
  } else if (projectType === 'android') {
    dependencyChanged = gradleChanged;
    projectConfigChanged = gradleChanged;
    totalCodeFiles = kotlinFiles + javaFiles + xmlFiles + (gradleChanged ? 1 : 0);
  } else {
    dependencyChanged = podfileChanged || gradleChanged;
    projectConfigChanged = xcodeprojChanged || gradleChanged;
    totalCodeFiles = swiftFiles + objcFiles + kotlinFiles + javaFiles + uiFiles;
  }

  const totalNonCodeFiles = docFiles + configFiles;

  // Build stats with only non-zero values to save tokens
  const stats: ChangeStats = {
    totalLines,
    linesAdded,
    linesDeleted,
    filesChanged,
    totalCodeFiles,
    totalNonCodeFiles
  };
  // Add platform-specific non-zero values only
  if (swiftFiles > 0) stats.swiftFiles = swiftFiles;
  if (objcFiles > 0) stats.objcFiles = objcFiles;
  if (kotlinFiles > 0) stats.kotlinFiles = kotlinFiles;
  if (javaFiles > 0) stats.javaFiles = javaFiles;
  if (uiFiles > 0) stats.uiFiles = uiFiles;
  if (dependencyChanged) stats.dependencyChanged = true;
  if (projectConfigChanged) stats.projectConfigChanged = true;
  if (docFiles > 0) stats.docFiles = docFiles;
  if (configFiles > 0) stats.configFiles = configFiles;

  // Decision logic
  let recommendation: 'should_build' | 'skip' | 'maybe' = 'maybe';
  let reason = '';
  let confidence: 'high' | 'medium' | 'low' = 'medium';

  // Rule 1: No code files changed
  if (totalCodeFiles === 0) {
    recommendation = 'skip';
    reason = 'No code files changed (only docs/config)';
    confidence = 'high';
  }
  // Rule 2: Dependencies changed -> must build
  else if (dependencyChanged) {
    recommendation = 'should_build';
    reason = projectType === 'ios'
      ? 'Podfile changed (dependencies update)'
      : projectType === 'android'
        ? 'Gradle changed (dependencies update)'
        : 'Dependencies changed';
    confidence = 'high';
  }
  // Rule 3: Project config changed -> should build
  else if (projectConfigChanged) {
    recommendation = 'should_build';
    reason = 'Project configuration changed';
    confidence = 'high';
  }
  // Rule 4: Large changes (>100 lines) -> should build
  else if (totalLines > 100) {
    recommendation = 'should_build';
    reason = `Large code changes (${totalLines} lines, ${totalCodeFiles} files)`;
    confidence = 'high';
  }
  // Rule 5: Minor changes (<30 lines) -> skip
  else if (totalLines < 30) {
    recommendation = 'skip';
    reason = `Minor changes (${totalLines} lines)`;
    confidence = 'medium';
  }
  // Rule 6: Moderate changes (30-100 lines) -> maybe
  else {
    recommendation = 'maybe';
    reason = `Moderate changes (${totalLines} lines, ${totalCodeFiles} files)`;
    confidence = 'medium';
  }

  // Special case: Mostly docs - only if no code files were changed
  // This prevents overriding decisions when code was actually modified
  if (totalCodeFiles === 0 && docFiles > 0) {
    recommendation = 'skip';
    reason = 'Documentation-only changes';
    confidence = 'high';
  }

  return { recommendation, reason, confidence, stats };
}

/**
 * Get PR status including draft state
 */
export function getPRStatus(): PRStatus {
  const prJson = execCommand('gh pr view --json number,title,isDraft,state,url,statusCheckRollup 2>/dev/null');

  if (!prJson) {
    return {
      exists: false,
      number: null,
      title: null,
      isDraft: false,
      state: 'NONE',
      url: null,
      checksStatus: 'unknown'
    };
  }

  try {
    const pr = JSON.parse(prJson);

    // Determine checks status
    let checksStatus: 'passing' | 'failing' | 'pending' | 'unknown' = 'unknown';
    if (pr.statusCheckRollup && Array.isArray(pr.statusCheckRollup)) {
      const checks = pr.statusCheckRollup;
      const hasFailure = checks.some((c: any) =>
        c.conclusion === 'FAILURE' || c.state === 'FAILURE'
      );
      const hasPending = checks.some((c: any) =>
        c.status === 'IN_PROGRESS' || c.status === 'QUEUED' || c.state === 'PENDING'
      );

      if (hasFailure) {
        checksStatus = 'failing';
      } else if (hasPending) {
        checksStatus = 'pending';
      } else if (checks.length > 0) {
        checksStatus = 'passing';
      }
    }

    return {
      exists: true,
      number: pr.number,
      title: pr.title,
      isDraft: pr.isDraft,
      state: pr.state,
      url: pr.url,
      checksStatus
    };
  } catch {
    return {
      exists: false,
      number: null,
      title: null,
      isDraft: false,
      state: 'NONE',
      url: null,
      checksStatus: 'unknown'
    };
  }
}

/**
 * Toggle PR ready/draft status
 */
export function togglePRReady(makeDraft: boolean): { success: boolean; message: string } {
  const pr = getPRStatus();

  if (!pr.exists) {
    return { success: false, message: 'No PR found for current branch' };
  }

  if (makeDraft && pr.isDraft) {
    return { success: true, message: 'PR is already Draft' };
  }

  if (!makeDraft && !pr.isDraft) {
    return { success: true, message: 'PR is already Ready for Review' };
  }

  const cmd = makeDraft ? 'gh pr ready --undo' : 'gh pr ready';
  const result = execCommand(cmd);

  // Verify the change
  const newPr = getPRStatus();
  const expectedDraft = makeDraft;

  if (newPr.isDraft === expectedDraft) {
    return {
      success: true,
      message: makeDraft
        ? 'PR is now Draft (builds disabled)'
        : 'PR is now Ready for Review (builds enabled)'
    };
  }

  return { success: false, message: 'Failed to change PR status' };
}

/**
 * Get complete build control status
 */
export function getBuildControlStatus(projectType: ProjectType, baseBranch: string = 'origin/master'): BuildControlStatus {
  const pr = getPRStatus();
  const analysis = pr.exists ? analyzeChanges(baseBranch, projectType) : null;

  return {
    pr,
    autoBuildEnabled: pr.exists && !pr.isDraft,
    analysis,
    lastBuildTime: null // Could be enhanced to track this
  };
}

function emptyStats(): ChangeStats {
  return {
    totalLines: 0,
    linesAdded: 0,
    linesDeleted: 0,
    filesChanged: 0,
    totalCodeFiles: 0,
    totalNonCodeFiles: 0
  };
}
