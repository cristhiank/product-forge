---
name: backlog
description: >-
  ALWAYS use when the user mentions "backlog" or asks about work items, tasks,
  priorities, or bookkeeping — including "what's next", "what should I work on",
  "show tasks", "backlog status", "do bookkeeping", "work on [project]",
  "continue where you left", "implement [item]", or any question about upcoming,
  in-progress, or completed work. Also use when starting any task that involves
  picking, creating, moving, completing, or reviewing work items; planning
  sprints; checking backlog health; or tracking dependencies. NEVER browse
  .backlog/ directories directly — always use this skill's CLI.
---

# Backlog Skill

Patterns and conventions for using the backlog CLI to manage work items, track progress, and maintain project health.

## First Actions

When this skill loads, do these immediately:

1. **Fence stale state** — `$BACKLOG hygiene --fix` — auto-repair status/folder mismatches from prior sessions
2. **Get a briefing** — `$BACKLOG brief --format summary` — see health, WIP, what's next
3. **Check working items** — `$BACKLOG list --folder working` — see what's in progress
4. **Find unblocked work** — `$BACKLOG list --folder next --unblocked` — see what's ready to pick up

> ⚠️ **Always run hygiene --fix first.** Items completed in other sessions may still be in `next/` if the completing agent forgot to call `complete()`. The hygiene fence detects status/folder mismatches and auto-repairs them.

## ⛔ CRITICAL: Never Browse .backlog/ Directly

**DO NOT** use `ls`, `cat`, `view`, `find`, or any file browsing on `.backlog/` directories. The markdown files have structured metadata that requires the CLI parser. Direct file browsing:
- Misses metadata parsing (priority, status, dependencies, tags)
- Skips cross-project discovery
- Returns raw markdown instead of structured JSON
- Breaks the kanban workflow model

**ALWAYS use the CLI** (`node <skill-dir>/scripts/index.js <command>`) for ALL backlog operations.

## When to Use

Use this skill whenever the user asks about their backlog, tasks, or work items — including casual queries like "what's next?", "what am I working on?", "show my tasks", "backlog status", "do bookkeeping", or "what should I work on?". Specifically:

- Answer questions about upcoming, in-progress, or completed work
- Create, list, search, or manage work items
- "Bookkeeping" — update item status, move items between folders after implementation
- "Work on [project/task]" — find and select the right backlog item
- "Continue where you left" — check working/ items and resume
- Plan sprints or review backlog health  
- Cross-reference items across projects
- Run hygiene checks to prevent backlog rot
- Track dependencies between work items
- Maintain kanban-style workflow (next → working → done → archive)

## Quick Start

The CLI auto-discovers `.backlog/` directories from the current working directory or git root. It supports **CLI commands** for simple operations and **exec** for JavaScript composition. All output is JSON.

```bash
BACKLOG="node <skill-dir>/scripts/index.js"

# Get a one-call briefing: health, WIP, next items, stats
$BACKLOG brief

# Same, human-readable
$BACKLOG brief --format summary

# List items ready to pick up
$BACKLOG list --folder next

# List only unblocked next items (all deps resolved)
$BACKLOG list --folder next --unblocked

# Pick an item to work on (moves to working + returns full details)
$BACKLOG pick B-042

# Create a new task
$BACKLOG create --kind task --title "Fix login bug" --priority high

# Complete multiple items at once
$BACKLOG complete B-001,B-002,B-003

# Check backlog health
$BACKLOG hygiene --stale-days 30

# Code execution (multi-step queries)
$BACKLOG exec --code '
  const items = await backlog.list({ folder: "working" });
  const health = await backlog.hygiene();
  return { wip: items.length, score: health.health_score };
'

# See all commands
$BACKLOG help

# Start HTML dashboard (read-only, live-reloading)
$BACKLOG serve --port 3000
```

### Project Discovery

The CLI discovers projects using a multi-step strategy:

1. **Scan down from cwd** — looks for `<child>/.backlog/` up to 2 levels deep
2. **Check cwd itself** — if cwd has a `.backlog/` directory
3. **Walk up to git root** — if nothing found yet, finds the nearest `.git` ancestor and scans from there
4. **Config file** — checks for `.backlog-projects.json` at the git root for explicit project definitions

```
workspace/                      ← git root
├── frontend/
│   └── .backlog/               → project: "frontend"
├── api/
│   └── .backlog/               → project: "api"
└── services/
    └── payments/
        └── .backlog/           → project: "services-payments" (nested, auto-named)
```

**Running from nested directories works.** If you run the CLI from `workspace/api/src/`, it walks up to find `workspace/` (git root) and discovers all projects.

**Explicit override:** Use `--root <path>` to point at a specific directory, or create a `.backlog-projects.json` at your git root:

```json
{
  "projects": [
    { "name": "frontend", "path": "frontend/.backlog" },
    { "name": "api", "path": "services/api/.backlog" }
  ]
}
```

### Discovery Troubleshooting

Auto-scan only goes 2 levels deep from git root. Deeper backlogs (e.g., `verticals/pet_boarding/app/.backlog` = 3 levels) won't be found automatically.

**Fix:** Add a `.backlog-projects.json` at the git root to register deep-nested backlogs:
```json
{ "projects": [{ "name": "pet-boarding", "path": "verticals/pet_boarding/app/.backlog" }] }
```

If a user asks about a project and it's not discovered, check depth and suggest adding it to `.backlog-projects.json` before retrying. Never tell the user "project not found" without checking for deep nesting first.

## Core Concepts

### Folder Model (Kanban)

Items live in exactly one folder at a time:

| Folder | Purpose |
|--------|---------|
| `next/` | Refined, ready to pick up |
| `working/` | Currently in progress |
| `done/` | Completed |
| `archive/` | Archived (won't do, or historical) |

**Flow:** Create in `next/` → move to `working/` when started → `done/` when completed → `archive/` when cancelled/obsolete.

**Status auto-sync:** The `Status` field is automatically updated when items move between folders: `next→Not Started`, `working→In Progress`, `done→Done`, `archive→Archived`. Folder is always the source of truth.

> ⚠️ **Always commit backlog changes.** `.backlog/` files are tracked in git. After any state change (`move`, `complete`, `archive`, `create`, `update-body`), include the modified `.backlog/` files in your next `git commit`. Backlog changes left uncommitted will be lost on branch switches or worktree cleanup, and will appear stale to other sessions.

### ID Conventions

**Single-Project Mode:** Bare IDs like `B-001`, `B-001.1` (child), `B-002`

**Multi-Project Mode:** Qualified IDs like `frontend/B-001`, `api/B-003`

- When `--project` is provided, bare IDs work within that scope
- Cross-project references always use qualified IDs
- On disk, IDs are always bare (`B-NNN`) — qualification is CLI-level only

**ID Allocation:** Sequential top-level (`B-001`, `B-002`) and nested children (`B-001.1`, `B-001.2`)

### Item Metadata

Items are markdown files with structured frontmatter:

```markdown
# B-001: Setup authentication

**Created:** 2026-01-15  
**Type:** Story  
**Priority:** High  
**Status:** In Progress  
**Estimate:** 3d  
**Updated:** 2026-01-17  
**Parent:** N/A  
**Depends On:** [B-002](../next/B-002_database.md)  
**Related:** [frontend/B-001](../../frontend/.backlog/next/B-001_login.md)  
**Tags:** [auth, security]  

---

## Goal
Implement JWT-based authentication...
```

**Required Fields:** Created, Type, Priority, Status  
**Optional Fields:** Updated, Completed, Archived, Estimate, Parent, Depends On, Related, Tags

### Acceptance Criteria (Done When)

Every item — especially items destined for parallel worker execution — **must** include a `## Done When` section with verifiable conditions:

```markdown
## Done When
- [ ] [specific, testable condition]
- [ ] [specific, testable condition]
- [ ] Tests pass: [test name or command]
- [ ] No files modified outside: [scope boundary]
```

**For worker-destined items**, always include:
- **Scope boundary** — which files/directories the worker should modify
- **Interface contract** — if other items depend on types/APIs this item creates, define them
- **Exclusions** — what this item explicitly does NOT cover (prevents scope overlap between parallel workers)

**Example:**
```markdown
## Done When
- [ ] `src/components/ui/form.tsx` wraps react-hook-form + zod with typed `FormField`
- [ ] `src/features/pricing/components/shared/entity-drawer.tsx` — reusable Sheet-based CRUD drawer
- [ ] `src/features/pricing/hooks/use-mutation.ts` — optimistic mutation hooks
- [ ] Does NOT modify any tab components (rate-cards-tab, discounts-tab, etc.)
- [ ] TypeScript compiles with zero errors
```

Items without `## Done When` are acceptable only for exploratory/research tasks.

## Essential Commands

### Briefing & Status

```bash
# One-call briefing: health, WIP, next items (unblocked/blocked), stats
$BACKLOG brief [--project X]

# Human-readable output
$BACKLOG brief --format summary
```

> **`brief` now surfaces mismatches.** If items have a Status field that doesn't match their folder (e.g., Status=Done but file is in `next/`), they appear in the `mismatches` array and are excluded from `next_unblocked`. Run `$BACKLOG hygiene --fix` to auto-repair them.

### Read Operations

```bash
# List items in a folder
$BACKLOG list [--project X] [--folder next|working|done|archive] [--limit N]

# List only unblocked next items (all dependencies resolved)
$BACKLOG list --folder next --unblocked

# Get full item details
$BACKLOG get <id>

# Search for items
$BACKLOG search <text> [--project X] [--folder F]

# Get statistics
$BACKLOG stats [--project X]

# Find cross-references
$BACKLOG xref <id>

# Check backlog health
$BACKLOG hygiene [--stale-days 30] [--done-days 7]

# Validate item structure
$BACKLOG validate <id>

# Start HTML dashboard (read-only, live-reloading)
$BACKLOG serve [--port 3000] [--root <path>]
```

### Write Operations

```bash
# Pick an item to work on (moves to working + returns full details)
$BACKLOG pick <id>

# Create new item
$BACKLOG create --kind task|epic --title "..." \
  [--project X] [--description "..."] [--priority low|medium|high] \
  [--tags a,b] [--parent B-001] [--depends-on a/B-001,b/B-002]

# Move item between folders (supports comma-separated batch)
$BACKLOG move <id>[,id2,...] --to next|working|done|archive

# Mark item(s) complete (moves to done/)
$BACKLOG complete <id>[,id2,...] [--date 2026-01-15]

# Archive item(s) (moves to archive/)
$BACKLOG archive <id>[,id2,...]

# Update item body (reads from stdin)
echo "New content" | $BACKLOG update-body <id> [--message "edit note"]
```

> **QUALITY GATE**: After `create`, the generated file includes `## Goal`, `## Done When`, and `## Acceptance Criteria` sections with placeholders. You **MUST** fill these in with real content — use `update-body` if needed. A one-line title with placeholder sections is useless when the item is later picked up for implementation. For epics, include the overall objective and success criteria. For stories, include scope boundaries, interface contracts, and exclusions.

### Code Execution (multi-step queries)

Use `exec` for JavaScript composition — combine multiple API calls in a single command:

```bash
BACKLOG="node <skill-dir>/scripts/index.js"

$BACKLOG exec --code '
  const items = await backlog.list({ folder: "next" });
  const highPri = items.filter(i => i.priority === "High");
  const stats = await backlog.stats();
  return { high_priority: highPri.length, total: items.length, stats };
'

# With custom timeout (default: 5000ms)
$BACKLOG exec --timeout 10000 --code '
  const health = await backlog.hygiene({ staleAfterDays: 14 });
  const archived = [];
  for (const item of health.old_in_done) {
    await backlog.archive({ id: item.id });
    archived.push(item.id);
  }
  return { archived, health_score: health.health_score };
'
```

The `backlog` object exposes the full API — call `backlog.help()` inside exec for the complete reference.

### JSON Output

All commands output JSON for easy parsing:

```bash
# Extract IDs
$BACKLOG list --folder next | jq -r '.[].id'

# Filter by priority
$BACKLOG list | jq '.[] | select(.priority == "High")'

# Check stats
$BACKLOG stats | jq '.default.next'
```

## Post-Completion Workflow

After completing an item or epic via `complete`, ALWAYS perform these follow-up steps:

### For Individual Items
1. Commit backlog changes: `git add .backlog/ && git commit -m "chore(backlog): [id] done"`
2. Check if this unblocks siblings: `$BACKLOG list --folder next --unblocked`
3. If unblocked items exist, present them: "Unblocked: [list]. Pick one up?"

### For Epics (all children done)
1. Commit all backlog changes
2. Run verification: suggest test/build/Playwright check appropriate to the epic's domain
3. Show newly unblocked items across ALL projects: `$BACKLOG brief --format summary`
4. Surface discovered work: list any bugs, gaps, or new requirements found during implementation
5. **Bridge to next action** — never end with just a summary table. Always end with:
   "**Next options:** [unblocked items] | Create new items | Review/verify | Different direction"

### For Parked/Deferred Work
When the user decides to park or defer an epic/item:
1. Update the item body with a dated note: `**[YYYY-MM-DD] Parked:** [reason]`
2. Move back to `next/`: `$BACKLOG move <id> --to next`
3. Commit with context: `git commit -m "chore(backlog): park [id] — [reason]"`
4. This creates a traceable audit trail visible to future sessions.

## Post-Epic Continuation

When an epic is completed mid-session and the user continues making changes to the same codebase:

1. **Track the pivot** — After epic completion, if the user requests further changes to the same feature area, prompt: *"This work isn't tracked in the backlog. Want me to create items under [epic] or a new epic?"*
2. **Batch capture** — If the user declines individual tracking, at session end, offer to create a single "cleanup" or "refinement" item capturing all untracked changes with a summary of what was done.
3. **Never let 3+ untracked changes accumulate** — If 3 or more significant untracked changes have been made in a session (each modifying 3+ files), proactively suggest backlog capture before continuing.

## Session Continuity

### Stale Worker Detection
After any worker-based epic execution, run reconciliation:
- Check if any `working/` items have no active worker or recent commits (>24h)
- Flag them: *"⚠️ [id] has been in working for [N] days with no commits. Stale?"*
- Offer to move stale items back to `next/` or archive them

### Session Start
The "First Actions" section already runs hygiene. Additionally:
- If `working/` has items, check their git branch activity. Items with no recent commits are likely stale from a prior session.
- Present a brief: "Resuming. In progress: [items]. Last activity: [date]. Continue or park?"

## Best Practices & Hygiene

### Commit Backlog Changes to Git

`.backlog/` directories are part of the repository. **Every backlog state change must be committed.** This is the most common source of stale state across sessions — agents do the work, call `complete()`, but never commit the moved files.

**After any backlog operation that modifies files** (`complete`, `move`, `archive`, `create`, `update-body`, `pick`, `hygiene --fix`):

```bash
# Include backlog files in the same commit as your code changes
git add .backlog/ && git commit -m "chore(backlog): mark B-042 done"

# Or include them in a feature commit
git add -A && git commit -m "feat: implement magic link auth

Backlog: B-042 → done"
```

**For workers/worktrees:** If using the copilot-cli-skill with `autoCommit: true`, backlog changes are included automatically. Otherwise, always commit before the worktree is cleaned up — uncommitted backlog changes are lost forever on cleanup.

**Rule of thumb:** If you called a backlog write command, you must `git add .backlog/` before your session ends.

### General Hygiene

Run `$BACKLOG hygiene --stale-days 30` weekly to prevent backlog rot. Archive done items after 7 days. Limit WIP to 3-5 items.

For detailed hygiene workflows, multi-project patterns, and best practices, see `references/best-practices.md`.

## Error Handling

All commands output JSON with non-zero exit codes on failure:

```bash
# Errors return JSON with "error" field
$BACKLOG get INVALID-ID
# → {"error": "Item not found: INVALID-ID"} (exit 1)

# Always check exit codes in scripts
if ! $BACKLOG validate B-001 > /dev/null 2>&1; then
  echo "Validation failed"
fi

# Common errors:
# - "Item not found" → Check ID format (B-NNN) and project scope
# - "No .backlog/ found" → Run from workspace root or check directory structure
# - "Dependency cycle" → Use xref to find circular references
```

## References

For detailed information, see:

- **`references/cli-reference.md`** — Full CLI command documentation with all options, JSON output examples, error handling
- **`references/workflows.md`** — Detailed workflow examples (sprint planning, epic creation, daily workflow, cross-project work)
- **`references/integration.md`** — Git hooks, CI/CD pipelines, Slack/Discord integration, automation patterns, troubleshooting

---

**Summary:** Use `$BACKLOG <command>` for all backlog operations. The CLI auto-discovers projects, outputs JSON, and handles both single and multi-project modes seamlessly.
