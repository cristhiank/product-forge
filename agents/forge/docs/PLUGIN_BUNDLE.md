# Forge Plugin Bundle — Design & SDK Migration

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

## Publish Script Update

The current `publish.sh` copies files to `~/.copilot/agents/` and `~/.copilot/skills/`.
With the plugin system, we need BOTH:

1. **Plugin packaging** — for distribution via `copilot plugin install`
2. **Direct install** — for local development (keeps current publish.sh behavior)

```bash
# Development: direct install (current behavior)
./publish.sh

# Distribution: package as plugin
./package-plugin.sh  # creates dist/ with plugin.json + agents/ + skills/

# User installation
copilot plugin install cristhiank/mcps
# or
copilot plugin install ./dist/
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
