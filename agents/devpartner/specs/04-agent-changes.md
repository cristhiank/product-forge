# DevPartner v17 — Agent Changes

## Overview

v17 adds one new agent (Super-Orchestrator) and makes minor updates to existing agents. The core agent architecture from v16 is preserved. This document specifies what changes per agent.

---

## New: Super-Orchestrator

See [01-super-orchestrator.md](01-super-orchestrator.md) for the full spec.

**Summary**: Top-level coordinator that spawns and manages parallel Orchestrator instances. Uses `copilot` CLI to spawn workers, `git worktree` for isolation, and `agents-hub` for communication.

---

## Modified: Orchestrator

### What Changes

1. **Hub references**: Replace all `board.*` with `hub` CLI commands
2. **Channel awareness**: Post to assigned channel (default `#main`, or `#worker-{id}` in parallel mode)
3. **Worktree awareness**: Detect if running in a worktree, scope operations accordingly
4. **Blocked protocol**: When blocked on something outside worker scope, post `request` to hub and wait

### New Section: Parallel Mode Awareness

```markdown
## Parallel Mode Detection

On startup, check:
1. Is there a worker_id in your prompt? → You're in parallel mode
2. git rev-parse --git-common-dir → If != .git, you're in a worktree

In parallel mode:
- Your channel is #worker-{id} (specified in prompt)
- Post progress to your channel
- Post completion/blockers to #general
- Search all channels before Scout explores (may find relevant info from other workers)
- Do NOT modify main branch
- Do NOT switch branches
```

### Updated: Skill Invocation

```markdown
# v16
Invoke the `devpartner` skill as your first action.
Invoke the `agents-board` skill for board operations.

# v17
Invoke the `devpartner` skill as your first action.
Invoke the `agents-hub` skill for all communication.
```

### Unchanged
- Direct Mode (T1-T2)
- Delegate Mode phases
- Multi-model audit
- Backlog integration
- Checkpointing

---

## Modified: Scout

### What Changes

1. **Hub references**: Replace `board.addFact/addSnippet` with `hub post --type note`
2. **Search-first**: Check hub before reading files (`hub search` instead of `board.getSnippets`)
3. **Cross-worker search**: In parallel mode, search all channels for prior exploration

### New Capability: Cross-Worker Discovery

```markdown
Before exploring a file or module:
1. hub search "<path-or-topic>" --limit 5
2. If results found from other workers → use that context
3. If not found → read file → hub post --type note --tags '["snippet"]'
```

### Unchanged
- Exploration modes (quick_scan, focused_query, deep_dive, external_search)
- Classification output
- External search discipline
- Tool call budgets

---

## Modified: Creative

### What Changes

1. **Hub references**: Replace `board.proposeDecision` with `hub post --type decision`
2. **Channel**: Posts decisions to worker's channel

### Unchanged
- Approach generation (3 options, contrarian)
- External search for web/docs
- No code, no file reads
- Decision format

---

## Modified: Planner

### What Changes

1. **Hub references**: Replace `board.setPlan` with `hub post --type note --tags '["plan"]'`
2. **Channel**: Posts plan to worker's channel

### Unchanged
- Micro-plan (T3) vs full-plan (T4-T5)
- Atomic step requirements (DONE WHEN criteria)
- File-level granularity

---

## Modified: Executor

### What Changes

1. **Hub references**: Replace `board.advanceStep/completeStep` with `hub post --type status`
2. **Blocked protocol**: When blocked, post `request` to worker channel and wait
3. **Channel**: Posts progress to worker's channel

### New: Blocked Worker Pattern

```markdown
When blocked on something outside your scope:
1. hub post --channel '#worker-{id}' --type request --author executor \
   --content "Blocked: [describe issue]" \
   --metadata '{"severity":"blocker","target":"orchestrator","request_type":"help"}'
2. hub watch --channel '#worker-{id}' --timeout 120
3. Read resolution from thread → continue
```

### Unchanged
- Backlog bookkeeping
- Pre-commit checklist
- Commit hygiene
- Trail logging
- git status before commit

---

## Modified: Verifier

### What Changes

1. **Hub references**: Replace board operations with hub commands
2. **Channel**: Posts verification results to worker's channel
3. **Audit mode**: Posts audit results as `hub reply` in audit thread

### Unchanged
- Tier-based modes (spot_check, standard, thorough)
- Multi-model audit mode
- Evidence requirements
- Verdict format

---

## Modified: Memory-Miner

### What Changes

1. **Hub references**: Read trails from hub (`hub read --tags trail`)
2. **Channel**: In parallel mode, reads from worker's channel

### Unchanged
- Manual-only invocation
- Extraction patterns
- Memory types (episodic, semantic, procedural)

---

## Agent File Changes Summary

| Agent | Changes | Effort |
|-------|---------|--------|
| **Super-Orchestrator** | NEW (~600-800 lines) | High |
| **Orchestrator** | Hub refs + parallel mode section (~50 lines changed) | Medium |
| **Scout** | Hub refs + cross-worker search (~30 lines changed) | Low |
| **Creative** | Hub refs only (~10 lines changed) | Trivial |
| **Planner** | Hub refs only (~10 lines changed) | Trivial |
| **Executor** | Hub refs + blocked protocol (~40 lines changed) | Low-Medium |
| **Verifier** | Hub refs only (~15 lines changed) | Trivial |
| **Memory-Miner** | Hub refs only (~10 lines changed) | Trivial |
| **Constitution** | Hub refs + new sections (~100 lines changed) | Medium |

---

## Build Tool Changes

### build-agents.py

```python
# Add to AGENT_FILES
"super_orchestrator": "super_orchestrator.agent.md",

# Add to COPILOT_OUTPUT_NAMES
"super_orchestrator": "super-orchestrator",

# Add to COPILOT_META
"super_orchestrator": {
    "name": "Super-Orchestrator",
    "description": "Coordinates parallel Orchestrator sessions..."
}
```

### publish.sh

```bash
# Add to AGENTS array
AGENTS=(super_orchestrator orchestrator scout creative planner executor verifier memory_miner)

# Default version = v17
VERSION="${VERSION:-v17}"
```

### validate-agents.py

```python
# Add super_orchestrator to all validation arrays
AGENT_FILES["super_orchestrator"] = "super_orchestrator.agent.md"
COPILOT_EXPECTED["super_orchestrator"] = "super-orchestrator.agent.md"
```
