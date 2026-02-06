#!/usr/bin/env node

/**
 * CLI entry point for dev-flow-mcp
 *
 * Provides command-line interface for shell scripts (e.g., StatusLine)
 * to query dev-flow status without needing MCP connection.
 */

import * as path from 'path';
import { detectProjectType } from './detector';
import { getWorkflowStatus } from './git/workflow';
import * as ios from './platforms/ios';
import * as android from './platforms/android';

// Detect command from script name (e.g., /path/to/dev_status)
const scriptName = path.basename(process.argv[1], '.js');
const command = scriptName.replace('dev_', '');

/**
 * Quick status - ultra-compact output for StatusLine
 * Format: PHASE|✅/❌ERRORS|NEXT_ACTION
 */
function quickStatus() {
  const project = detectProjectType();
  const workflow = getWorkflowStatus();

  let errors = 0;
  if (project.type === 'ios') {
    const lint = ios.runSwiftLint(project.srcDir);
    errors = lint.errors;
  } else if (project.type === 'android') {
    const lint = android.runKtlint();
    errors = lint.errors;
  }

  const status = errors === 0 ? '✅' : '❌';
  const next = getQuickNext(workflow.phase, errors);

  console.log(`${workflow.phase}|${status}${errors}|${next}`);
}

function getQuickNext(phase: string, errors: number): string {
  if (errors > 0) return 'fix';

  const map: Record<string, string> = {
    IDLE: 'checkout',
    STARTING: 'checkout',
    DEVELOPING: 'commit',
    READY_TO_PUSH: 'push',
    WAITING_QA: 'pr',
    PR_OPEN: 'wait',
    PR_MERGED: 'checkout master',
    READY_TO_RELEASE: 'tag',
  };
  return map[phase] || '';
}

/**
 * Main CLI handler
 */
function main() {
  try {
    switch (command) {
      case 'status':
        quickStatus();
        break;

      default:
        console.error(`Unknown command: ${command}`);
        console.error('Available commands: status (via dev_status)');
        process.exit(1);
    }
  } catch (error) {
    console.error(`Error: ${error instanceof Error ? error.message : String(error)}`);
    process.exit(1);
  }
}

main();
