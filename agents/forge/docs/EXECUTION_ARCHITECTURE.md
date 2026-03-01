# Forge Execution Architecture

## Single-Level task() Constraint

The Copilot CLI `task` tool spawns a subagent in a **fresh context window**. This subagent:
- Has access to all tools (edit, create, bash, view, grep, etc.)
- Can load skills via `skill()` tool
- **CANNOT call `task()` itself** — nesting is not supported

This means the Forge system has exactly **two execution levels**:

```
Level 0: Main Context (Forge Coordinator)
  │
  ├── task()  → Level 1: Subagent (fresh context, NO task())
  │
  └── copilot-cli-skill → Worker (full copilot process, CAN task())
```

## Level 0: Forge Coordinator (Main Context)

The coordinator runs in the user's interactive session. It persists across all turns.

**Capabilities:**
- All tools available (task, skill, edit, create, bash, view, grep, glob, sql, etc.)
- Can call `task()` to spawn Level 1 subagents
- Can load skills (forge, backlog, experts-council, etc.)
- Can invoke copilot-cli-skill to spawn workers
- Sees all subagent return values (REPORT format)

**Responsibilities (what ONLY L0 can do):**
- Multi-phase workflow orchestration (explore→plan→execute→verify)
- Experts-council invocation (needs 4× parallel task() calls)
- Product-to-implementation bridging
- Worker fleet management
- Session continuity across 50+ turns

**Why context cleanliness matters:**
The coordinator is the ONLY entity that persists across the entire session.
If it pollutes its context with inline code edits, it degrades its ability
to do multi-turn orchestration. Every inline edit adds tokens that crowd
out coordination state.

## Level 1: Subagents (task() context windows)

Spawned by the coordinator via `task()`. Each gets a fresh context window.

**Capabilities:**
- All tools EXCEPT `task()` — cannot spawn sub-subagents
- Can load skills (forge-execute, backend-architecture, etc.)
- Can read/write files, run builds/tests
- Can use web_search, web_fetch

**Cannot do:**
- Call `task()` (spawn their own subagents)
- Invoke experts-council (needs 4× task() calls)
- Spawn workers via copilot-cli-skill
- Delegate parts of their work to specialists

**Types:**
| Agent Type | Tools | Speed | Use When |
|-----------|-------|-------|----------|
| `general-purpose` | All (except task) | Normal | Most work — loads forge-{mode} skill |
| `explore` | grep/glob/view ONLY | Fast (Haiku) | Simple file/symbol lookups |

## Level 1B: Workers (copilot-cli-skill)

Spawned via copilot-cli-skill as **separate copilot processes**.

**Capabilities:**
- Full copilot instance (own process, own session)
- CAN call `task()` — they are Level 0 equivalent
- CAN load skills, invoke experts, spawn their own subagents
- Run in git worktrees (parallel branches)

**Limitations:**
- Communication only via agents-hub (async, not return values)
- No direct data sharing with coordinator
- Conflict resolution needed for overlapping files
- More expensive (separate LLM session per worker)

**When to use:**
- 3+ independent items that don't overlap on files
- Long-running tasks where coordinator shouldn't wait
- Work that benefits from full explore→plan→execute→verify cycle

## Flow Charts

### Flow 1: Simple Fix (T1-T2)

```
User: "fix the typo"
  │
  L0 Forge ──task()──→ L1 forge-execute
  │                     │ loads skill
  │                     │ reads file
  │                     │ edits file
  │                     │ runs test
  │◄── REPORT ─────────┘
  │
  L0: "Done. Fixed typo. Tests pass."
```

Single task() dispatch. No nesting needed.

### Flow 2: Implementation Cycle (T3+)

```
Turn 1: "investigate the auth module"
  L0 ──task()──→ L1 forge-explore
  L0 ◄── REPORT (findings, tier)

Turn 2: "create a plan"
  L0 ──task()──→ L1 forge-plan
  L0 ◄── REPORT (ordered steps)

Turn 3: "proceed"
  L0 ──task()──→ L1 forge-execute
  L0 ◄── REPORT (files changed)

Turn 4: "verify"
  L0 ──task()──→ L1 forge-verify
  L0 ◄── REPORT (approved/revision)
```

Sequential task() calls driven by coordinator across turns.
⚠️ L1 explore cannot sub-delegate searches.
⚠️ L1 verify cannot invoke expert council.

### Flow 3: Expert Council Review

```
User: "ask the experts"
  │
  L0 loads experts-council skill (IN L0 CONTEXT)
  │
  ├──task(gemini)──→ L1 council member A ─┐
  ├──task(opus)────→ L1 council member B  ├─ parallel
  └──task(gpt)─────→ L1 council member C ─┘
  │◄── 3 responses
  │
  └──task(chairman)→ L1 synthesizer
  │◄── verdict
  │
  L0: presents verdict to user
```

Skill runs in L0, spawns 4 task() calls.
⚠️ Council members CANNOT call task() (no sub-delegation).

### Flow 4: Epic Parallelism (Workers)

```
User: "work on epic B-055, parallelize"
  │
  L0 loads copilot-cli-skill
  │
  ├──copilot-spawn──→ Worker A (own process)
  │                    │ CAN call task() ✅
  │                    │ CAN load skills ✅
  │                    │ Full explore→plan→exec→verify ✅
  │                    │ Posts to hub
  │
  ├──copilot-spawn──→ Worker B (own process)
  │                    │ Full capabilities ✅
  │
  └──copilot-spawn──→ Worker C (own process)
                       │ Full capabilities ✅

  L0 monitors via hub.workerSyncAll()
  L0 merges branches after completion
```

Workers are full copilot instances with nested task() capability.

### Flow 5: Product → Build Bridge

```
Turn 1: "research customers using JTBD"
  L0 ──task()──→ L1 forge-product + jobs-to-be-done
  │               ❌ CANNOT invoke experts (needs task())
  │               ✅ CAN use web_search, product-hub CLI
  L0 ◄── REPORT

Turn 2: "define feature spec"
  L0 ──task()──→ L1 forge-product + made-to-stick
  L0 ◄── REPORT

Turn 3: "create epic and plan"
  L0 ──task()──→ L1 forge-plan
  L0 ◄── REPORT
```

⚠️ If discovery needs expert council, coordinator must do it from L0
BEFORE dispatching the product subagent.

### Flow 6: Verify → Expert Delta Review

```
Turn 1: "verify the changes"
  L0 ──task()──→ L1 forge-verify
  │               ❌ CANNOT invoke experts
  L0 ◄── REPORT (revision_required)

Turn 2: "review again with experts"
  L0 loads experts-council (IN L0 CONTEXT)
  L0 ──task()×4──→ council + chairman
  L0 ◄── delta verdict
```

Delta review is a coordinator-level action, NOT a verify subagent capability.

## Design Implications

### 1. Coordinator is the orchestration bottleneck

Only the coordinator can:
- Chain multi-phase workflows
- Invoke experts-council
- Bridge product → implementation
- Manage worker fleets
- Maintain session continuity

This makes context cleanliness critical — inline edits pollute the context
that needs to stay clean for 50+ turn orchestration.

### 2. Complex workflows require coordinator-driven sequencing

A "full implementation cycle" (explore→plan→execute→verify) cannot be
delegated as a single task() call. The coordinator must drive each phase
as a separate dispatch, carrying context between them.

### 3. Workers are the only path to nested delegation

When a task needs sub-delegation (e.g., a worker that explores then executes),
it must be spawned as a copilot-cli-skill worker, not a task() subagent.
Workers are more expensive but have full capabilities.

### 4. Skills that need task() must run in L0

Skills like experts-council that internally call task() can ONLY run in
the coordinator context. They cannot be loaded by L1 subagents.

| Skill | Needs task()? | Where it runs |
|-------|:---:|:---:|
| forge (coordinator) | Yes | L0 only |
| experts-council | Yes (4× task) | L0 only |
| forge-explore | No | L1 |
| forge-ideate | No | L1 |
| forge-plan | No | L1 |
| forge-execute | No | L1 |
| forge-verify | No | L1 |
| forge-product | No | L1 |
| forge-memory | No | L1 |
| backlog | No* | L0 (uses bash) |
| agents-hub | No* | L0 (uses bash) |
| backend-architecture | No | L0 or L1 |
| frontend-architecture | No | L0 or L1 |

*backlog and agents-hub use bash for CLI operations, not task().
