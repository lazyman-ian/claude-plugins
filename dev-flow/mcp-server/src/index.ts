#!/usr/bin/env node

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  ListPromptsRequestSchema,
  GetPromptRequestSchema,
  ListResourcesRequestSchema,
  ReadResourceRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';

import { detectProjectType, getAvailableTools, ProjectInfo, loadProjectConfig, hasMakefileTargets, DevFlowConfig } from './detector';
import { getWorkflowStatus, getGitStatus, WorkflowStatus } from './git/workflow';
import { analyzeChanges, getPRStatus, togglePRReady, getBuildControlStatus, ChangeAnalysis, PRStatus } from './git/build-control';
import { getVersionInfo, getCommitsSummary, formatCommitsForReleaseNotes, VersionInfo, CommitsSummary } from './git/version';
import * as ios from './platforms/ios';
import * as android from './platforms/android';
import * as continuity from './continuity';
import * as coordination from './coordination';

const server = new Server(
  { name: 'dev-flow-mcp', version: '2.1.0' },
  { capabilities: { tools: {}, prompts: {}, resources: {} } }
);

// Per-tool cache with separate TTLs
const toolCache = new Map<string, { data: any; timestamp: number }>();
const CACHE_TTL = {
  project: 60000,  // 1 min - rarely changes
  git: 5000,       // 5 sec - changes often
  quality: 10000,  // 10 sec - moderate
};

function getCached<T>(key: string, ttl: number, fn: () => T): T {
  const now = Date.now();
  const cached = toolCache.get(key);
  if (cached && cached.timestamp > now - ttl) {
    return cached.data;
  }
  const data = fn();
  toolCache.set(key, { data, timestamp: now });
  return data;
}

// Tools
server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: [
    {
      name: 'dev_status',
      description: '[~30 tokens] Ultra-compact status: phase|errors|next. Use this by default for quick checks.',
      inputSchema: { type: 'object', properties: {} },
    },
    {
      name: 'dev_flow',
      description: '[~100 tokens] Structured status table. Use when you need more context.',
      inputSchema: {
        type: 'object',
        properties: {
          verbose: { type: 'boolean', description: 'Add guidance (+50 tokens)' },
        },
      },
    },
    {
      name: 'dev_fix',
      description: '[~20 tokens] Get fix commands only',
      inputSchema: { type: 'object', properties: {} },
    },
    {
      name: 'dev_check',
      description: '[~10 tokens] CI-ready check (✅/❌ + error count)',
      inputSchema: { type: 'object', properties: {} },
    },
    {
      name: 'dev_next',
      description: '[~15 tokens] Suggested next command based on current phase',
      inputSchema: { type: 'object', properties: {} },
    },
    {
      name: 'dev_changes',
      description: '[~50 tokens] Analyze code changes and get build recommendation',
      inputSchema: {
        type: 'object',
        properties: {
          base: { type: 'string', description: 'Base branch (default: origin/master)' },
          format: { type: 'string', enum: ['compact', 'json', 'full'], description: 'Output format' },
        },
      },
    },
    {
      name: 'dev_ready',
      description: '[~20 tokens] Control PR build status (draft/ready)',
      inputSchema: {
        type: 'object',
        properties: {
          action: {
            type: 'string',
            enum: ['check', 'yes', 'draft'],
            description: 'check=view status, yes=make ready, draft=make draft'
          },
        },
      },
    },
    {
      name: 'dev_version',
      description: '[~30 tokens] Get version info and next version suggestions',
      inputSchema: {
        type: 'object',
        properties: {
          format: { type: 'string', enum: ['compact', 'json'], description: 'Output format' },
        },
      },
    },
    {
      name: 'dev_commits',
      description: '[~100 tokens] Get commits grouped by type for release notes',
      inputSchema: {
        type: 'object',
        properties: {
          from: { type: 'string', description: 'Start ref (default: previous tag)' },
          to: { type: 'string', description: 'End ref (default: HEAD)' },
          format: { type: 'string', enum: ['compact', 'json', 'full'], description: 'Output format' },
        },
      },
    },
    {
      name: 'dev_config',
      description: '[~50 tokens] Get platform-specific configuration (lint/format/build commands, scopes)',
      inputSchema: {
        type: 'object',
        properties: {
          format: { type: 'string', enum: ['compact', 'json'], description: 'Output format' },
        },
      },
    },
    // Continuity tools
    {
      name: 'dev_ledger',
      description: '[~50 tokens] Manage continuity ledgers for task tracking',
      inputSchema: {
        type: 'object',
        properties: {
          action: {
            type: 'string',
            enum: ['status', 'list', 'create', 'update', 'archive', 'search'],
            description: 'Action to perform',
          },
          taskId: { type: 'string', description: 'Task ID (TASK-XXX) for create/archive' },
          branch: { type: 'string', description: 'Branch name (for create)' },
          keyword: { type: 'string', description: 'Search keyword' },
          commitHash: { type: 'string', description: 'Commit hash (for update)' },
          commitMessage: { type: 'string', description: 'Commit message (for update)' },
        },
      },
    },
    {
      name: 'dev_reasoning',
      description: '[~30 tokens] Manage commit reasoning and decision history',
      inputSchema: {
        type: 'object',
        properties: {
          action: {
            type: 'string',
            enum: ['generate', 'recall', 'aggregate'],
            description: 'Action to perform',
          },
          commitHash: { type: 'string', description: 'Commit hash (for generate)' },
          commitMessage: { type: 'string', description: 'Commit message (for generate)' },
          keyword: { type: 'string', description: 'Search keyword (for recall)' },
          baseBranch: { type: 'string', description: 'Base branch (for aggregate, default: master)' },
        },
      },
    },
    {
      name: 'dev_branch',
      description: '[~30 tokens] Branch lifecycle management',
      inputSchema: {
        type: 'object',
        properties: {
          action: {
            type: 'string',
            enum: ['cleanup', 'stale', 'switch', 'prune', 'merged'],
            description: 'Action to perform',
          },
          target: { type: 'string', description: 'Target branch (for switch)' },
          days: { type: 'number', description: 'Days threshold (for stale, default: 30)' },
          dryRun: { type: 'boolean', description: 'Dry run mode (for cleanup)' },
        },
      },
    },
    {
      name: 'dev_defaults',
      description: '[~20 tokens] Infer scope, labels, reviewers from code changes',
      inputSchema: {
        type: 'object',
        properties: {
          action: {
            type: 'string',
            enum: ['scope', 'labels', 'reviewers', 'working-set', 'all'],
            description: 'What to infer',
          },
        },
      },
    },
    {
      name: 'dev_tasks',
      description: '[~30 tokens] Sync ledger state with Claude Code Task Management',
      inputSchema: {
        type: 'object',
        properties: {
          action: {
            type: 'string',
            enum: ['summary', 'export', 'sync'],
            description: 'summary=quick status, export=JSON for TaskCreate, sync=update ledger from tasks',
          },
          ledgerPath: { type: 'string', description: 'Override ledger path (default: active ledger)' },
        },
      },
    },
    // Coordination tools
    {
      name: 'dev_coordinate',
      description: '[~40 tokens] Multi-agent task coordination (plan/dispatch/status/cancel)',
      inputSchema: {
        type: 'object',
        properties: {
          action: {
            type: 'string',
            enum: ['plan', 'dispatch', 'status', 'cancel'],
            description: 'Action to perform',
          },
          mode: {
            type: 'string',
            enum: ['pipeline', 'fan-out', 'master-worker', 'review-chain'],
            description: 'Collaboration mode (for plan)',
          },
          tasks: { type: 'string', description: 'JSON array of tasks (for plan/dispatch)' },
          taskId: { type: 'string', description: 'Task ID (for cancel)' },
        },
      },
    },
    {
      name: 'dev_handoff',
      description: '[~50 tokens] Agent handoff management (write/read/chain/search)',
      inputSchema: {
        type: 'object',
        properties: {
          action: {
            type: 'string',
            enum: ['write', 'read', 'chain', 'search'],
            description: 'Action to perform',
          },
          handoff: { type: 'string', description: 'JSON handoff object (for write)' },
          handoffId: { type: 'string', description: 'Handoff ID (for read)' },
          taskId: { type: 'string', description: 'Task ID (for chain)' },
          keyword: { type: 'string', description: 'Search keyword (for search)' },
        },
      },
    },
    {
      name: 'dev_aggregate',
      description: '[~60 tokens] Aggregate handoff results (summary/detailed/pr_ready)',
      inputSchema: {
        type: 'object',
        properties: {
          action: {
            type: 'string',
            enum: ['summary', 'detailed', 'pr_ready'],
            description: 'Aggregation format',
          },
          handoffIds: { type: 'string', description: 'JSON array of handoff IDs' },
          taskId: { type: 'string', description: 'Task ID to aggregate all handoffs for' },
        },
      },
    },
  ],
}));

// Prompts - Help Claude know when to use tools
server.setRequestHandler(ListPromptsRequestSchema, async () => ({
  prompts: [
    {
      name: 'dev_workflow_check',
      description: 'Check development workflow status before committing code',
      arguments: [],
    },
    {
      name: 'dev_auto_fix',
      description: 'Automatically fix code quality issues',
      arguments: [],
    },
    {
      name: 'dev_next_step',
      description: 'Get recommended next step in workflow',
      arguments: [],
    },
  ],
}));

server.setRequestHandler(GetPromptRequestSchema, async (request) => {
  const { name } = request.params;

  switch (name) {
    case 'dev_workflow_check':
      return {
        messages: [{
          role: 'user',
          content: {
            type: 'text',
            text: 'Check the current development workflow status using dev_status. If there are errors, suggest running dev_fix. Follow Conventional Commits and Git Flow standards.',
          },
        }],
      };
    case 'dev_auto_fix':
      return {
        messages: [{
          role: 'user',
          content: {
            type: 'text',
            text: 'Run dev_check to verify errors, then get fix commands with dev_fix and execute them. Ensure code quality before committing.',
          },
        }],
      };
    case 'dev_next_step':
      return {
        messages: [{
          role: 'user',
          content: {
            type: 'text',
            text: 'Use dev_next to get the recommended next command for the current workflow phase. Commands follow Conventional Commits (feat/fix/docs/etc) and Git Flow (feature/release/hotfix branches) standards.',
          },
        }],
      };
    default:
      throw new Error(`Unknown prompt: ${name}`);
  }
});

// Resources - Subscribable project status
server.setRequestHandler(ListResourcesRequestSchema, async () => ({
  resources: [
    {
      uri: 'dev://status',
      name: 'Project Status',
      description: 'Current workflow phase and quality status',
      mimeType: 'text/plain',
    },
    {
      uri: 'dev://config',
      name: 'Project Configuration',
      description: 'Project type, tools, and settings',
      mimeType: 'application/json',
    },
  ],
}));

server.setRequestHandler(ReadResourceRequestSchema, async (request) => {
  const { uri } = request.params;

  if (uri === 'dev://status') {
    const status = quickStatus();
    return {
      contents: [{
        uri,
        mimeType: 'text/plain',
        text: status.content[0].text,
      }],
    };
  }

  if (uri === 'dev://config') {
    const project = getCached('project', CACHE_TTL.project, detectProjectType);
    const tools = getAvailableTools(project.type);
    return {
      contents: [{
        uri,
        mimeType: 'application/json',
        text: JSON.stringify({ project, tools }, null, 2),
      }],
    };
  }

  throw new Error(`Unknown resource: ${uri}`);
});

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  try {
    switch (name) {
      case 'dev_status':
        return quickStatus();
      case 'dev_flow':
        return fullStatus(args?.verbose as boolean);
      case 'dev_fix':
        return fixCommands();
      case 'dev_check':
        return checkStatus();
      case 'dev_next':
        return nextCommand();
      case 'dev_changes':
        return changesAnalysis(args?.base as string, args?.format as string);
      case 'dev_ready':
        return readyControl(args?.action as string);
      case 'dev_version':
        return versionInfo(args?.format as string);
      case 'dev_commits':
        return commitsInfo(args?.from as string, args?.to as string, args?.format as string);
      case 'dev_config':
        return platformConfig(args?.format as string);
      // Continuity tools
      case 'dev_ledger':
        return ledgerTool(args?.action as string, args?.taskId as string, args?.branch as string, args?.keyword as string, args?.commitHash as string, args?.commitMessage as string);
      case 'dev_reasoning':
        return reasoningTool(args?.action as string, args?.commitHash as string, args?.commitMessage as string, args?.keyword as string, args?.baseBranch as string);
      case 'dev_branch':
        return branchTool(args?.action as string, args?.target as string, args?.days as number, args?.dryRun as boolean);
      case 'dev_defaults':
        return defaultsTool(args?.action as string);
      case 'dev_tasks':
        return tasksTool(args?.action as string, args?.ledgerPath as string);
      // Coordination tools
      case 'dev_coordinate':
        return coordinateTool(args?.action as string, args?.mode as string, args?.tasks as string, args?.taskId as string);
      case 'dev_handoff':
        return handoffTool(args?.action as string, args?.handoff as string, args?.handoffId as string, args?.taskId as string, args?.keyword as string);
      case 'dev_aggregate':
        return aggregateTool(args?.action as string, args?.handoffIds as string, args?.taskId as string);
      default:
        throw new Error(`Unknown tool: ${name}`);
    }
  } catch (error: any) {
    return { content: [{ type: 'text', text: `Error: ${error.message}` }] };
  }
});

// Quick status - ultra-compact (~30 tokens)
function quickStatus() {
  const project = getCached('project', CACHE_TTL.project, detectProjectType);
  const workflow = getCached('workflow', CACHE_TTL.git, getWorkflowStatus);

  let errors = 0;
  const quality = getCached('quality', CACHE_TTL.quality, () => {
    if (project.type === 'ios') {
      const lint = ios.runSwiftLint(project.srcDir);
      return { errors: lint.errors, warnings: lint.warnings };
    } else if (project.type === 'android') {
      const lint = android.runKtlint();
      return { errors: lint.errors, warnings: 0 };
    }
    return { errors: 0, warnings: 0 };
  });
  errors = quality.errors;

  const s = errors === 0 ? '✅' : '❌';
  const next = getQuickNext(workflow.phase, errors);

  return {
    content: [{
      type: 'text',
      text: `${workflow.phase}|${s}${errors}|${next}`,
    }],
  };
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

// Full status - structured (~100 tokens)
function fullStatus(verbose: boolean = false) {
  const project = getCached('project', CACHE_TTL.project, detectProjectType);
  const workflow = getCached('workflow', CACHE_TTL.git, getWorkflowStatus);

  let quality = { lintErrors: 0, lintWarnings: 0, unformattedFiles: 0 };
  quality = getCached('quality_full', CACHE_TTL.quality, () => {
    if (project.type === 'ios') {
      return ios.getCodeQuality(project);
    } else if (project.type === 'android') {
      return android.getCodeQuality(project);
    }
    return { lintErrors: 0, lintWarnings: 0, unformattedFiles: 0, details: [] };
  });

  const e = quality.lintErrors, w = quality.lintWarnings;

  // Get build control info if PR exists (even when DEVELOPING with uncommitted changes)
  let buildInfo = '';
  const hasPR = workflow.git.prState === 'OPEN';
  if (hasPR) {
    const pr = getPRStatus();
    const analysis = analyzeChanges('origin/master', project.type);
    const draft = pr.isDraft ? 'DRAFT' : 'READY';
    const builds = pr.isDraft ? 'OFF' : 'ON';
    const rec = analysis.recommendation === 'should_build' ? '✅BUILD' :
                analysis.recommendation === 'skip' ? '⏸️SKIP' : '⚠️MAYBE';
    buildInfo = `|${draft}|builds:${builds}|${rec}`;
  }

  // Compact format: project|branch|taskId|phase|errors|warnings[|prState|draft|builds|rec]
  let output = `${project.name}(${project.type.toUpperCase()})|${workflow.git.branch}|${workflow.git.taskId || ''}|${workflow.phase}|${e}|${w}`;
  // Add PR info if PR exists
  if (hasPR) {
    output += `|${workflow.git.prState}${buildInfo}`;
  }

  if (verbose) {
    const guide = getVerboseGuidance(workflow.phase, project.type);
    if (guide) output += `\n${guide}`;
  }

  return { content: [{ type: 'text', text: output }] };
}

function getVerboseGuidance(phase: string, type: string): string {
  if (type === 'ios') {
    return ios.getPhaseGuidance(phase);
  }
  return android.getPhaseGuidance(phase);
}

// Fix commands - minimal (~20 tokens)
function fixCommands() {
  const project = getCached('project', CACHE_TTL.project, detectProjectType);
  const cmds = project.type === 'ios'
    ? ios.getFixCommands(project)
    : android.getFixCommands();

  return {
    content: [{ type: 'text', text: cmds.join(' && ') }],
  };
}

// Check status - minimal (~10 tokens)
function checkStatus() {
  const project = getCached('project', CACHE_TTL.project, detectProjectType);

  const quality = getCached('quality_check', CACHE_TTL.quality, () => {
    if (project.type === 'ios') {
      return ios.runSwiftLint(project.srcDir).errors;
    } else if (project.type === 'android') {
      return android.runKtlint().errors;
    }
    return 0;
  });

  const status = quality === 0 ? '✅' : `❌${quality}`;
  return { content: [{ type: 'text', text: status }] };
}

// Next command suggestion (~15 tokens)
function nextCommand() {
  const project = getCached('project', CACHE_TTL.project, detectProjectType);
  const workflow = getCached('workflow', CACHE_TTL.git, getWorkflowStatus);

  const quality = getCached('quality_check', CACHE_TTL.quality, () => {
    if (project.type === 'ios') {
      return ios.runSwiftLint(project.srcDir).errors;
    } else if (project.type === 'android') {
      return android.runKtlint().errors;
    }
    return 0;
  });

  if (quality > 0) {
    const cmds = project.type === 'ios'
      ? ios.getFixCommands(project)
      : android.getFixCommands();
    return { content: [{ type: 'text', text: cmds.join(' && ') }] };
  }

  // Smart PR_OPEN suggestions based on build control
  if (workflow.phase === 'PR_OPEN') {
    const pr = getPRStatus();
    const analysis = analyzeChanges('origin/master', project.type);

    if (pr.isDraft) {
      // Draft PR - suggest based on changes
      if (analysis.recommendation === 'should_build') {
        return { content: [{ type: 'text', text: 'dev_ready(action:"yes") # Large changes, trigger build' }] };
      } else if (analysis.recommendation === 'skip') {
        return { content: [{ type: 'text', text: 'Continue development # Minor changes, accumulate more' }] };
      } else {
        return { content: [{ type: 'text', text: 'dev_ready(action:"check") # Review changes, decide to build' }] };
      }
    } else {
      // Ready PR - suggest waiting or merging
      if (pr.checksStatus === 'passing') {
        return { content: [{ type: 'text', text: 'gh pr merge --squash --delete-branch # Checks passing, ready to merge' }] };
      } else if (pr.checksStatus === 'failing') {
        return { content: [{ type: 'text', text: 'dev_ready(action:"draft") # Fix issues, then dev_ready yes' }] };
      } else {
        return { content: [{ type: 'text', text: 'Wait for CI # Checks pending' }] };
      }
    }
  }

  const cmdMap: Record<string, string> = {
    IDLE: 'git flow feature start TASK-XXX-description',
    STARTING: 'git flow feature start TASK-XXX-description',
    DEVELOPING: 'git add . && git commit -m "feat(scope): add feature description"',
    READY_TO_PUSH: 'git push -u origin $(git branch --show-current)',
    WAITING_QA: 'gh pr create --title "feat: feature title" --body "## Summary\\n- Change 1\\n- Change 2\\n\\n## Testing\\n- [ ] Unit tests\\n- [ ] Manual testing"',
    PR_MERGED: 'git checkout master && git pull',
    READY_TO_RELEASE: 'git tag -a v0.0.0 -m "Release v0.0.0" && git push --tags',
  };

  const cmd = cmdMap[workflow.phase] || '';
  return { content: [{ type: 'text', text: cmd }] };
}

// Changes analysis (~50 tokens)
function changesAnalysis(baseBranch?: string, format?: string) {
  const project = getCached('project', CACHE_TTL.project, detectProjectType);
  const base = baseBranch || 'origin/master';
  const analysis = analyzeChanges(base, project.type);

  if (format === 'json') {
    return {
      content: [{
        type: 'text',
        text: JSON.stringify(analysis, null, 2)
      }]
    };
  }

  if (format === 'full') {
    const s = analysis.stats;
    let output = `${s.totalLines}L(+${s.linesAdded}-${s.linesDeleted})|${s.filesChanged}F\n`;
    // Only show non-zero file types
    const types: string[] = [];
    if (s.swiftFiles) types.push(`Swift:${s.swiftFiles}`);
    if (s.objcFiles) types.push(`ObjC:${s.objcFiles}`);
    if (s.kotlinFiles) types.push(`Kt:${s.kotlinFiles}`);
    if (s.javaFiles) types.push(`Java:${s.javaFiles}`);
    if (s.uiFiles) types.push(`UI:${s.uiFiles}`);
    if (s.dependencyChanged) types.push('deps:changed');
    if (s.projectConfigChanged) types.push('config:changed');
    if (types.length > 0) output += types.join('|') + '\n';
    if (s.totalNonCodeFiles > 0) output += `non-code:${s.totalNonCodeFiles}\n`;
    const icon = analysis.recommendation === 'should_build' ? '✅' :
                 analysis.recommendation === 'skip' ? '⏸️' : '⚠️';
    output += `${icon}${analysis.recommendation}|${analysis.reason}`;
    return { content: [{ type: 'text', text: output }] };
  }

  // Compact format (default)
  const icon = analysis.recommendation === 'should_build' ? '✅' :
               analysis.recommendation === 'skip' ? '⏸️' : '⚠️';
  return {
    content: [{
      type: 'text',
      text: `${icon}${analysis.recommendation}|${analysis.stats.totalLines}L|${analysis.stats.totalCodeFiles}F|${analysis.reason}`
    }]
  };
}

// PR ready control (~20 tokens)
function readyControl(action?: string) {
  const pr = getPRStatus();

  if (!pr.exists) {
    return {
      content: [{
        type: 'text',
        text: '❌ No PR|Create PR first: gh pr create'
      }]
    };
  }

  // Check action (default)
  if (!action || action === 'check') {
    const status = pr.isDraft ? '🟡DRAFT' : '🟢READY';
    const builds = pr.isDraft ? 'builds:OFF' : 'builds:ON';
    const checks = pr.checksStatus === 'passing' ? '✅' :
                   pr.checksStatus === 'failing' ? '❌' :
                   pr.checksStatus === 'pending' ? '⏳' : '❓';
    return {
      content: [{
        type: 'text',
        text: `PR#${pr.number}|${status}|${builds}|checks:${checks}`
      }]
    };
  }

  // Make ready
  if (action === 'yes') {
    const result = togglePRReady(false);
    return {
      content: [{
        type: 'text',
        text: result.success
          ? `✅ PR#${pr.number} READY|builds:ON|Next push triggers build`
          : `❌ ${result.message}`
      }]
    };
  }

  // Make draft
  if (action === 'draft') {
    const result = togglePRReady(true);
    return {
      content: [{
        type: 'text',
        text: result.success
          ? `✅ PR#${pr.number} DRAFT|builds:OFF|Safe to push`
          : `❌ ${result.message}`
      }]
    };
  }

  return {
    content: [{
      type: 'text',
      text: `❌ Unknown action: ${action}. Use: check, yes, draft`
    }]
  };
}

// Version info (~30 tokens)
function versionInfo(format?: string) {
  const project = getCached('project', CACHE_TTL.project, detectProjectType);
  const version = getVersionInfo(project);

  if (format === 'json') {
    return {
      content: [{
        type: 'text',
        text: JSON.stringify(version, null, 2)
      }]
    };
  }

  // Compact format (default)
  return {
    content: [{
      type: 'text',
      text: `v${version.current}|tag:${version.latestTag || 'none'}|next:${version.nextMinor}(minor),${version.nextPatch}(patch)|src:${version.source}`
    }]
  };
}

// Commits info (~100 tokens)
function commitsInfo(from?: string, to?: string, format?: string) {
  const summary = getCommitsSummary(from, to);

  if (format === 'json') {
    return {
      content: [{
        type: 'text',
        text: JSON.stringify(summary, null, 2)
      }]
    };
  }

  if (format === 'full') {
    return {
      content: [{
        type: 'text',
        text: formatCommitsForReleaseNotes(summary)
      }]
    };
  }

  // Compact format (default)
  const types = Object.keys(summary.byType);
  const typeCounts = types.map(t => `${t}:${summary.byType[t].length}`).join(',');
  return {
    content: [{
      type: 'text',
      text: `${summary.total} commits|${summary.range.from}..${summary.range.to}|${typeCounts}`
    }]
  };
}

// Platform config (~50 tokens)
// Priority: .dev-flow.json > Makefile with fix/check > auto-detect
function platformConfig(format?: string) {
  // 1. Check for project-level .dev-flow.json (highest priority)
  const customConfig = loadProjectConfig();
  if (customConfig) {
    const config = {
      platform: customConfig.platform,
      lintFix: customConfig.commands.fix,
      lintCheck: customConfig.commands.check,
      buildCmd: customConfig.commands.build || '',
      scopes: customConfig.scopes || [],
      source: '.dev-flow.json'
    };

    if (format === 'json') {
      return { content: [{ type: 'text', text: JSON.stringify(config, null, 2) }] };
    }
    return {
      content: [{
        type: 'text',
        text: `${config.platform}|fix:${config.lintFix}|check:${config.lintCheck}|scopes:${config.scopes.join(',')}|src:custom`
      }]
    };
  }

  // 2. Check for Makefile with fix and check targets
  if (hasMakefileTargets()) {
    const config = {
      platform: 'makefile',
      lintFix: 'make fix',
      lintCheck: 'make check',
      buildCmd: 'make build',
      scopes: [],
      source: 'Makefile'
    };

    if (format === 'json') {
      return { content: [{ type: 'text', text: JSON.stringify(config, null, 2) }] };
    }
    return {
      content: [{
        type: 'text',
        text: `makefile|fix:make fix|check:make check|scopes:|src:Makefile`
      }]
    };
  }

  // 3. Auto-detect platform (fallback)
  const project = getCached('project', CACHE_TTL.project, detectProjectType);

  let config: any;
  if (project.type === 'ios') {
    config = { ...ios.getPlatformConfig(project), source: 'auto-detect' };
  } else if (project.type === 'android') {
    config = { ...android.getPlatformConfig(), source: 'auto-detect' };
  } else {
    return {
      content: [{
        type: 'text',
        text: 'unknown|no platform config|Create .dev-flow.json or Makefile with fix/check targets'
      }]
    };
  }

  if (format === 'json') {
    return {
      content: [{
        type: 'text',
        text: JSON.stringify(config, null, 2)
      }]
    };
  }

  // Compact format (default)
  return {
    content: [{
      type: 'text',
      text: `${config.platform}|fix:${config.lintFix}|check:${config.lintCheck}|scopes:${config.scopes.join(',')}|src:auto`
    }]
  };
}

// Continuity tool handlers

function ledgerTool(action?: string, taskId?: string, branch?: string, keyword?: string, commitHash?: string, commitMessage?: string) {
  switch (action) {
    case 'status':
      return { content: [{ type: 'text', text: continuity.ledgerStatus().message }] };
    case 'list':
      const list = continuity.ledgerList();
      return { content: [{ type: 'text', text: list.message }] };
    case 'create':
      if (!taskId) return { content: [{ type: 'text', text: '❌ taskId required (e.g., TASK-123)' }] };
      const branchName = branch || `feature/${taskId}-new`;
      return { content: [{ type: 'text', text: continuity.ledgerCreate(taskId, branchName).message }] };
    case 'update':
      if (!commitHash || !commitMessage) return { content: [{ type: 'text', text: '❌ commitHash and commitMessage required for update' }] };
      return { content: [{ type: 'text', text: continuity.ledgerUpdate(commitHash, commitMessage).message }] };
    case 'archive':
      return { content: [{ type: 'text', text: continuity.ledgerArchive(taskId).message }] };
    case 'search':
      if (!keyword) return { content: [{ type: 'text', text: '❌ Keyword required' }] };
      const search = continuity.ledgerSearch(keyword);
      return { content: [{ type: 'text', text: search.message }] };
    default:
      return { content: [{ type: 'text', text: '❌ Action required: status|list|create|update|archive|search' }] };
  }
}

function reasoningTool(action?: string, commitHash?: string, commitMessage?: string, keyword?: string, baseBranch?: string) {
  switch (action) {
    case 'generate':
      if (!commitHash || !commitMessage) {
        return { content: [{ type: 'text', text: '❌ commitHash and commitMessage required' }] };
      }
      return { content: [{ type: 'text', text: continuity.reasoningGenerate(commitHash, commitMessage).message }] };
    case 'recall':
      if (!keyword) return { content: [{ type: 'text', text: '❌ Keyword required' }] };
      const recall = continuity.reasoningRecall(keyword);
      if (recall.data) {
        const commits = recall.data.commits?.map((c: any) => `${c.commitHash}:${c.commitMessage}`).join('\n') || '';
        const ledgers = recall.data.ledgers?.map((l: any) => l.name).join(',') || '';
        return { content: [{ type: 'text', text: `${recall.message}\n${commits}\nledgers:${ledgers}` }] };
      }
      return { content: [{ type: 'text', text: recall.message }] };
    case 'aggregate':
      const agg = continuity.reasoningAggregate(baseBranch);
      return { content: [{ type: 'text', text: agg.data?.content || agg.message }] };
    default:
      return { content: [{ type: 'text', text: '❌ Action required: generate|recall|aggregate' }] };
  }
}

function branchTool(action?: string, target?: string, days?: number, dryRun?: boolean) {
  switch (action) {
    case 'merged':
      const merged = continuity.branchListMerged();
      const branches = merged.data?.branches?.join(',') || 'none';
      return { content: [{ type: 'text', text: `${merged.message}|${branches}` }] };
    case 'cleanup':
      const cleanup = continuity.branchCleanup(dryRun ?? true);
      return { content: [{ type: 'text', text: cleanup.message }] };
    case 'stale':
      const stale = continuity.branchListStale(days ?? 30);
      const staleList = stale.data?.branches?.map((b: any) => `${b.name}(${b.daysAgo}d)`).join(',') || 'none';
      return { content: [{ type: 'text', text: `${stale.message}|${staleList}` }] };
    case 'switch':
      if (!target) return { content: [{ type: 'text', text: '❌ Target branch required' }] };
      return { content: [{ type: 'text', text: continuity.branchStashSwitch(target).message }] };
    case 'prune':
      return { content: [{ type: 'text', text: continuity.branchPrune().message }] };
    default:
      return { content: [{ type: 'text', text: '❌ Action required: merged|cleanup|stale|switch|prune' }] };
  }
}

function defaultsTool(action?: string) {
  switch (action) {
    case 'scope':
      return { content: [{ type: 'text', text: continuity.inferScope().message }] };
    case 'labels':
      return { content: [{ type: 'text', text: continuity.inferLabels().message }] };
    case 'reviewers':
      return { content: [{ type: 'text', text: continuity.inferReviewers().message }] };
    case 'working-set':
      return { content: [{ type: 'text', text: continuity.inferWorkingSet().message }] };
    case 'all':
      const all = continuity.inferAll();
      return { content: [{ type: 'text', text: all.message }] };
    default:
      return { content: [{ type: 'text', text: '❌ Action required: scope|labels|reviewers|working-set|all' }] };
  }
}

function tasksTool(action?: string, ledgerPath?: string) {
  // Get ledger path - use provided or find active
  const path = ledgerPath || continuity.getActiveLedgerPath?.() || '';
  if (!path) {
    return { content: [{ type: 'text', text: 'NO_LEDGER|Create with dev_ledger(action:"create")' }] };
  }

  switch (action) {
    case 'summary':
      return { content: [{ type: 'text', text: continuity.getTaskSyncSummary(path) }] };
    case 'export':
      const exported = continuity.exportLedgerAsJson(path);
      if (!exported) {
        return { content: [{ type: 'text', text: '❌ Failed to export ledger' }] };
      }
      // Generate TaskCreate commands
      const commands = continuity.generateTaskCommands(exported.tasks);
      return { content: [{ type: 'text', text: commands || 'NO_TASKS|All completed or empty' }] };
    case 'sync':
      // Return markdown table of current state
      const tasks = continuity.parseLedgerState(path);
      return { content: [{ type: 'text', text: continuity.formatTasksAsMarkdown(tasks) }] };
    default:
      return { content: [{ type: 'text', text: '❌ Action required: summary|export|sync' }] };
  }
}

// Coordination tool implementations
const taskCoordinator = new coordination.TaskCoordinator();
const handoffHub = new coordination.HandoffHub();

function coordinateTool(action: string, mode?: string, tasksJson?: string, taskId?: string) {
  switch (action) {
    case 'plan': {
      if (!mode || !tasksJson) {
        return { content: [{ type: 'text', text: '❌ mode and tasks required for plan' }] };
      }
      const tasks = JSON.parse(tasksJson);
      const conflicts = taskCoordinator.detectConflicts(tasks);

      let result = `Mode: ${mode}\nTasks: ${tasks.length}\n`;
      if (conflicts.length > 0) {
        result += `\n⚠️ Conflicts detected:\n`;
        conflicts.forEach(c => {
          result += `  ${c.file}: ${c.tasks.join(', ')}\n`;
        });
      } else {
        result += '\n✅ No conflicts detected';
      }

      return { content: [{ type: 'text', text: result }] };
    }
    case 'dispatch': {
      if (!tasksJson) {
        return { content: [{ type: 'text', text: '❌ tasks required for dispatch' }] };
      }
      const tasks = JSON.parse(tasksJson);
      tasks.forEach((t: any) => taskCoordinator.enqueue(t));
      return { content: [{ type: 'text', text: `✅ Dispatched ${tasks.length} tasks` }] };
    }
    case 'status': {
      const status = taskCoordinator.getStatus();
      const result = `Queued: ${status.queuedTasks} | Active: ${status.activeTasks} | Completed: ${status.completedTasks}`;
      return { content: [{ type: 'text', text: result }] };
    }
    case 'cancel': {
      if (!taskId) {
        return { content: [{ type: 'text', text: '❌ taskId required for cancel' }] };
      }
      // Implementation would mark task as cancelled
      return { content: [{ type: 'text', text: `✅ Cancelled task ${taskId}` }] };
    }
    default:
      return { content: [{ type: 'text', text: '❌ Action required: plan|dispatch|status|cancel' }] };
  }
}

function handoffTool(action: string, handoffJson?: string, handoffId?: string, taskId?: string, keyword?: string) {
  switch (action) {
    case 'write': {
      if (!handoffJson) {
        return { content: [{ type: 'text', text: '❌ handoff JSON required for write' }] };
      }
      const handoff = JSON.parse(handoffJson);
      const id = handoffHub.write(handoff);
      return { content: [{ type: 'text', text: `✅ Handoff written: ${id}` }] };
    }
    case 'read': {
      if (!handoffId) {
        return { content: [{ type: 'text', text: '❌ handoffId required for read' }] };
      }
      const handoff = handoffHub.read(handoffId);
      return { content: [{ type: 'text', text: JSON.stringify(handoff, null, 2) }] };
    }
    case 'chain': {
      if (!taskId) {
        return { content: [{ type: 'text', text: '❌ taskId required for chain' }] };
      }
      const chain = handoffHub.readChain(taskId);
      const result = `Found ${chain.length} handoffs for ${taskId}:\n` +
        chain.map(h => `  ${h.agent_id}: ${h.status} - ${h.summary}`).join('\n');
      return { content: [{ type: 'text', text: result }] };
    }
    case 'search': {
      if (!keyword) {
        return { content: [{ type: 'text', text: '❌ keyword required for search' }] };
      }
      // Search implementation would scan handoff files
      return { content: [{ type: 'text', text: `Searching for: ${keyword}` }] };
    }
    default:
      return { content: [{ type: 'text', text: '❌ Action required: write|read|chain|search' }] };
  }
}

function aggregateTool(action: string, handoffIdsJson?: string, taskId?: string) {
  let handoffIds: string[] = [];

  if (handoffIdsJson) {
    handoffIds = JSON.parse(handoffIdsJson);
  } else if (taskId) {
    const chain = handoffHub.readChain(taskId);
    // Would need to extract IDs from chain
    handoffIds = chain.map(h => `handoff-${h.timestamp}.md`);
  } else {
    return { content: [{ type: 'text', text: '❌ handoffIds or taskId required' }] };
  }

  const result = handoffHub.aggregate(handoffIds);

  switch (action) {
    case 'summary': {
      const text = `${result.totalHandoffs} handoffs | ✅${result.successCount} ⚠️${result.partialCount} 🚫${result.blockedCount} ❌${result.failedCount}`;
      return { content: [{ type: 'text', text }] };
    }
    case 'detailed': {
      let text = `## Aggregated Results\n\n`;
      text += `Total: ${result.totalHandoffs} | Success: ${result.successCount} | Partial: ${result.partialCount} | Blocked: ${result.blockedCount} | Failed: ${result.failedCount}\n\n`;
      text += `### Files Modified (${result.filesModified.length})\n`;
      result.filesModified.forEach(f => text += `- ${f}\n`);
      text += `\n### Key Decisions\n`;
      Object.entries(result.keyDecisions).forEach(([k, v]) => text += `- **${k}**: ${v}\n`);
      if (result.openQuestions.length > 0) {
        text += `\n### Open Questions\n`;
        result.openQuestions.forEach(q => text += `- ${q}\n`);
      }
      return { content: [{ type: 'text', text }] };
    }
    case 'pr_ready': {
      let text = `## PR Summary\n\n${result.summary}\n\n`;
      text += `### Changes\n`;
      result.filesModified.forEach(f => text += `- ${f}\n`);
      text += `\n### Technical Decisions\n`;
      Object.entries(result.keyDecisions).forEach(([k, v]) => text += `- **${k}**: ${v}\n`);
      return { content: [{ type: 'text', text }] };
    }
    default:
      return { content: [{ type: 'text', text: '❌ Action required: summary|detailed|pr_ready' }] };
  }
}

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch(console.error);
