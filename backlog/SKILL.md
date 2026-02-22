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

1. **Get a briefing** — `$BACKLOG brief --format summary` — see health, WIP, what's next
2. **Check working items** — `$BACKLOG list --folder working` — see what's in progress
3. **Find unblocked work** — `$BACKLOG list --folder next --unblocked` — see what's ready to pick up

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

The CLI auto-discovers `.backlog/` directories (up to 2 levels deep) from the current working directory. It supports **CLI commands** for simple operations and **exec** for JavaScript composition. All output is JSON.

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

The CLI automatically discovers projects by scanning for subdirectories containing a `.backlog/` folder:

```
workspace/
├── frontend/
│   └── .backlog/           → project: "frontend"
├── api/
│   └── .backlog/           → project: "api"
└── services/
    └── payments/
        └── .backlog/       → project: "services-payments" (nested, auto-named)
```

If run from `workspace/`, it discovers all projects. Nested directories get hyphenated names (e.g., `services-payments`).

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

## Essential Commands

### Briefing & Status

```bash
# One-call briefing: health, WIP, next items (unblocked/blocked), stats
$BACKLOG brief [--project X]

# Human-readable output
$BACKLOG brief --format summary
```

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

## Best Practices & Hygiene

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
