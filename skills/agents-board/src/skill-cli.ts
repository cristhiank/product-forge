#!/usr/bin/env node
/**
 * Agent Collaboration Board - CLI Entry Point
 * 
 * Dual-mode CLI for board operations:
 * 1. Command mode: Direct operations via flags
 * 2. Exec mode: JavaScript composition via sandbox
 */

import { getBoardManager } from "./manager/index.js";
import { executeCode } from "./sandbox/index.js";
import type { AgentRole, Evidence, Alternative } from "./types/core.js";

// ============================================================
// TYPES
// ============================================================

interface ParsedArgs {
  command: string;
  flags: Map<string, string>;
  positional: string[];
}

// ============================================================
// ARG PARSING
// ============================================================

function parseArgs(argv: string[]): ParsedArgs {
  const flags = new Map<string, string>();
  const positional: string[] = [];
  let command = "";

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];

    if (arg.startsWith("--")) {
      // Flag: --key value or --key=value
      const flagName = arg.slice(2);
      if (flagName.includes("=")) {
        const [key, ...valueParts] = flagName.split("=");
        flags.set(key, valueParts.join("="));
      } else if (i + 1 < argv.length && !argv[i + 1].startsWith("--")) {
        flags.set(flagName, argv[i + 1]);
        i++;
      } else {
        flags.set(flagName, "true");
      }
    } else if (!command) {
      command = arg;
    } else {
      positional.push(arg);
    }
  }

  return { command, flags, positional };
}

function getFlag(flags: Map<string, string>, key: string): string | undefined {
  return flags.get(key);
}

function requireFlag(flags: Map<string, string>, key: string): string {
  const value = flags.get(key);
  if (!value) {
    throw new Error(`Missing required flag: --${key}`);
  }
  return value;
}

function parseArrayFlag(flags: Map<string, string>, key: string): string[] {
  const value = flags.get(key);
  if (!value) return [];
  return value.split(",").map(s => s.trim()).filter(Boolean);
}

// ============================================================
// OUTPUT HELPERS
// ============================================================

function success(data: unknown): void {
  console.log(JSON.stringify(data, null, 2));
  process.exit(0);
}

function error(message: string): never {
  console.error(JSON.stringify({ error: message }, null, 2));
  process.exit(1);
}

// ============================================================
// HELP TEXT
// ============================================================

const HELP_TEXT = `
Agent Collaboration Board CLI

USAGE:
  node dist/skill-cli.js <command> [--flags]

MODES:
  1. Command mode: Direct operations via flags
  2. Exec mode: JavaScript composition via sandbox

TASK LIFECYCLE:
  create-task        Create new task
    --goal           Task goal (required)
    --context        Additional context
    --constraints    Comma-separated constraints
    --path           Project path (default: cwd)

  list-tasks         List all tasks
    --path           Project path (default: cwd)

  archive-task       Archive a task
    --task-id        Task ID (required)
    --path           Project path (default: cwd)

FACTS:
  add-fact           Add a new fact
    --task-id        Task ID (required)
    --agent          Agent role (required)
    --content        Fact content (required)
    --confidence     high|medium|low (required)
    --evidence       JSON array of evidence (required)
    --tags           Comma-separated tags
    --path           Project path (default: cwd)

  get-facts          Get facts with optional filters
    --task-id        Task ID (required)
    --confidence     Comma-separated confidence levels
    --tags           Comma-separated tags
    --verified       true|false
    --path           Project path (default: cwd)

SNIPPETS:
  add-snippet        Add a context snippet
    --task-id        Task ID (required)
    --agent          Agent role (required)
    --content        Snippet content (required)
    --purpose        Purpose description (required)
    --path-file      File path
    --lines          JSON array [start, end]
    --tags           Comma-separated tags
    --linked-to      Comma-separated entity IDs
    --path           Project path (default: cwd)

  get-snippets       Get snippets with optional filters
    --task-id        Task ID (required)
    --tags           Comma-separated tags
    --path-file      File path filter
    --staleness      fresh|warn|stale|all
    --path           Project path (default: cwd)

PLAN:
  set-plan           Set execution plan
    --task-id        Task ID (required)
    --agent          Agent role (required)
    --goal           Plan goal (required)
    --approach       Plan approach (required)
    --steps          JSON array of steps (required)
    --path           Project path (default: cwd)

  get-plan           Get execution plan
    --task-id        Task ID (required)
    --path           Project path (default: cwd)

  advance-step       Move to next step
    --task-id        Task ID (required)
    --agent          Agent role (required)
    --path           Project path (default: cwd)

  complete-step      Complete current step
    --task-id        Task ID (required)
    --agent          Agent role (required)
    --files-changed  Comma-separated files
    --files-created  Comma-separated files
    --verification   true|false (required)
    --notes          Optional notes
    --path           Project path (default: cwd)

  fail-step          Mark step as failed
    --task-id        Task ID (required)
    --agent          Agent role (required)
    --reason         Failure reason (required)
    --path           Project path (default: cwd)

DECISIONS:
  propose-decision   Propose a decision
    --task-id        Task ID (required)
    --agent          Agent role (required)
    --title          Decision title (required)
    --description    Decision description (required)
    --rationale      Decision rationale (required)
    --alternatives   JSON array of alternatives
    --based-on       Comma-separated fact IDs
    --tags           Comma-separated tags
    --path           Project path (default: cwd)

  approve-decision   Approve a decision
    --task-id        Task ID (required)
    --agent          Agent role (required)
    --id             Decision ID (required)
    --affects        Comma-separated step IDs
    --path           Project path (default: cwd)

ALERTS:
  raise-alert        Raise an alert
    --task-id        Task ID (required)
    --agent          Agent role (required)
    --severity       blocker|major|minor|info (required)
    --title          Alert title (required)
    --description    Alert description (required)
    --blocking-step  Step ID
    --tags           Comma-separated tags
    --path           Project path (default: cwd)

  resolve-alert      Resolve an alert
    --task-id        Task ID (required)
    --agent          Agent role (required)
    --id             Alert ID (required)
    --resolution     Resolution description (required)
    --path           Project path (default: cwd)

  get-alerts         Get alerts with optional filters
    --task-id        Task ID (required)
    --severity       Comma-separated severity levels
    --resolved       true|false
    --path           Project path (default: cwd)

  checkpoint         Create a checkpoint
    --task-id        Task ID (required)
    --agent          Agent role (required)
    --message        Checkpoint message (required)
    --path           Project path (default: cwd)

TRAILS:
  append-trail       Append a trail entry
    --task-id        Task ID (required)
    --agent          Agent role (required)
    --marker         Trail marker (required)
    --summary        Trail summary (required)
    --details        JSON details object (required)
    --evidence       Comma-separated references
    --path           Project path (default: cwd)

  get-trails         Get trails with optional filters
    --task-id        Task ID (required)
    --marker         Trail marker filter
    --agent          Agent filter
    --limit          Max results
    --path           Project path (default: cwd)

STATUS:
  view               Get board status view
    --task-id        Task ID (required)
    --mode           status|minimal|enhanced (default: status)
    --agent          Agent role (for minimal/enhanced)
    --path           Project path (default: cwd)

  update-status      Update board status
    --task-id        Task ID (required)
    --agent          Agent role (required)
    --phase          Task phase
    --classification simple|standard|complex
    --path           Project path (default: cwd)

SEARCH:
  search             Search the board
    --task-id        Task ID (required)
    --text           Search text
    --types          Comma-separated entity types
    --tags           Comma-separated tags
    --limit          Max results
    --path           Project path (default: cwd)

CODE EXECUTION:
  exec               Execute JavaScript code
    --task-id        Task ID (required)
    --agent          Agent role (required)
    --code           JavaScript code (required)
    --timeout        Timeout in ms (default: 5000)
    --path           Project path (default: cwd)

HELP:
  help               Show this help message

EXAMPLES:
  # Create a task
  node dist/skill-cli.js create-task --goal "Implement auth" --context "Add JWT"

  # Add a fact
  node dist/skill-cli.js add-fact --task-id 20240101-120000-000 --agent scout \\
    --content "Uses Express" --confidence high \\
    --evidence '[{"type":"file","reference":"package.json"}]'

  # Execute code
  node dist/skill-cli.js exec --task-id 20240101-120000-000 --agent orchestrator \\
    --code 'return board.getFacts({ confidence: ["high"] })'

  # Get status view
  node dist/skill-cli.js view --task-id 20240101-120000-000
`;

// ============================================================
// COMMAND HANDLERS
// ============================================================

async function handleCreateTask(flags: Map<string, string>): Promise<void> {
  const goal = requireFlag(flags, "goal");
  const context = getFlag(flags, "context");
  const constraintsStr = getFlag(flags, "constraints");
  const projectPath = getFlag(flags, "path") || process.cwd();

  const constraints = constraintsStr
    ? constraintsStr.split(",").map(s => s.trim()).filter(Boolean)
    : undefined;

  const manager = getBoardManager(projectPath);
  const result = manager.createTask({ goal, context, constraints });

  success(result);
}

async function handleListTasks(flags: Map<string, string>): Promise<void> {
  const projectPath = getFlag(flags, "path") || process.cwd();
  const manager = getBoardManager(projectPath);
  const tasks = manager.listTasks();

  success({ tasks });
}

async function handleArchiveTask(flags: Map<string, string>): Promise<void> {
  const taskId = requireFlag(flags, "task-id");
  const projectPath = getFlag(flags, "path") || process.cwd();

  const manager = getBoardManager(projectPath);
  manager.archiveTask(taskId);

  success({ archived: taskId });
}

async function handleAddFact(flags: Map<string, string>): Promise<void> {
  const taskId = requireFlag(flags, "task-id");
  const agent = requireFlag(flags, "agent") as AgentRole;
  const content = requireFlag(flags, "content");
  const confidence = requireFlag(flags, "confidence") as "high" | "medium" | "low";
  const evidenceJson = requireFlag(flags, "evidence");
  const projectPath = getFlag(flags, "path") || process.cwd();

  const evidence = JSON.parse(evidenceJson) as Evidence[];
  const tags = parseArrayFlag(flags, "tags");

  const manager = getBoardManager(projectPath);
  const board = manager.getBoard(taskId);

  const fact = board.addFact(agent, {
    content,
    confidence,
    evidence,
    tags,
  });

  success({ fact });
}

async function handleGetFacts(flags: Map<string, string>): Promise<void> {
  const taskId = requireFlag(flags, "task-id");
  const projectPath = getFlag(flags, "path") || process.cwd();

  const manager = getBoardManager(projectPath);
  const board = manager.getBoard(taskId);

  const confidenceFilter = parseArrayFlag(flags, "confidence") as Array<"high" | "medium" | "low">;
  const tagsFilter = parseArrayFlag(flags, "tags");
  const verifiedStr = getFlag(flags, "verified");
  const verified = verifiedStr ? verifiedStr === "true" : undefined;

  const facts = board.getFacts({
    confidence: confidenceFilter.length > 0 ? confidenceFilter : undefined,
    tags: tagsFilter.length > 0 ? tagsFilter : undefined,
    verified,
  });

  success({ facts });
}

async function handleAddSnippet(flags: Map<string, string>): Promise<void> {
  const taskId = requireFlag(flags, "task-id");
  const agent = requireFlag(flags, "agent") as AgentRole;
  const content = requireFlag(flags, "content");
  const purpose = requireFlag(flags, "purpose");
  const projectPath = getFlag(flags, "path") || process.cwd();

  const pathFile = getFlag(flags, "path-file");
  const linesJson = getFlag(flags, "lines");
  const lines = linesJson ? JSON.parse(linesJson) as [number, number] : undefined;
  const tags = parseArrayFlag(flags, "tags");
  const linkedTo = parseArrayFlag(flags, "linked-to");

  const manager = getBoardManager(projectPath);
  const board = manager.getBoard(taskId);

  const snippet = board.addSnippet(agent, {
    content,
    purpose,
    path: pathFile,
    lines,
    tags,
    linked_to: linkedTo.length > 0 ? linkedTo as any[] : undefined,
  });

  success({ snippet });
}

async function handleGetSnippets(flags: Map<string, string>): Promise<void> {
  const taskId = requireFlag(flags, "task-id");
  const projectPath = getFlag(flags, "path") || process.cwd();

  const manager = getBoardManager(projectPath);
  const board = manager.getBoard(taskId);

  const tags = parseArrayFlag(flags, "tags");
  const pathFile = getFlag(flags, "path-file");
  const staleness = getFlag(flags, "staleness") as "fresh" | "warn" | "stale" | "all" | undefined;

  const snippets = board.getSnippets({
    tags: tags.length > 0 ? tags : undefined,
    path: pathFile,
    staleness,
  });

  success({ snippets });
}

async function handleSetPlan(flags: Map<string, string>): Promise<void> {
  const taskId = requireFlag(flags, "task-id");
  const agent = requireFlag(flags, "agent") as AgentRole;
  const goal = requireFlag(flags, "goal");
  const approach = requireFlag(flags, "approach");
  const stepsJson = requireFlag(flags, "steps");
  const projectPath = getFlag(flags, "path") || process.cwd();

  const steps = JSON.parse(stepsJson) as Array<{
    action: string;
    files: string[];
    depends_on?: number[];
    verification: string;
  }>;

  const manager = getBoardManager(projectPath);
  const board = manager.getBoard(taskId);

  const plan = board.setPlan(agent, { goal, approach, steps });

  success({ plan });
}

async function handleGetPlan(flags: Map<string, string>): Promise<void> {
  const taskId = requireFlag(flags, "task-id");
  const projectPath = getFlag(flags, "path") || process.cwd();

  const manager = getBoardManager(projectPath);
  const board = manager.getBoard(taskId);

  const plan = board.getPlan();

  success({ plan });
}

async function handleAdvanceStep(flags: Map<string, string>): Promise<void> {
  const taskId = requireFlag(flags, "task-id");
  const agent = requireFlag(flags, "agent") as AgentRole;
  const projectPath = getFlag(flags, "path") || process.cwd();

  const manager = getBoardManager(projectPath);
  const board = manager.getBoard(taskId);

  const result = board.advanceStep(agent);

  success({ result });
}

async function handleCompleteStep(flags: Map<string, string>): Promise<void> {
  const taskId = requireFlag(flags, "task-id");
  const agent = requireFlag(flags, "agent") as AgentRole;
  const verificationStr = requireFlag(flags, "verification");
  const projectPath = getFlag(flags, "path") || process.cwd();

  const filesChanged = parseArrayFlag(flags, "files-changed");
  const filesCreated = parseArrayFlag(flags, "files-created");
  const notes = getFlag(flags, "notes");
  const verificationPassed = verificationStr === "true";

  const manager = getBoardManager(projectPath);
  const board = manager.getBoard(taskId);

  const result = board.completeStep(agent, {
    result: {
      files_changed: filesChanged,
      files_created: filesCreated,
      verification_passed: verificationPassed,
      notes,
    },
  });

  success({ result });
}

async function handleFailStep(flags: Map<string, string>): Promise<void> {
  const taskId = requireFlag(flags, "task-id");
  const agent = requireFlag(flags, "agent") as AgentRole;
  const reason = requireFlag(flags, "reason");
  const projectPath = getFlag(flags, "path") || process.cwd();

  const manager = getBoardManager(projectPath);
  const board = manager.getBoard(taskId);

  const result = board.failStep(agent, { reason });

  success({ result });
}

async function handleProposeDecision(flags: Map<string, string>): Promise<void> {
  const taskId = requireFlag(flags, "task-id");
  const agent = requireFlag(flags, "agent") as AgentRole;
  const title = requireFlag(flags, "title");
  const description = requireFlag(flags, "description");
  const rationale = requireFlag(flags, "rationale");
  const projectPath = getFlag(flags, "path") || process.cwd();

  const alternativesJson = getFlag(flags, "alternatives");
  const alternatives = alternativesJson ? JSON.parse(alternativesJson) as Alternative[] : undefined;
  const basedOn = parseArrayFlag(flags, "based-on");
  const tags = parseArrayFlag(flags, "tags");

  const manager = getBoardManager(projectPath);
  const board = manager.getBoard(taskId);

  const decision = board.proposeDecision(agent, {
    title,
    description,
    rationale,
    alternatives,
    based_on: basedOn.length > 0 ? basedOn as any[] : undefined,
    tags,
  });

  success({ decision });
}

async function handleApproveDecision(flags: Map<string, string>): Promise<void> {
  const taskId = requireFlag(flags, "task-id");
  const agent = requireFlag(flags, "agent") as AgentRole;
  const id = requireFlag(flags, "id");
  const projectPath = getFlag(flags, "path") || process.cwd();

  const affects = parseArrayFlag(flags, "affects");

  const manager = getBoardManager(projectPath);
  const board = manager.getBoard(taskId);

  const decision = board.approveDecision(agent, {
    id,
    affects: affects.length > 0 ? affects as any[] : undefined,
  });

  success({ decision });
}

async function handleRaiseAlert(flags: Map<string, string>): Promise<void> {
  const taskId = requireFlag(flags, "task-id");
  const agent = requireFlag(flags, "agent") as AgentRole;
  const severity = requireFlag(flags, "severity") as "blocker" | "major" | "minor" | "info";
  const title = requireFlag(flags, "title");
  const description = requireFlag(flags, "description");
  const projectPath = getFlag(flags, "path") || process.cwd();

  const blockingStep = getFlag(flags, "blocking-step");
  const tags = parseArrayFlag(flags, "tags");

  const manager = getBoardManager(projectPath);
  const board = manager.getBoard(taskId);

  const alert = board.raiseAlert(agent, {
    severity,
    title,
    description,
    blocking_step: blockingStep as any,
    tags,
  });

  success({ alert });
}

async function handleResolveAlert(flags: Map<string, string>): Promise<void> {
  const taskId = requireFlag(flags, "task-id");
  const agent = requireFlag(flags, "agent") as AgentRole;
  const id = requireFlag(flags, "id");
  const resolution = requireFlag(flags, "resolution");
  const projectPath = getFlag(flags, "path") || process.cwd();

  const manager = getBoardManager(projectPath);
  const board = manager.getBoard(taskId);

  const alert = board.resolveAlert(agent, { id, resolution });

  success({ alert });
}

async function handleGetAlerts(flags: Map<string, string>): Promise<void> {
  const taskId = requireFlag(flags, "task-id");
  const projectPath = getFlag(flags, "path") || process.cwd();

  const manager = getBoardManager(projectPath);
  const board = manager.getBoard(taskId);

  const severityFilter = parseArrayFlag(flags, "severity") as Array<"blocker" | "major" | "minor" | "info">;
  const resolvedStr = getFlag(flags, "resolved");
  const resolved = resolvedStr ? resolvedStr === "true" : undefined;

  const alerts = board.getAlerts({
    severity: severityFilter.length > 0 ? severityFilter : undefined,
    resolved,
  });

  success({ alerts });
}

async function handleCheckpoint(flags: Map<string, string>): Promise<void> {
  const taskId = requireFlag(flags, "task-id");
  const agent = requireFlag(flags, "agent") as AgentRole;
  const message = requireFlag(flags, "message");
  const projectPath = getFlag(flags, "path") || process.cwd();

  const manager = getBoardManager(projectPath);
  const board = manager.getBoard(taskId);

  // Get current board state summary
  const status = board.getStatus();
  const plan = board.getPlan();
  const facts = board.getFacts({});
  const snippets = board.getSnippets({});
  const alerts = board.getAlerts({ resolved: false });

  const stateSnapshot = {
    phase: status.phase,
    steps_done: plan ? status.current_step : 0,
    steps_total: plan ? status.total_steps : 0,
    facts_count: facts.length,
    snippets_count: snippets.length,
    unresolved_alerts: alerts.length,
  };

  // Create checkpoint alert
  const alert = board.raiseAlert(agent, {
    severity: "info",
    title: `Checkpoint: ${message}`,
    description: `Board state: ${JSON.stringify(stateSnapshot, null, 2)}`,
    tags: ["checkpoint"],
  });

  const checkpoint = {
    alert_id: alert.id,
    message,
    timestamp: alert.raised_at,
    state: stateSnapshot,
  };

  success({ checkpoint });
}

async function handleAppendTrail(flags: Map<string, string>): Promise<void> {
  const taskId = requireFlag(flags, "task-id");
  const agent = requireFlag(flags, "agent") as AgentRole;
  const marker = requireFlag(flags, "marker");
  const summary = requireFlag(flags, "summary");
  const details = getFlag(flags, "details");
  const projectPath = getFlag(flags, "path") || process.cwd();

  const evidence = parseArrayFlag(flags, "evidence");

  const manager = getBoardManager(projectPath);
  const board = manager.getBoard(taskId);

  const trail = board.appendTrail(agent, {
    marker: marker as any,
    summary,
    details: details ? { text: details } : {},
    evidence,
  });

  success({ trail });
}

async function handleGetTrails(flags: Map<string, string>): Promise<void> {
  const taskId = requireFlag(flags, "task-id");
  const projectPath = getFlag(flags, "path") || process.cwd();

  const manager = getBoardManager(projectPath);
  const board = manager.getBoard(taskId);

  const marker = getFlag(flags, "marker");
  const limitStr = getFlag(flags, "limit");
  const limit = limitStr ? parseInt(limitStr, 10) : undefined;

  const trails = board.getTrails({
    markers: marker ? [marker as any] : undefined,
    limit,
  });

  success({ trails });
}

async function handleView(flags: Map<string, string>): Promise<void> {
  const taskId = requireFlag(flags, "task-id");
  const projectPath = getFlag(flags, "path") || process.cwd();

  const mode = getFlag(flags, "mode") || "status";
  const agent = getFlag(flags, "agent") as AgentRole | undefined;

  const manager = getBoardManager(projectPath);
  const board = manager.getBoard(taskId);

  if (mode === "status") {
    const status = board.getStatus();
    const mission = board.getMission();
    const alerts = board.getAlerts({ resolved: false });

    success({
      task_id: taskId,
      phase: status.phase,
      current_step: status.current_step,
      total_steps: status.total_steps,
      goal: mission.goal,
      unresolved_alerts: alerts.length,
      progress: status.progress,
      verification: status.verification,
    });
  } else if (mode === "minimal" && agent) {
    const view = board.compileView({
      agent,
      budget: { max_tokens: 1000 },
    });
    success({ view });
  } else if (mode === "enhanced" && agent) {
    const view = board.compileEnhancedView({
      agent,
      focus: {},
      budget: { max_tokens: 1000 },
    });
    success({ view });
  } else {
    error(`Invalid mode or missing agent for mode: ${mode}`);
  }
}

async function handleUpdateStatus(flags: Map<string, string>): Promise<void> {
  const taskId = requireFlag(flags, "task-id");
  const agent = requireFlag(flags, "agent") as AgentRole;
  const projectPath = getFlag(flags, "path") || process.cwd();

  const phase = getFlag(flags, "phase");
  const classification = getFlag(flags, "classification");

  const manager = getBoardManager(projectPath);
  const board = manager.getBoard(taskId);

  const status = board.updateStatus(agent, {
    phase: phase as any,
    classification: classification as any,
  });

  success({ status });
}

async function handleSearch(flags: Map<string, string>, positional: string[]): Promise<void> {
  const taskId = requireFlag(flags, "task-id");
  const projectPath = getFlag(flags, "path") || process.cwd();

  // Accept search text from --text flag or as positional argument
  const text = getFlag(flags, "text") || positional.join(" ") || undefined;
  const types = parseArrayFlag(flags, "types");
  const tags = parseArrayFlag(flags, "tags");
  const limitStr = getFlag(flags, "limit");
  const limit = limitStr ? parseInt(limitStr, 10) : undefined;

  const manager = getBoardManager(projectPath);
  const board = manager.getBoard(taskId);

  const results = board.search({
    text,
    filters: {
      types: types.length > 0 ? types as any[] : undefined,
      tags: tags.length > 0 ? tags : undefined,
    },
    options: {
      limit,
    },
  });

  success({ results });
}

async function handleExec(flags: Map<string, string>): Promise<void> {
  const taskId = requireFlag(flags, "task-id");
  const agent = requireFlag(flags, "agent") as AgentRole;
  const code = requireFlag(flags, "code");
  const projectPath = getFlag(flags, "path") || process.cwd();

  const timeoutStr = getFlag(flags, "timeout");
  const timeout = timeoutStr ? parseInt(timeoutStr, 10) : 5000;

  const manager = getBoardManager(projectPath);
  const board = manager.getBoard(taskId);

  const result = await executeCode(board, { code, agent, timeout });

  success(result);
}

// ============================================================
// MAIN
// ============================================================

async function main(): Promise<void> {
  const args = process.argv.slice(2);

  if (args.length === 0 || args[0] === "help" || args[0] === "--help" || args[0] === "-h") {
    console.log(HELP_TEXT);
    process.exit(0);
  }

  const parsed = parseArgs(args);

  try {
    switch (parsed.command) {
      // Task lifecycle
      case "create-task":
        await handleCreateTask(parsed.flags);
        break;
      case "list-tasks":
        await handleListTasks(parsed.flags);
        break;
      case "archive-task":
        await handleArchiveTask(parsed.flags);
        break;

      // Facts
      case "add-fact":
        await handleAddFact(parsed.flags);
        break;
      case "get-facts":
        await handleGetFacts(parsed.flags);
        break;

      // Snippets
      case "add-snippet":
        await handleAddSnippet(parsed.flags);
        break;
      case "get-snippets":
        await handleGetSnippets(parsed.flags);
        break;

      // Plan
      case "set-plan":
        await handleSetPlan(parsed.flags);
        break;
      case "get-plan":
        await handleGetPlan(parsed.flags);
        break;
      case "advance-step":
        await handleAdvanceStep(parsed.flags);
        break;
      case "complete-step":
        await handleCompleteStep(parsed.flags);
        break;
      case "fail-step":
        await handleFailStep(parsed.flags);
        break;

      // Decisions
      case "propose-decision":
        await handleProposeDecision(parsed.flags);
        break;
      case "approve-decision":
        await handleApproveDecision(parsed.flags);
        break;

      // Alerts
      case "raise-alert":
        await handleRaiseAlert(parsed.flags);
        break;
      case "resolve-alert":
        await handleResolveAlert(parsed.flags);
        break;
      case "get-alerts":
        await handleGetAlerts(parsed.flags);
        break;
      case "checkpoint":
        await handleCheckpoint(parsed.flags);
        break;

      // Trails
      case "append-trail":
        await handleAppendTrail(parsed.flags);
        break;
      case "get-trails":
        await handleGetTrails(parsed.flags);
        break;

      // Status
      case "view":
        await handleView(parsed.flags);
        break;
      case "update-status":
        await handleUpdateStatus(parsed.flags);
        break;

      // Search
      case "search":
        await handleSearch(parsed.flags, parsed.positional);
        break;

      // Code execution
      case "exec":
        await handleExec(parsed.flags);
        break;

      default:
        error(`Unknown command: ${parsed.command}\n\nRun 'help' to see available commands.`);
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    error(message);
  }
}

// Run main - entry point detection
main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});

export { main, parseArgs };
