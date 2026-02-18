# Backlog CLI Reference

Complete command reference for the backlog CLI.

## CLI Location

```bash
scripts/backlog.js
```

Run commands relative to the skill root:

```bash
node scripts/backlog.js <command> [options]
```

## Auto-Discovery

The CLI automatically discovers projects by scanning for subdirectories containing a `.backlog/` folder, up to 2 levels deep from the current working directory or specified `--root`:

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

Project names for nested directories are joined with hyphens (e.g., `services-payments`).

## Read Commands

### list

List items in a folder.

```bash
node scripts/backlog.js list [options]
```

**Options:**
- `--project <name>` — Filter to specific project
- `--folder <next|working|done|archive>` — Filter to specific folder (default: all)
- `--limit <N>` — Limit results

**JSON Output:**
```json
[
  {
    "id": "B-001",
    "title": "Setup authentication",
    "priority": "High",
    "status": "In Progress",
    "folder": "working",
    "project": "default"
  }
]
```

### get

Get full item details.

```bash
node scripts/backlog.js get <id>
```

**JSON Output:**
```json
{
  "id": "B-001",
  "title": "Setup authentication",
  "metadata": {
    "Created": "2026-01-15",
    "Type": "Story",
    "Priority": "High",
    "Status": "In Progress"
  },
  "body": "## Goal\n\nImplement JWT-based authentication...",
  "path": "working/B-001_setup_authentication.md",
  "project": "default"
}
```

### search

Search for items by text.

```bash
node scripts/backlog.js search <text> [options]
```

**Options:**
- `--project <name>` — Search within specific project
- `--folder <name>` — Search within specific folder
- `--limit <N>` — Limit results

**JSON Output:** Array of items matching search (same format as `list`)

### stats

Get backlog statistics.

```bash
node scripts/backlog.js stats [--project <name>]
```

**JSON Output:**
```json
{
  "default": {
    "next": 5,
    "working": 3,
    "done": 12,
    "archive": 8,
    "age": {
      "next": {
        "oldest_days": 45,
        "avg_days": 23,
        "items_over_30d": 3
      },
      "working": {
        "oldest_days": 12,
        "avg_days": 6,
        "items_over_30d": 0
      }
    }
  }
}
```

### xref

Find cross-references to an item.

```bash
node scripts/backlog.js xref <id>
```

**JSON Output:**
```json
{
  "id": "api/B-003",
  "references": [
    {
      "id": "frontend/B-001",
      "type": "depends_on",
      "path": "frontend/.backlog/next/B-001_login_page.md"
    },
    {
      "id": "frontend/B-002",
      "type": "related",
      "path": "frontend/.backlog/next/B-002_user_profile.md"
    }
  ]
}
```

### history

View item version history.

```bash
node scripts/backlog.js history <id> [--limit <N>]
```

**JSON Output:**
```json
[
  {
    "version": 3,
    "timestamp": "2026-01-17T10:30:00Z",
    "message": "Added acceptance criteria",
    "diff": "..."
  },
  {
    "version": 2,
    "timestamp": "2026-01-16T14:20:00Z",
    "message": "Initial creation",
    "diff": "..."
  }
]
```

### validate

Validate item structure and dependencies.

```bash
node scripts/backlog.js validate <id>
```

**JSON Output:**
```json
{
  "valid": true,
  "issues": []
}
```

Or on validation failure:
```json
{
  "valid": false,
  "issues": [
    "Missing required field: Priority",
    "Depends on uncompleted item: B-002"
  ]
}
```

### hygiene

Check backlog health.

```bash
node scripts/backlog.js hygiene [options]
```

**Options:**
- `--project <name>` — Check specific project
- `--stale-days <N>` — Days before item is stale (default: 30)
- `--done-days <N>` — Days before done item should be archived (default: 7)

**JSON Output:**
```json
{
  "stale_next": [
    {
      "id": "B-005",
      "title": "Old feature request",
      "days_old": 45,
      "project": "default"
    }
  ],
  "stale_working": [],
  "old_done": [
    {
      "id": "B-001",
      "title": "Completed task",
      "days_in_done": 14,
      "project": "default"
    }
  ]
}
```

## Write Commands

### create

Create a new backlog item.

```bash
node scripts/backlog.js create --kind <type> --title "<title>" [options]
```

**Required:**
- `--kind <task|epic|story|bug|spike|chore>` — Item type
- `--title "<string>"` — Item title

**Optional:**
- `--project <name>` — Project name (default: auto-detect)
- `--description "<text>"` — Item description
- `--priority <low|medium|high>` — Priority (default: medium)
- `--tags <a,b,c>` — Comma-separated tags
- `--parent <id>` — Parent item ID
- `--depends-on <id1,id2>` — Dependencies (comma-separated, can use qualified IDs)
- `--related <id1,id2>` — Related items (comma-separated, can use qualified IDs)

**JSON Output:**
```json
{
  "id": "B-005",
  "path": "next/B-005_authentication_system.md",
  "project": "default"
}
```

### move

Move item between folders.

```bash
node scripts/backlog.js move <id> --to <next|working|done|archive>
```

**JSON Output:**
```json
{
  "id": "B-001",
  "from": "next",
  "to": "working",
  "path": "working/B-001_setup_authentication.md"
}
```

### complete

Mark item as complete (moves to done/).

```bash
node scripts/backlog.js complete <id> [--date <YYYY-MM-DD>]
```

**Options:**
- `--date <YYYY-MM-DD>` — Completion date (default: today)

**JSON Output:**
```json
{
  "id": "B-001",
  "completed_date": "2026-01-15",
  "path": "done/B-001_setup_authentication.md"
}
```

### archive

Archive an item (moves to archive/).

```bash
node scripts/backlog.js archive <id>
```

**JSON Output:**
```json
{
  "id": "B-002",
  "archived_date": "2026-01-15",
  "path": "archive/B-002_old_feature.md"
}
```

### update-body

Update item body content (reads from stdin).

```bash
echo "New body content" | node scripts/backlog.js update-body <id> [options]
```

**Options:**
- `--message "<text>"` — Edit message for history

**JSON Output:**
```json
{
  "id": "B-001",
  "version": 3,
  "message": "Added acceptance criteria"
}
```

**Example:**
```bash
# Get current body
node scripts/backlog.js get B-001 | jq -r '.body' > /tmp/B-001.md

# Edit the file
vim /tmp/B-001.md

# Update with version history
cat /tmp/B-001.md | node scripts/backlog.js update-body B-001 --message "Refined acceptance criteria"
```

## JSON Output & Parsing

All commands output JSON for easy parsing with `jq`:

```bash
# Extract IDs
node scripts/backlog.js list --folder next | jq -r '.[].id'

# Extract titles
node scripts/backlog.js list --folder working | jq -r '.[].title'

# Filter by priority
node scripts/backlog.js list | jq '.[] | select(.priority == "High")'

# Count items
node scripts/backlog.js stats | jq '.default.next'

# Get specific field
node scripts/backlog.js get B-001 | jq -r '.metadata.Priority'
```

## Error Handling

The CLI outputs JSON errors with non-zero exit codes:

```bash
node scripts/backlog.js get INVALID-ID
```

**Error Output:**
```json
{
  "error": "Item not found: INVALID-ID",
  "stack": "..."
}
```

**Exit code:** 1

**In Scripts:**
```bash
if ! node scripts/backlog.js validate B-001 > /dev/null; then
  echo "Validation failed"
  exit 1
fi
```

## ID Conventions

### Single-Project Mode

Bare IDs: `B-001`, `B-001.1` (child), `B-002`.

### Multi-Project Mode

Qualified IDs: `frontend/B-001`, `api/B-003`.

- When `--project` is provided, bare IDs work within that scope
- Cross-project references always use qualified IDs: `project/B-NNN`
- The ID format on disk is always bare (`B-NNN`) — qualification is CLI-level only

### ID Allocation

IDs are allocated sequentially:
- Top-level items: `B-001`, `B-002`, `B-003`
- Child items: `B-001.1`, `B-001.2`, `B-002.1`

## Common Options

Many commands support these global options:

- `--root <path>` — Override project scan directory (default: current working directory)
- `--project <name>` — Target specific project
- `--help` — Show help for command
