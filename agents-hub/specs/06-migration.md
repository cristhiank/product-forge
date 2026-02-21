# agents-hub — Migration from agents-board

## Overview

agents-hub replaces agents-board entirely. This document maps every agents-board concept to its agents-hub equivalent, and defines what is intentionally dropped.

## Entity Mapping

### Kept (transformed)

| agents-board | agents-hub | How |
|---|---|---|
| **Fact** (F-N) | `note` with tag `finding` | `hub post --type note --tags '["finding"]' --metadata '{"confidence":"high"}'` |
| **Snippet** (X-N) | `note` with tag `snippet` | `hub post --type note --tags '["snippet"]' --metadata '{"path":"...","lines":[1,20]}'` |
| **Decision** (D-N) | `decision` message | `hub post --type decision --metadata '{"status":"proposed"}'` |
| **Alert** (A-N) | `request` message | `hub post --type request --metadata '{"severity":"blocker"}'` |
| **PlanStep** (S-N) | `note` with tag `plan` + `status` messages | Plan as a note, progress as status updates |
| **Trail** (T-N) | `note` with tag `trail` | `hub post --type note --tags '["trail","decision"]'` |
| **Constraint** (C-N) | `note` with tag `constraint` | `hub post --type note --tags '["constraint"]'` |

### Dropped (intentionally)

| agents-board feature | Why dropped |
|---|---|
| **Task lifecycle** (create-task, archive-task) | Over-engineered. `hub init` is enough. |
| **Mission entity** (goal, constraints, DoD) | First message in #main IS the mission. Constraints are notes. |
| **BoardMeta** (sequences, schema version) | SQLite handles IDs (UUIDs). Schema version in hub_meta table. |
| **Exec mode** (JavaScript eval) | CLI covers all use cases. Exec added complexity for rare benefit. |
| **SubTask** (S-1.1) | Nested steps were never used. Flat status messages suffice. |
| **StepResult** (files_changed, verification) | Metadata on status messages. |
| **Confidence as separate field** | In metadata JSON, not a typed field. |
| **Evidence as structured type** | In metadata JSON. More flexible. |
| **Separate jsonl files per entity** | Single SQLite table. |
| **Role-based write enforcement** | Simplified: channel-based (write-own). |

## Command Mapping

| agents-board command | agents-hub equivalent |
|---|---|
| `create-task --goal "..."` | `hub init` + `hub post --type note --content "Goal: ..."` |
| `add-fact --content "..." --confidence high` | `hub post --type note --tags '["finding"]' --metadata '{"confidence":"high"}'` |
| `add-snippet --path "..." --lines 1,20 --content "..."` | `hub post --type note --tags '["snippet"]' --metadata '{"path":"...","lines":[1,20]}'` |
| `propose-decision --title "..." --rationale "..."` | `hub post --type decision --metadata '{"status":"proposed","rationale":"..."}'` |
| `approve-decision --id D-1` | `hub reply --thread <id> --metadata '{"status":"approved"}'` |
| `raise-alert --severity blocker --title "..."` | `hub post --type request --metadata '{"severity":"blocker"}'` |
| `resolve-alert --id A-1 --resolution "..."` | `hub reply --thread <id> --metadata '{"resolved":true}'` |
| `set-plan --goal "..." --steps '[...]'` | `hub post --type note --tags '["plan"]' --content "## Plan\n..."` |
| `advance-step` | `hub post --type status --content "Starting step 2"` |
| `complete-step --verification true` | `hub post --type status --content "Step 2 complete" --metadata '{"step":2}'` |
| `search "query"` | `hub search "query"` |
| `view` | `hub status` |
| `append-trail --marker "[DECISION]"` | `hub post --type note --tags '["trail","decision"]'` |
| `get-facts --confidence high` | `hub read --type note --tags finding` (filter by metadata in results) |
| `get-snippets --path "src/auth"` | `hub search "src/auth" --type note --tags snippet` |
| `exec --code '...'` | Compose multiple `hub read` / `hub search` commands |

## What Agents Need to Change

### Constitution
- Replace all `board.*` method references with `hub` CLI commands
- Replace entity types (Fact, Snippet, Alert) with message types (note, decision, request, status)
- Replace "snippets-first" rule with "search-first" (search hub before reading files)
- Add channel awareness for multi-worker mode

### Agent Prompts
- Replace `$BOARD` with `$HUB`
- Replace `add-fact` with `post --type note`
- Replace `add-snippet` with `post --type note --tags '["snippet"]'`
- Replace `raise-alert` with `post --type request`
- Remove `exec` mode references
- Add channel parameter to all commands

### Skills
- agents-board skill → agents-hub skill
- devpartner skill → update board references to hub references
- backlog skill → no changes needed (operates independently)

## Backwards Compatibility

**None.** agents-hub is a clean break. v15/v16 continue to use agents-board. v17+ uses agents-hub. Both skills can coexist on the same system (different skill names).
