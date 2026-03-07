# Forge Plugin Bundle — Design, Hooks & SDK Migration

## Overview

Bundle the Forge agent system + core skills as a single GitHub Copilot CLI plugin,
installable via `copilot plugin install` and upgradeable as a unit.

## Plugin Specification

### plugin.json

```json
{
  "name": "forge",
  "description": "Forge dev partner — dispatch coordinator with specialized skills for product, architecture, backlog, and parallel execution.",
  "version": "1.0.0",
  "author": {
    "name": "Cris Lopez"
  },
  "repository": "https://github.com/cristhiank/mcps",
  "license": "MIT",
  "keywords": ["dev-partner", "coordinator", "multi-agent", "architecture", "backlog"],
  "category": "development",
  "agents": "agents/",
  "skills": "skills/",
  "hooks": "hooks/hooks.json",
  "mcpServers": ".mcp.json"
}
```

### Installation

```bash
# From GitHub repo
copilot plugin install cristhiank/mcps

# From local path (during development)
copilot plugin install ./

# From repo subdirectory (if plugin lives in a subfolder)
copilot plugin install cristhiank/mcps:plugins/forge
```

### File Locations After Install

```
~/.copilot/state/installed-plugins/forge/
├── plugin.json
├── agents/
│   └── Forge.agent.md
├── skills/
│   ├── forge/SKILL.md
│   ├── forge-explore/SKILL.md
│   ├── forge-ideate/SKILL.md
│   ├── forge-plan/SKILL.md
│   ├── forge-execute/SKILL.md
│   ├── forge-verify/SKILL.md
│   ├── forge-memory/SKILL.md
│   ├── forge-product/
│   │   ├── SKILL.md
│   │   ├── scripts/index.js
│   │   └── references/storage.md
│   ├── experts-council/SKILL.md
│   ├── backlog/
│   │   ├── SKILL.md
│   │   ├── scripts/index.js
│   │   └── references/
│   ├── agents-hub/
│   │   ├── SKILL.md
│   │   ├── scripts/index.js
│   │   └── references/
│   ├── copilot-cli-skill/
│   │   ├── SKILL.md
│   │   ├── scripts/index.js
│   │   └── references/
│   ├── backend-architecture/
│   │   ├── SKILL.md
│   │   └── references/
│   └── frontend-architecture/
│       ├── SKILL.md
│       └── references/
└── hooks/hooks.json (optional)
```

## Bundle Components

### Core Agent

| Component | Source | Published As |
|-----------|--------|-------------|
| Forge coordinator | `agents/forge/forge.agent.md` | `agents/Forge.agent.md` |

### Mode Skills (forge-internal, loaded by subagents)

| Skill | Source | Function |
|-------|--------|----------|
| `forge` | `agents/forge/SKILL.md` | Coordinator brain — intent tree, routing, phase machine |
| `forge-explore` | `agents/forge/modes/explore.md` | Codebase investigation, tier classification |
| `forge-ideate` | `agents/forge/modes/ideate.md` | Approach generation, contrarian options |
| `forge-plan` | `agents/forge/modes/plan.md` | Atomic execution plans, DONE WHEN |
| `forge-execute` | `agents/forge/modes/execute.md` | Implementation, interleaved testing |
| `forge-verify` | `agents/forge/modes/verify.md` | Independent validation, hallucination detection |
| `forge-memory` | `agents/forge/modes/memory.md` | Durable memory extraction |
| `forge-product` | `agents/forge/modes/product.md` | Product discovery, design, validate |

### Infrastructure Skills (standalone, used by coordinator + workers)

| Skill | Source | Function | Has Scripts |
|-------|--------|----------|:-----------:|
| `experts-council` | `skills/experts-council/` | 3-model deliberation protocol | No |
| `backlog` | `skills/backlog/` | Work item tracking, prioritization | Yes (ncc bundle) |
| `agents-hub` | `skills/agents-hub/` | Worker coordination, message bus | Yes (ncc bundle) |
| `copilot-cli-skill` | `skills/copilot-cli-skill/` | Worker spawning, worktree management | Yes (ncc bundle) |

### Architecture Skills (reference, loaded by subagents)

| Skill | Source | Function | Has References |
|-------|--------|----------|:--------------:|
| `backend-architecture` | `skills/backend-architecture/` | DDD, module boundaries, contracts | Yes (10 docs) |
| `frontend-architecture` | `skills/frontend-architecture/` | Feature modules, design system, UX | Yes (10 docs) |

## Skill Dependency Graph

```
┌─────────────────────────────────────────────────┐
│                  Forge Agent                     │
│              (agents/Forge.agent.md)             │
│                                                  │
│  Loads on start:                                 │
│    └── forge (coordinator skill)                 │
│                                                  │
│  Loads on demand (via skill() in L0):            │
│    ├── experts-council (3-model council)         │
│    ├── backlog (work item tracking)              │
│    ├── agents-hub (worker coordination)          │
│    └── copilot-cli-skill (worker spawning)       │
│                                                  │
│  Injects into subagent Mission Briefs:           │
│    ├── forge-{mode} (loaded by L1 subagents)     │
│    ├── backend-architecture (if backend task)    │
│    └── frontend-architecture (if frontend task)  │
└─────────────────────────────────────────────────┘
```

### Soft Dependencies

Skills reference each other but don't hard-require them. The system degrades
gracefully if a skill is missing:

```
forge (coordinator)
  ├── USES experts-council     — for council verdicts (optional: can skip)
  ├── USES backlog             — for work tracking (optional: can work without)
  ├── USES agents-hub          — for worker comms (optional: single-agent mode)
  ├── USES copilot-cli-skill   — for parallel workers (optional: sequential mode)
  └── INJECTS forge-{mode}     — into subagent prompts (required for structured behavior)

forge-execute (subagent skill)
  ├── REFERENCES backend-architecture  — if backend task (optional: works without)
  └── REFERENCES frontend-architecture — if frontend task (optional: works without)

forge-product (subagent skill)
  ├── REFERENCES jobs-to-be-done       — for DISCOVER phase (external, not bundled)
  ├── REFERENCES made-to-stick         — for DESIGN phase (external, not bundled)
  └── REFERENCES copywriting           — for customer copy (external, not bundled)

experts-council
  └── USES task() tool                 — spawns 3+1 parallel model calls
      (must run in L0 context)

copilot-cli-skill
  └── USES bash tool                   — spawns copilot processes
  └── USES agents-hub                  — worker registration (soft dep)
```

### Graceful Degradation

| Missing Skill | Impact | Fallback |
|--------------|--------|----------|
| `experts-council` | No multi-model review | Coordinator answers directly |
| `backlog` | No work tracking | Manual tracking, no bookkeeping |
| `agents-hub` | No worker communication | Workers run blind, no hub posts |
| `copilot-cli-skill` | No parallel workers | Sequential task() dispatch only |
| `backend-architecture` | No architecture guidance | Subagent uses own judgment |
| `frontend-architecture` | No frontend patterns | Subagent uses own judgment |
| `forge-{mode}` | Subagent lacks structured behavior | Raw task completion (works but less disciplined) |

## SDK Migration Plan

### Current State: CLI Spawn

```
copilot-cli-skill
  └── child_process.spawn('copilot', [...args], { detached: true })
      └── One OS process per worker (~15-30s spawn overhead)
      └── PID files + output.log + exit.json for lifecycle
      └── Polling-based monitoring
```

### Target State: SDK Sessions

```
copilot-cli-skill (v2)
  └── CopilotClient (single shared instance)
      ├── Session A (worktree/1) — instant create via JSON-RPC
      ├── Session B (worktree/2) — event-driven monitoring
      └── Session C (worktree/3) — custom tools for hub comms
```

### Key SDK Capabilities for Forge

| Capability | Current | With SDK | Impact |
|-----------|---------|----------|--------|
| Worker spawn time | 15-30s per worker | ~100ms after first | 🟢 100x faster |
| Progress monitoring | output.log tail (buffered) | Real-time events (40+ types) | 🟢 Instant visibility |
| Worker→coordinator comms | agents-hub skill in worker | Custom tools (handler in coordinator) | 🟢 Structured, atomic |
| Scope enforcement | Prompt-based "stay in dir" | onPermissionRequest (deny writes) | 🟢 Deterministic |
| Quality gates | forge-execute skill prompt | onPreToolUse hooks (block commits) | 🟢 Programmatic |
| Session resume | Not supported | client.resumeSession() | 🟢 Crash recovery |
| Process count | 2× per worker (wrapper+copilot) | 1 shared server + N sessions | 🟢 ~50-70% less memory |

### Migration Phases

| Phase | What | Effort | Dependencies |
|-------|------|:------:|:-------------|
| **0. Plugin packaging** | Create plugin.json, restructure for copilot plugin install | S | None |
| **1. WorkerAdapter interface** | Abstract spawn/monitor/cleanup behind facade | S | Phase 0 |
| **2. SDK adapter** | CopilotClient + createSession per worktree | L | Phase 1, SDK install |
| **3. Custom tools** | hub_post, report_progress, request_help via defineTool | S | Phase 2 |
| **4. Event monitoring** | session.on() → hub posts for real-time progress | M | Phase 2 |
| **5. Permission hooks** | onPermissionRequest for scope enforcement + audit | S | Phase 2 |
| **6. Quality hooks** | onPreToolUse for test-before-commit, edit counter | M | Phase 2 |
| **7. Deprecate CLI adapter** | Remove child_process spawn path | S | Phase 2-6 validated |

### Custom Worker Tools (Phase 3)

```typescript
import { defineTool } from "@github/copilot-sdk";

// Injected into every worker session
const forgeWorkerTools = [
  defineTool('report_progress', {
    description: 'Report structured progress to the Forge coordinator',
    parameters: z.object({
      percent: z.number().min(0).max(100),
      message: z.string(),
      filesChanged: z.array(z.string()).optional(),
    }),
    handler: async ({ percent, message, filesChanged }) => {
      await hub.post(workerId, { type: 'progress', percent, message, filesChanged });
      return `Progress: ${percent}% — ${message}`;
    },
  }),

  defineTool('request_help', {
    description: 'Escalate a blocker to the coordinator',
    parameters: z.object({
      blocker: z.string(),
      options: z.array(z.string()).optional(),
    }),
    handler: async ({ blocker, options }) => {
      await hub.post(workerId, { type: 'help', blocker, options });
      return 'Help requested. Continue other work while waiting.';
    },
  }),

  defineTool('post_finding', {
    description: 'Share a finding with the coordinator and other workers',
    parameters: z.object({
      finding: z.string(),
      severity: z.enum(['info', 'warning', 'critical']),
      file: z.string().optional(),
    }),
    handler: async ({ finding, severity, file }) => {
      await hub.post(workerId, { type: 'finding', finding, severity, file });
      return 'Finding posted to hub.';
    },
  }),
];
```

### Permission Hooks (Phase 5)

```typescript
const forgePermissionHandler = async (request, { sessionId }) => {
  const worker = workerRegistry.get(sessionId);

  // Enforce directory scope
  if (request.kind === 'write' && request.path) {
    const rel = path.relative(worker.scopeDir, request.path);
    if (rel.startsWith('..')) {
      audit.log(sessionId, 'denied_write_out_of_scope', request.path);
      return { kind: 'denied', reason: `Out of scope: ${worker.scopeDir}` };
    }
  }

  // Block git push (workers submit via branches)
  if (request.kind === 'shell' && request.command?.includes('git push')) {
    return { kind: 'denied', reason: 'Workers cannot push. Submit via branch.' };
  }

  // Log everything for audit
  audit.log(sessionId, 'approved', request);
  return { kind: 'approved' };
};
```

## Build & Install

The canonical method is `build-plugin.sh`, which assembles the plugin into `dist/` and optionally installs it:

```bash
# Build only
./build-plugin.sh

# Build + install locally
./build-plugin.sh --install

# Preview without writing
./build-plugin.sh --dry-run
```

## Loading Order & Precedence

Per the CLI plugin reference:
- **Agents**: first-found-wins (deduped by filename-derived ID)
- **Skills**: first-found-wins (deduped by `name` field in SKILL.md)
- **MCP servers**: last-wins

This means:
1. Project-level agents/skills override plugin agents/skills
2. User `~/.copilot/` agents/skills override plugin agents/skills
3. Plugin components are the fallback

For Forge, this is ideal — users can customize by placing overrides in their
project's `.github/agents/` or `.github/skills/` directories.

## Hooks System — Structural Enforcement

Hooks are the **game-changer** for dispatch discipline. Unlike prompt-based rules
(which the LLM can ignore), hooks are shell scripts that run BEFORE/AFTER every
tool call. A `preToolUse` hook can **deny tool execution** by returning
`{"permissionDecision": "deny"}`. This is structural, deterministic enforcement.

### hooks.json Specification

```json
{
  "version": 1,
  "hooks": {
    "sessionStart": [...],
    "sessionEnd": [...],
    "userPromptSubmitted": [...],
    "preToolUse": [...],
    "postToolUse": [...],
    "errorOccurred": [...]
  }
}
```

Each hook is an array of command configs:
```json
{
  "type": "command",
  "bash": "./scripts/hook-handler.sh",
  "cwd": ".",
  "timeoutSec": 10
}
```

Hook scripts receive a JSON payload via stdin with full context (tool name,
arguments, session info). preToolUse scripts must return JSON on stdout with
`permissionDecision: "allow"` or `"deny"`.

### Forge Hooks Design

#### Hook 1: Dispatch Discipline (preToolUse)

**The fix for inline execution.** When the Forge agent is active, deny
`edit`, `create`, and mutating `bash` calls from the coordinator context.

```bash
#!/usr/bin/env bash
# hooks/pre-tool-use.sh
# Reads JSON from stdin, decides allow/deny

INPUT=$(cat)
TOOL_NAME=$(echo "$INPUT" | jq -r '.toolName // .tool_name // ""')
AGENT=$(echo "$INPUT" | jq -r '.agent // .agentId // ""')
COMMAND=$(echo "$INPUT" | jq -r '.arguments.command // ""')

# Allow everything for subagents (they should edit files)
if [ "$AGENT" != "Forge" ] && [ "$AGENT" != "forge" ]; then
  echo '{"permissionDecision": "allow"}'
  exit 0
fi

# Forge coordinator: deny file mutations
case "$TOOL_NAME" in
  edit|create|apply_patch)
    echo "{\"permissionDecision\": \"deny\", \"permissionDecisionReason\": \"Forge coordinator cannot edit files. Dispatch a subagent via task() instead.\"}"
    exit 0
    ;;
  bash|execute)
    # Check for mutating bash commands
    if echo "$COMMAND" | grep -qE '^(npm (run build|test|install)|dotnet (build|test|run)|pytest|cargo (build|test)|make |sed -i|echo >|cat >)'; then
      echo "{\"permissionDecision\": \"deny\", \"permissionDecisionReason\": \"Forge coordinator cannot run builds/tests. Dispatch a subagent via task() instead.\"}"
      exit 0
    fi
    ;;
esac

echo '{"permissionDecision": "allow"}'
```

**Impact:** This would bring dispatch purity from 47% to ~95%+ because the
LLM literally cannot call edit/create — the hook blocks it before execution.

#### Hook 2: Session Telemetry (postToolUse)

Log every tool call for eval grading and debugging:

```bash
#!/usr/bin/env bash
# hooks/post-tool-use.sh
INPUT=$(cat)
TOOL=$(echo "$INPUT" | jq -r '.toolName // ""')
SESSION=$(echo "$INPUT" | jq -r '.sessionId // ""')
TIMESTAMP=$(date -u +%Y-%m-%dT%H:%M:%SZ)

# Append to telemetry log
echo "{\"ts\":\"$TIMESTAMP\",\"session\":\"$SESSION\",\"tool\":\"$TOOL\"}" \
  >> ~/.copilot/forge-telemetry.jsonl
```

**Impact:** Structured tool usage data for eval grading without parsing events.jsonl.

#### Hook 3: Session Bootstrap (sessionStart)

Ensure forge skill is loaded at the start of every Forge session:

```bash
#!/usr/bin/env bash
# hooks/session-start.sh
INPUT=$(cat)
AGENT=$(echo "$INPUT" | jq -r '.agent // ""')

if [ "$AGENT" = "Forge" ] || [ "$AGENT" = "forge" ]; then
  echo "{\"additionalContext\": \"REMINDER: Load the forge coordinator skill as your first action. Call skill('forge') before classifying any user message.\"}"
else
  echo "{}"
fi
```

**Impact:** Adds a structural reminder at session start, reinforcing skill loading.

#### Hook 4: Quality Gate (preToolUse — git commit)

Block commits that don't follow hygiene rules:

```bash
#!/usr/bin/env bash
# hooks/pre-commit-gate.sh
INPUT=$(cat)
TOOL=$(echo "$INPUT" | jq -r '.toolName // ""')
CMD=$(echo "$INPUT" | jq -r '.arguments.command // ""')

# Only check bash/execute with git commit
if [ "$TOOL" != "bash" ] && [ "$TOOL" != "execute" ]; then
  echo '{"permissionDecision": "allow"}'
  exit 0
fi

if echo "$CMD" | grep -q "git commit"; then
  # Check for git add . (banned)
  if echo "$CMD" | grep -q "git add \."; then
    echo '{"permissionDecision": "deny", "permissionDecisionReason": "Never use git add . — stage specific files only."}'
    exit 0
  fi
fi

echo '{"permissionDecision": "allow"}'
```

#### Hook 5: Scope Tracking (postToolUse — edit/create)

Track which files are being modified for scope creep detection:

```bash
#!/usr/bin/env bash
# hooks/scope-tracker.sh
INPUT=$(cat)
TOOL=$(echo "$INPUT" | jq -r '.toolName // ""')
FILE=$(echo "$INPUT" | jq -r '.arguments.path // ""')
SESSION=$(echo "$INPUT" | jq -r '.sessionId // ""')

if [ "$TOOL" = "edit" ] || [ "$TOOL" = "create" ]; then
  echo "$FILE" >> "/tmp/forge-scope-${SESSION}.txt"
  COUNT=$(sort -u "/tmp/forge-scope-${SESSION}.txt" | wc -l | tr -d ' ')
  if [ "$COUNT" -gt 8 ]; then
    echo "{\"additionalContext\": \"⚠️ Scope alert: ${COUNT} files modified. Review if this is within scope.\"}"
    exit 0
  fi
fi

echo "{}"
```

### hooks.json for Forge Plugin

```json
{
  "version": 1,
  "hooks": {
    "sessionStart": [
      {
        "type": "command",
        "bash": "./hooks/session-start.sh",
        "timeoutSec": 5
      }
    ],
    "preToolUse": [
      {
        "type": "command",
        "bash": "./hooks/pre-tool-use.sh",
        "timeoutSec": 5
      },
      {
        "type": "command",
        "bash": "./hooks/pre-commit-gate.sh",
        "timeoutSec": 5
      }
    ],
    "postToolUse": [
      {
        "type": "command",
        "bash": "./hooks/post-tool-use.sh",
        "timeoutSec": 5
      },
      {
        "type": "command",
        "bash": "./hooks/scope-tracker.sh",
        "timeoutSec": 5
      }
    ]
  }
}
```

### Hook Capabilities Summary

| Hook | Trigger | Can Deny? | Use Case |
|------|---------|:---------:|----------|
| `sessionStart` | Session begins | No | Inject context, bootstrap reminders |
| `userPromptSubmitted` | User sends message | No | Modify/augment prompt |
| `preToolUse` | Before tool execution | **Yes** | Block edit/create from coordinator, block git push, enforce scope |
| `postToolUse` | After tool execution | No | Telemetry logging, auto-format, scope tracking |
| `sessionEnd` | Session ends | No | Cleanup, final audit, memory extraction trigger |
| `errorOccurred` | Error happens | No | Error logging, retry decisions |

### Why Hooks Solve the Dispatch Problem

The current enforcement stack:
1. **Prompt-based** (agent.md): "You are a dispatcher" → LLM ignores under pressure (5-47% purity)
2. **Skill-based** (SKILL.md): Pressure table, examples → helps but not deterministic
3. **Eval-based** (evals): Measures but doesn't prevent

With hooks:
4. **Structural** (hooks.json preToolUse): **Deny edit/create from coordinator** → physically impossible to inline edit → 95%+ purity

This is the same pattern as v17's architectural separation (Orchestrator couldn't edit because
it dispatched to Executor) but implemented via hooks instead of separate agents.

### Open Questions

1. **Agent identification in hooks**: Does the hook receive which agent is active?
   If not, we need another way to distinguish coordinator vs subagent tool calls.
   Subagents SHOULD be allowed to edit — only the coordinator should be blocked.

2. **Hook context in task() subagents**: Do plugin hooks fire for tool calls made
   by task() subagents? If yes, we need the dispatch-discipline hook to only
   block the coordinator. If no, subagents are automatically unrestricted.

3. **Hook performance**: Each preToolUse hook runs a shell script. With 2 hooks
   × hundreds of tool calls per session = overhead. We need hooks to be fast (<50ms).

These need empirical testing to validate.
