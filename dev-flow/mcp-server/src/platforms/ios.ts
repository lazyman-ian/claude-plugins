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

// Execute command, capture output to temp file, return only summary
function execQuiet(cmd: string): { exitCode: number; summary: string } {
  const tmpFile = path.join(os.tmpdir(), `dev-flow-${Date.now()}.log`);
  try {
    execSync(`${cmd} > "${tmpFile}" 2>&1`, { encoding: 'utf-8' });
    return { exitCode: 0, summary: '' };
  } catch (e: any) {
    // Read only last 10 lines for summary
    if (fs.existsSync(tmpFile)) {
      const content = fs.readFileSync(tmpFile, 'utf-8');
      const lines = content.split('\n');
      const summary = lines.slice(-10).join('\n');
      fs.unlinkSync(tmpFile);
      return { exitCode: e.status || 1, summary };
    }
    return { exitCode: 1, summary: e.message?.slice(0, 200) || 'Error' };
  } finally {
    if (fs.existsSync(tmpFile)) fs.unlinkSync(tmpFile);
  }
}

// Count-only lint check (no output, just numbers)
export function runSwiftLint(srcDir: string): { errors: number; warnings: number; output: string } {
  try {
    const output = execSync(
      `swiftlint lint --path ${srcDir} --reporter summary 2>/dev/null | tail -3`,
      { encoding: 'utf-8', maxBuffer: 1024 * 1024 }
    );

    // Parse summary: "| Total | | | ... | X | Y | ..."
    const match = output.match(/Total[^\d]*(\d+)[^\d]*(\d+)/);
    const warnings = match ? parseInt(match[1], 10) : 0;
    const errors = match ? parseInt(match[2], 10) : 0;

    return { errors, warnings, output: `${errors}E/${warnings}W` };
  } catch (e: any) {
    // Fallback: count from grep
    try {
      const errCount = execSync(
        `swiftlint lint --path ${srcDir} 2>/dev/null | grep -c "error:" || echo 0`,
        { encoding: 'utf-8' }
      ).trim();
      const warnCount = execSync(
        `swiftlint lint --path ${srcDir} 2>/dev/null | grep -c "warning:" || echo 0`,
        { encoding: 'utf-8' }
      ).trim();
      return {
        errors: parseInt(errCount, 10) || 0,
        warnings: parseInt(warnCount, 10) || 0,
        output: `${errCount}E/${warnCount}W`
      };
    } catch {
      return { errors: 0, warnings: 0, output: 'N/A' };
    }
  }
}

// Count-only format check
export function checkSwiftFormat(srcDir: string): { unformatted: number; output: string } {
  try {
    const output = execSync(
      `swiftformat ${srcDir} --dryrun 2>&1 | grep -oE '^[0-9]+' | head -1`,
      { encoding: 'utf-8' }
    ).trim();
    const unformatted = parseInt(output, 10) || 0;
    return { unformatted, output: `${unformatted} files` };
  } catch {
    return { unformatted: 0, output: '0 files' };
  }
}

export function getCodeQuality(project: ProjectInfo): CodeQualityResult {
  const lint = runSwiftLint(project.srcDir);
  const format = checkSwiftFormat(project.srcDir);

  return {
    lintErrors: lint.errors,
    lintWarnings: lint.warnings,
    unformattedFiles: format.unformatted,
    details: [] // No details by default - saves tokens
  };
}

// Run fix commands quietly, return only status
export function runFix(project: ProjectInfo): { success: boolean; summary: string } {
  const results: string[] = [];

  // SwiftFormat
  const fmt = execQuiet(`swiftformat ${project.srcDir}`);
  results.push(fmt.exitCode === 0 ? '✅format' : '❌format');

  // SwiftLint fix
  const lint = execQuiet(`swiftlint --fix --path ${project.srcDir}`);
  results.push(lint.exitCode === 0 ? '✅lint' : '❌lint');

  return {
    success: fmt.exitCode === 0 && lint.exitCode === 0,
    summary: results.join(' ')
  };
}

// Build quietly, return only status
export function runBuild(project: ProjectInfo, scheme?: string): { success: boolean; summary: string } {
  const workspace = `${project.name}.xcworkspace`;
  const targetScheme = scheme || `${project.name} QA`;
  const logFile = path.join(os.tmpdir(), `build-${Date.now()}.log`);

  try {
    execSync(
      `xcodebuild -workspace ${workspace} -scheme "${targetScheme}" build 2>&1 | tee "${logFile}" | grep -E "^(Build |error:|warning:)" | tail -5`,
      { encoding: 'utf-8', maxBuffer: 10 * 1024 * 1024 }
    );
    return { success: true, summary: '✅ Build succeeded' };
  } catch (e: any) {
    // Extract only errors from log
    try {
      const errors = execSync(
        `grep -E "^error:" "${logFile}" | head -3`,
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

export function getFixCommands(project: ProjectInfo): string[] {
  return [
    `swiftformat ${project.srcDir}`,
    'swiftlint --fix'
  ];
}

export function getCheckCommands(): string[] {
  return ['swiftlint lint 2>/dev/null | grep -c "error:"'];
}

export function getBuildCommand(project: ProjectInfo, scheme?: string): string {
  return `xcodebuild -workspace ${project.name}.xcworkspace -scheme "${scheme || project.name + ' QA'}" build`;
}

// Check if there are any code file changes
function hasCodeFileChanges(): boolean {
  try {
    // Check for .swift files in git diff (staged + unstaged) and untracked files
    const output = execSync(
      'git status --porcelain | grep -E "\\.(swift)$" | wc -l',
      { encoding: 'utf-8' }
    ).trim();
    return parseInt(output, 10) > 0;
  } catch {
    return true; // If can't determine, assume code changes (safer)
  }
}

export function getPhaseGuidance(phase: string): string {
  const g: Record<string, string> = {
    DEVELOPING: hasCodeFileChanges()
      ? '`make fix` → `git commit` → `git push`'
      : '`git commit` → `git push` (docs/config only)',
    READY_TO_PUSH: '`git push -u origin HEAD`',
    WAITING_QA: 'QA通过后: `/dev pr`',
    PR_OPEN: '等待审核或: `gh pr merge --squash`',
    READY_TO_RELEASE: '`git tag vX.X.X && git push --tags`',
  };
  return g[phase] || '';
}

export interface PlatformConfig {
  platform: 'ios';
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

export function getPlatformConfig(project: ProjectInfo): PlatformConfig {
  // Determine the correct xcodebuild command for version
  const files = fs.readdirSync(project.path);
  const xcworkspace = files.find(f => f.endsWith('.xcworkspace'));
  const xcodeproj = files.find(f => f.endsWith('.xcodeproj'));

  let versionCmd = '';
  if (xcworkspace) {
    versionCmd = `xcodebuild -workspace "${xcworkspace}" -showBuildSettings 2>/dev/null | grep -m1 MARKETING_VERSION | awk '{print $3}'`;
  } else if (xcodeproj) {
    versionCmd = `xcodebuild -project "${xcodeproj}" -showBuildSettings 2>/dev/null | grep -m1 MARKETING_VERSION | awk '{print $3}'`;
  } else {
    versionCmd = 'echo "unknown"';
  }

  return {
    platform: 'ios',
    lintFix: `swiftlint --fix --path ${project.srcDir}`,
    lintCheck: `swiftlint lint --path ${project.srcDir}`,
    formatFix: `swiftformat ${project.srcDir}`,
    formatCheck: `swiftformat ${project.srcDir} --dryrun`,
    buildCmd: `xcodebuild -workspace ${project.name}.xcworkspace -scheme "${project.name} QA" build`,
    testCmd: `xcodebuild -workspace ${project.name}.xcworkspace -scheme "${project.name} QA" test -quiet`,
    verifyCmd: `swiftlint lint --quiet --path ${project.srcDir} && xcodebuild -workspace ${project.name}.xcworkspace -scheme "${project.name} QA" build -quiet`,
    versionCmd,
    scopes: ['auth', 'network', 'ui', 'home', 'search', 'listing', 'map', 'account'],
  };
}
