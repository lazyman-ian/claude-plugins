import { execSync } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';

export type ProjectType = 'ios' | 'android' | 'custom' | 'makefile' | 'unknown';

export interface ProjectInfo {
  type: ProjectType;
  name: string;
  path: string;
  srcDir: string;
  configFiles: string[];
}

/**
 * Custom platform configuration from .dev-flow.json
 */
export interface DevFlowConfig {
  platform: string;
  commands: {
    fix: string;
    check: string;
    build?: string;
    test?: string;
    verify?: string;
  };
  scopes?: string[];
}

/**
 * Load project-level .dev-flow.json configuration
 * Returns null if not found or invalid
 */
export function loadProjectConfig(projectPath: string = process.cwd()): DevFlowConfig | null {
  const configPath = path.join(projectPath, '.dev-flow.json');
  if (!fs.existsSync(configPath)) {
    return null;
  }
  try {
    const content = fs.readFileSync(configPath, 'utf-8');
    const config = JSON.parse(content);
    // Validate required fields
    if (config.platform && config.commands?.fix && config.commands?.check) {
      return config as DevFlowConfig;
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * Check if Makefile has fix and check targets
 */
export function hasMakefileTargets(projectPath: string = process.cwd()): boolean {
  const makefile = path.join(projectPath, 'Makefile');
  if (!fs.existsSync(makefile)) {
    return false;
  }
  try {
    const content = fs.readFileSync(makefile, 'utf-8');
    // Check for fix: and check: targets (at start of line)
    const hasFix = /^fix\s*:/m.test(content);
    const hasCheck = /^check\s*:/m.test(content);
    return hasFix && hasCheck;
  } catch {
    return false;
  }
}

/**
 * Detect project type based on files in the directory
 */
export function detectProjectType(projectPath: string = process.cwd()): ProjectInfo {
  const files = fs.readdirSync(projectPath);

  // iOS detection
  const hasXcodeproj = files.some(f => f.endsWith('.xcodeproj'));
  const hasXcworkspace = files.some(f => f.endsWith('.xcworkspace'));
  const hasPodfile = files.includes('Podfile');
  const hasSwiftFiles = files.some(f => f.endsWith('.swift')) ||
    fs.existsSync(path.join(projectPath, 'Sources'));

  // Android detection
  const hasBuildGradle = files.includes('build.gradle') || files.includes('build.gradle.kts');
  const hasSettingsGradle = files.includes('settings.gradle') || files.includes('settings.gradle.kts');
  const hasAndroidManifest = fs.existsSync(path.join(projectPath, 'app', 'src', 'main', 'AndroidManifest.xml'));

  if (hasXcodeproj || hasXcworkspace || (hasPodfile && hasSwiftFiles)) {
    const xcodeproj = files.find(f => f.endsWith('.xcodeproj'));
    const projectName = xcodeproj ? xcodeproj.replace('.xcodeproj', '') : path.basename(projectPath);

    // Find source directory
    let srcDir = projectName;
    if (fs.existsSync(path.join(projectPath, projectName))) {
      srcDir = projectName;
    } else if (fs.existsSync(path.join(projectPath, 'Sources'))) {
      srcDir = 'Sources';
    } else if (fs.existsSync(path.join(projectPath, 'src'))) {
      srcDir = 'src';
    }

    const configFiles: string[] = [];
    if (fs.existsSync(path.join(projectPath, '.swiftlint.yml'))) configFiles.push('.swiftlint.yml');
    if (fs.existsSync(path.join(projectPath, '.swiftformat'))) configFiles.push('.swiftformat');
    if (hasPodfile) configFiles.push('Podfile');

    return {
      type: 'ios',
      name: projectName,
      path: projectPath,
      srcDir,
      configFiles
    };
  }

  if (hasBuildGradle || hasSettingsGradle || hasAndroidManifest) {
    const projectName = path.basename(projectPath);

    const configFiles: string[] = [];
    if (fs.existsSync(path.join(projectPath, '.editorconfig'))) configFiles.push('.editorconfig');
    if (fs.existsSync(path.join(projectPath, 'detekt.yml'))) configFiles.push('detekt.yml');
    if (hasBuildGradle) configFiles.push('build.gradle');

    return {
      type: 'android',
      name: projectName,
      path: projectPath,
      srcDir: 'app/src/main',
      configFiles
    };
  }

  return {
    type: 'unknown',
    name: path.basename(projectPath),
    path: projectPath,
    srcDir: '.',
    configFiles: []
  };
}

/**
 * Check if a command is available
 */
export function isCommandAvailable(command: string): boolean {
  try {
    execSync(`which ${command}`, { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
}

/**
 * Get available tools for the project type
 */
export function getAvailableTools(projectType: ProjectType): Record<string, boolean> {
  if (projectType === 'ios') {
    return {
      swiftlint: isCommandAvailable('swiftlint'),
      swiftformat: isCommandAvailable('swiftformat'),
      xcodebuild: isCommandAvailable('xcodebuild'),
      pod: isCommandAvailable('pod')
    };
  }

  if (projectType === 'android') {
    return {
      ktlint: isCommandAvailable('ktlint'),
      detekt: isCommandAvailable('detekt'),
      gradle: fs.existsSync('./gradlew') || isCommandAvailable('gradle')
    };
  }

  return {};
}
