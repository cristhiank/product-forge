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

## ⛔ CRITICAL: Never Browse .backlog/ Directly

**DO NOT** use `ls`, `cat`, `view`, `find`, or any file browsing on `.backlog/` directories. The markdown files have structured metadata that requires the CLI parser. Direct file browsing:
- Misses metadata parsing (priority, status, dependencies, tags)
- Skips cross-project discovery
- Returns raw markdown instead of structured JSON
- Breaks the kanban workflow model

**ALWAYS use the CLI** (`node <skill-dir>/scripts/backlog.js <command>`) for ALL backlog operations.

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
BACKLOG="node <skill-dir>/scripts/backlog.js"

# List items ready to pick up
$BACKLOG list --folder next

# Create a new task
$BACKLOG create --kind task --title "Fix login bug" --priority high

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

### Read Operations

```bash
# List items in a folder
node scripts/backlog.js list [--project X] [--folder next|working|done|archive] [--limit N]

# Get full item details
node scripts/backlog.js get <id>

# Search for items
node scripts/backlog.js search <text> [--project X] [--folder F]

# Get statistics
node scripts/backlog.js stats [--project X]

# Find cross-references
node scripts/backlog.js xref <id>

# Check backlog health
node scripts/backlog.js hygiene [--stale-days 30] [--done-days 7]

# Validate item structure
node scripts/backlog.js validate <id>

# Start HTML dashboard (read-only, live-reloading)
node scripts/backlog.js serve [--port 3000] [--root <path>]
```

### Write Operations

```bash
# Create new item
node scripts/backlog.js create --kind task|epic --title "..." \
  [--project X] [--description "..."] [--priority low|medium|high] \
  [--tags a,b] [--parent B-001] [--depends-on a/B-001,b/B-002]

# Move item between folders
node scripts/backlog.js move <id> --to next|working|done|archive

# Mark item complete (moves to done/)
node scripts/backlog.js complete <id> [--date 2026-01-15]

# Archive item (moves to archive/)
node scripts/backlog.js archive <id>

# Update item body (reads from stdin)
echo "New content" | node scripts/backlog.js update-body <id> [--message "edit note"]
```

### Code Execution (multi-step queries)

Use `exec` for JavaScript composition — combine multiple API calls in a single command:

```bash
BACKLOG="node <skill-dir>/scripts/backlog.js"

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
node scripts/backlog.js list --folder next | jq -r '.[].id'

# Extract titles
node scripts/backlog.js list --folder working | jq -r '.[].title'

# Filter by priority
node scripts/backlog.js list | jq '.[] | select(.priority == "High")'

# Check stats
node scripts/backlog.js stats | jq '.default.next'
```

## Common Workflows

### Daily Workflow

```bash
# Morning: Review work in progress
node scripts/backlog.js list --folder working | jq -r '.[] | "\(.id): \(.title)"'

# Start new work
node scripts/backlog.js move B-003 --to working

# End of day: Complete finished items
node scripts/backlog.js complete B-001

# Check tomorrow's work
node scripts/backlog.js list --folder next --limit 5
```

### Sprint Planning

```bash
# 1. Review stats
node scripts/backlog.js stats

# 2. Check health
node scripts/backlog.js hygiene --stale-days 30

# 3. Review next items
node scripts/backlog.js list --folder next | jq -r '.[] | "\(.id) [\(.priority)] \(.title)"'

# 4. Pick top priority items
node scripts/backlog.js move B-001 --to working
node scripts/backlog.js move B-002 --to working

# 5. Verify dependencies
node scripts/backlog.js validate B-001
node scripts/backlog.js validate B-002
```

### Creating Epic with Children

```bash
# Create epic and capture ID
EPIC=$(node scripts/backlog.js create --kind epic --title "User Management" --priority high | jq -r '.id')

# Create child tasks
node scripts/backlog.js create --kind task --title "User registration" --parent $EPIC
node scripts/backlog.js create --kind task --title "User profile" --parent $EPIC
node scripts/backlog.js create --kind task --title "Password reset" --parent $EPIC
```

### Cross-Project Dependencies

```bash
# Frontend item depends on API item
node scripts/backlog.js create --kind task --title "Login page" \
  --project frontend --depends-on api/B-003 --related api/B-004

# Find all references to an item
node scripts/backlog.js xref api/B-003
```

## Backlog Hygiene

**The key to preventing backlog rot.**

### Weekly Review

```bash
# Find stale items (not updated in 30+ days)
node scripts/backlog.js hygiene --stale-days 30

# Output shows:
# - stale_next: Items in next/ not updated in 30 days
# - stale_working: Items in working/ not updated in 30 days
# - old_done: Items in done/ for more than 7 days (should archive)
```

### Archive Old Done Items

```bash
# Find and archive items done for >7 days
for id in $(node scripts/backlog.js hygiene --done-days 7 | jq -r '.old_done[].id'); do
  node scripts/backlog.js archive $id
done
```

### Fix Status/Folder Mismatches

```bash
# Detect mismatches (items where Status field doesn't match folder)
node scripts/backlog.js hygiene | jq '.status_folder_mismatches'

# Auto-repair all mismatches
node scripts/backlog.js hygiene --fix
```

### Dependency Validation

```bash
# Validate all items in working/
for id in $(node scripts/backlog.js list --folder working | jq -r '.[].id'); do
  node scripts/backlog.js validate $id
done
```

### Age Distribution

```bash
# Check age stats
node scripts/backlog.js stats | jq '.default.age'

# Output shows:
# - oldest_days: Oldest item in each folder
# - avg_days: Average age
# - items_over_30d: Count of stale items
```

## Best Practices

1. **Use jq for parsing** — CLI outputs JSON; always pipe to `jq` for processing
2. **Check hygiene weekly** — Run `hygiene` to find stale items before they accumulate
3. **Validate dependencies** — Use `validate` before moving items to working
4. **Archive old done items** — Keep `done/` lean by archiving items after 7 days
5. **Use qualified IDs for cross-project refs** — Always use `project/ID` format
6. **Tag consistently** — Use consistent tags across projects for better search
7. **Limit WIP** — Keep `working/` small (suggest 3-5 items per person)
8. **Refine continuously** — Update items as you learn more
9. **Prune ruthlessly** — Archive items you'll never do to avoid backlog rot
10. **Version history** — Use `--message` when updating items for audit trail

## Multi-Project Patterns

### Consistent Naming

Use consistent project names that match your folder structure:

```
workspace/
├── web-app/       → project: "web-app"
├── mobile-app/    → project: "mobile-app"
└── backend-api/   → project: "backend-api"
```

### Cross-Project References

Always use qualified IDs:

```bash
# Create frontend item referencing backend
node scripts/backlog.js create --kind task --title "Call user API" \
  --project web-app --depends-on backend-api/B-001

# Find all items referencing a backend item
node scripts/backlog.js xref backend-api/B-001
```

### Global Operations

```bash
# Search across all projects
node scripts/backlog.js search "authentication"

# Stats for specific project
node scripts/backlog.js stats --project backend-api

# Stats for all projects
node scripts/backlog.js stats
```

## Error Handling

The CLI outputs JSON errors with non-zero exit codes:

```bash
node scripts/backlog.js get INVALID-ID

# Output:
# {
#   "error": "Item not found: INVALID-ID",
#   "stack": "..."
# }
# Exit code: 1
```

Always check exit codes in scripts:

```bash
if ! node scripts/backlog.js validate B-001 > /dev/null; then
  echo "Validation failed"
  exit 1
fi
```

## Tips

- **Before creating:** Search first to avoid duplicates
- **When blocked:** Update item body with blocker details, adjust status
- **Dependencies:** Use `xref` to find impact before completing items
- **Estimates:** Track actuals vs. estimates to improve planning
- **Tags:** Use for categorization (e.g., `security`, `tech-debt`, `bug`)
- **Parent/Child:** Use for epics and subtasks to maintain hierarchy
- **History:** Use `history <id>` to see version changes over time

## References

For detailed information, see:

- **`references/cli-reference.md`** — Full CLI command documentation with all options, JSON output examples, error handling
- **`references/workflows.md`** — Detailed workflow examples (sprint planning, epic creation, daily workflow, cross-project work)
- **`references/integration.md`** — Git hooks, CI/CD pipelines, Slack/Discord integration, automation patterns, troubleshooting

---

**Summary:** Use `node scripts/backlog.js <command>` for all backlog operations. The CLI auto-discovers projects, outputs JSON, and handles both single and multi-project modes seamlessly.
