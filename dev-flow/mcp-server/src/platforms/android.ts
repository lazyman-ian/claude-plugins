import { execSync } from 'child_process';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { ProjectInfo } from '../detector';

export interface CodeQualityResult {
  lintErrors: number;
  lintWarnings: number;
  unformattedFiles: number;
  details: string[];
}

function getGradle(): string {
  return fs.existsSync('./gradlew') ? './gradlew' : 'gradle';
}

// Execute quietly, return summary only
function execQuiet(cmd: string): { exitCode: number; summary: string } {
  const tmpFile = path.join(os.tmpdir(), `dev-flow-${Date.now()}.log`);
  try {
    execSync(`${cmd} > "${tmpFile}" 2>&1`, { encoding: 'utf-8' });
    return { exitCode: 0, summary: '' };
  } catch (e: any) {
    if (fs.existsSync(tmpFile)) {
      const content = fs.readFileSync(tmpFile, 'utf-8');
      const lines = content.split('\n').slice(-5);
      fs.unlinkSync(tmpFile);
      return { exitCode: e.status || 1, summary: lines.join('\n').slice(0, 200) };
    }
    return { exitCode: 1, summary: 'Error' };
  } finally {
    if (fs.existsSync(tmpFile)) fs.unlinkSync(tmpFile);
  }
}

// Count-only ktlint check
export function runKtlint(): { errors: number; warnings: number; output: string } {
  const gradle = getGradle();
  try {
    const output = execSync(
      `${gradle} ktlintCheck 2>&1 | grep -c "✗" || echo 0`,
      { encoding: 'utf-8' }
    ).trim();
    const errors = parseInt(output, 10) || 0;
    return { errors, warnings: 0, output: `${errors}E` };
  } catch {
    return { errors: 0, warnings: 0, output: 'N/A' };
  }
}

// Count-only detekt check
export function runDetekt(): { issues: number; output: string } {
  const gradle = getGradle();
  try {
    const output = execSync(
      `${gradle} detekt 2>&1 | grep -oE '[0-9]+ weighted issues' | grep -oE '[0-9]+' || echo 0`,
      { encoding: 'utf-8' }
    ).trim();
    const issues = parseInt(output, 10) || 0;
    return { issues, output: `${issues} issues` };
  } catch {
    return { issues: 0, output: '0 issues' };
  }
}

export function checkKtlintFormat(): { unformatted: number; output: string } {
  const lint = runKtlint();
  return { unformatted: lint.errors, output: lint.output };
}

export function getCodeQuality(project: ProjectInfo): CodeQualityResult {
  const lint = runKtlint();
  const detekt = runDetekt();

  return {
    lintErrors: lint.errors,
    lintWarnings: detekt.issues,
    unformattedFiles: lint.errors, // ktlint format issues = lint issues
    details: []
  };
}

// Run fix quietly
export function runFix(): { success: boolean; summary: string } {
  const gradle = getGradle();
  const results: string[] = [];

  const fmt = execQuiet(`${gradle} ktlintFormat`);
  results.push(fmt.exitCode === 0 ? '✅ktlint' : '❌ktlint');

  return {
    success: fmt.exitCode === 0,
    summary: results.join(' ')
  };
}

// Build quietly
export function runBuild(buildType: string = 'debug'): { success: boolean; summary: string } {
  const gradle = getGradle();
  const task = `assemble${buildType.charAt(0).toUpperCase() + buildType.slice(1)}`;
  const logFile = path.join(os.tmpdir(), `build-${Date.now()}.log`);

  try {
    execSync(
      `${gradle} ${task} 2>&1 | tee "${logFile}" | grep -E "^(BUILD |FAILURE|> Task)" | tail -3`,
      { encoding: 'utf-8', maxBuffer: 10 * 1024 * 1024 }
    );
    return { success: true, summary: '✅ Build succeeded' };
  } catch {
    try {
      const errors = execSync(
        `grep -E "^e:" "${logFile}" | head -3`,
        { encoding: 'utf-8' }
      ).trim();
      return { success: false, summary: `❌ ${errors.split('\n')[0]?.slice(0, 100) || 'Build failed'}` };
    } catch {
      return { success: false, summary: '❌ Build failed' };
    }
  } finally {
    if (fs.existsSync(logFile)) fs.unlinkSync(logFile);
  }
}

export function getFixCommands(): string[] {
  const gradle = getGradle();
  return [`${gradle} ktlintFormat`];
}

export function getCheckCommands(): string[] {
  const gradle = getGradle();
  return [`${gradle} ktlintCheck`];
}

export function getBuildCommand(buildType: string = 'debug'): string {
  const gradle = getGradle();
  return `${gradle} assemble${buildType.charAt(0).toUpperCase() + buildType.slice(1)}`;
}

// Check if there are any code file changes
function hasCodeFileChanges(): boolean {
  try {
    // Check for .kt/.java files in git diff (staged + unstaged) and untracked files
    const output = execSync(
      'git status --porcelain | grep -E "\\.(kt|java)$" | wc -l',
      { encoding: 'utf-8' }
    ).trim();
    return parseInt(output, 10) > 0;
  } catch {
    return true; // If can't determine, assume code changes (safer)
  }
}

export function getPhaseGuidance(phase: string): string {
  const gradle = getGradle();
  const g: Record<string, string> = {
    DEVELOPING: hasCodeFileChanges()
      ? `\`${gradle} ktlintFormat\` → \`git commit\` → \`git push\``
      : '`git commit` → `git push` (docs/config only)',
    READY_TO_PUSH: '`git push -u origin HEAD`',
    WAITING_QA: 'QA通过后: `/dev pr`',
    PR_OPEN: '等待审核或: `gh pr merge --squash`',
    READY_TO_RELEASE: '`git tag vX.X.X && git push --tags`',
  };
  return g[phase] || '';
}

export interface PlatformConfig {
  platform: 'android';
  lintFix: string;
  lintCheck: string;
  formatFix: string;
  formatCheck: string;
  buildCmd: string;
  testCmd: string;
  verifyCmd: string;
  versionCmd: string;
  scopes: string[];
}

export function getPlatformConfig(): PlatformConfig {
  const gradle = getGradle();
  return {
    platform: 'android',
    lintFix: `${gradle} ktlintFormat`,
    lintCheck: `${gradle} ktlintCheck`,
    formatFix: `${gradle} ktlintFormat`,
    formatCheck: `${gradle} ktlintCheck`,
    buildCmd: `${gradle} assembleDebug`,
    testCmd: `${gradle} test --quiet`,
    verifyCmd: `${gradle} ktlintCheck && ${gradle} assembleDebug --quiet`,
    versionCmd: `grep -oP 'versionName "\\K[^"]+' app/build.gradle`,
    scopes: ['app', 'core', 'feature', 'data', 'domain', 'network', 'ui'],
  };
}
