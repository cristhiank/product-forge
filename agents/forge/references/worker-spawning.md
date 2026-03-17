# Worker Spawning Protocol

Workers are full Copilot instances in isolated git worktrees. Unlike `task()` subagents, workers CAN call `task()`, load skills, and run the complete Forge protocol independently.

## When to Spawn Workers (vs. Single Subagent)

| Condition | Use Workers | Use Single Subagent |
|-----------|:-:|:-:|
| 3+ items in different files | ✅ | |
| Items need their own explore phase | ✅ | |
| User says "parallelize" | ✅ | |
| Items are complex (T3+ each) | ✅ | |
| 1-2 items, or all items in same file | | ✅ |
| Items are trivial (< 20 lines each, same module) | | ✅ |

## When NOT to Use Workers

Workers have ~15-30s spawn overhead per instance. Do NOT use workers when:
 - **Single item** — task() is faster, no nesting needed
 - **Items share files** — git merge conflicts defeat the purpose of isolation
 - **Items are trivial** — < 20 lines each, same module → single task() handles them sequentially in seconds
 - **Quick exploration** — use explore agent, not a worker

## Spawn Ceremony

**Step 1: Load the skill**
```
skill("copilot-cli-skill")
```

**Step 2: Spawn workers** (one per independent group — default to opus)
```bash
WORKER="node <skill-dir>/scripts/index.js --repo-root ."

# Worker 1
$WORKER exec --agent Forge --model claude-opus-4.6 --autopilot 'return sdk.spawnWorker(`
Invoke the \`forge-execute\` skill as your first action.
Also invoke the \`backend-architecture\` skill.

## Desired Outcome (Why)
[What success looks like from the user's perspective]

## Mission (How)
[Clear objective for this group]

## Context
[Relevant findings, code refs, constraints]

## Constraints
- Scope: [files this worker touches]

## Expected Output
Return a REPORT with: STATUS, SUMMARY, ARTIFACTS, NEXT
`)'

# Worker 2 — same pattern, different mission
$WORKER exec --agent Forge --autopilot 'return sdk.spawnWorker(`[Mission Brief 2]`)'
```

**Step 3: Monitor and merge**
```bash
$WORKER exec 'return sdk.listAll()'                    # Status of all
$WORKER exec 'return sdk.checkWorker("<worker-id>")'   # Specific worker
$WORKER exec 'return sdk.cleanupAll()'                  # After all complete
```

After all workers complete → review → merge branches → update backlog.

## Parallelization Checkpoint (Mandatory for Epics)

Before dispatching any epic or multi-item request:

1. **List items with target files** — for each backlog item, identify which files it touches
2. **Group by file overlap** — items touching the same files go in the same group
3. **Evaluate independence:**

```
Independent groups = 1 → Single execute subagent (sequential)
Independent groups = 2+ → Parallel workers via copilot-cli-skill
```

4. **Present the plan to the user:**
   - "Epic has N items in M independent groups. Spawning M workers."
   - OR "All N items touch overlapping files. Executing sequentially in one subagent."

Do not default to single subagent when parallelism is available.

## Workers vs task() Synchronization

Workers and `task()` subagents have different synchronization models:

| Mechanism | Synchronization | Coordinator behavior |
|-----------|----------------|---------------------|
| `task(mode: "sync")` | Synchronous — output returns inline | Evaluate immediately, chain next dispatch or stop |
| `copilot-cli-skill` workers | Asynchronous — spawn, monitor, merge | Use `sdk.listAll()` / `sdk.checkWorker()` to poll status |

`task()` dispatches always use `mode: "sync"` so the coordinator can evaluate output before responding. Workers are inherently async because they run in isolated worktrees and may take minutes — the spawn→monitor→merge ceremony handles their lifecycle.
