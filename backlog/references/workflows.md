# Backlog Workflows

Detailed workflow examples for common backlog management scenarios.

## Daily Workflow

### Morning: Review Work in Progress

```bash
# See what's currently in progress
node scripts/backlog.js list --folder working | jq -r '.[] | "\(.id): \(.title)"'

# Output:
# B-001: Setup authentication
# B-002: Create user endpoint
# B-003: Add error handling
```

### Start New Work

```bash
# Pick next item
node scripts/backlog.js list --folder next --limit 5

# Move to working
node scripts/backlog.js move B-004 --to working
```

### End of Day: Complete Finished Items

```bash
# Mark completed
node scripts/backlog.js complete B-001

# Or with specific date
node scripts/backlog.js complete B-001 --date 2026-01-15

# Check tomorrow's work
node scripts/backlog.js list --folder next --limit 5
```

## Sprint Planning

### 1. Review Stats

```bash
node scripts/backlog.js stats

# Shows counts and age distribution
```

### 2. Check Health

```bash
node scripts/backlog.js hygiene --stale-days 30

# Identify stale items before planning
```

### 3. Review Next Items

```bash
node scripts/backlog.js list --folder next | jq -r '.[] | "\(.id) [\(.priority)] \(.title)"'

# Output:
# B-001 [High] Setup authentication
# B-002 [High] Create user endpoint
# B-003 [Medium] Add logging
```

### 4. Pick Top Priority Items

```bash
node scripts/backlog.js move B-001 --to working
node scripts/backlog.js move B-002 --to working
node scripts/backlog.js move B-003 --to working
```

### 5. Verify Dependencies

```bash
node scripts/backlog.js validate B-001
node scripts/backlog.js validate B-002
node scripts/backlog.js validate B-003

# Will warn if items depend on uncompleted work
```

## Creating Epic with Children

### 1. Create Parent Epic

```bash
# Create epic and capture ID
EPIC=$(node scripts/backlog.js create \
  --kind epic \
  --title "User Management" \
  --priority high \
  --tags auth,users | jq -r '.id')

echo "Created epic: $EPIC"
# Output: Created epic: B-005
```

### 2. Create Child Tasks

```bash
# Create child tasks linked to epic
node scripts/backlog.js create \
  --kind task \
  --title "User registration" \
  --parent $EPIC \
  --priority high

node scripts/backlog.js create \
  --kind task \
  --title "User profile page" \
  --parent $EPIC \
  --priority medium

node scripts/backlog.js create \
  --kind task \
  --title "Password reset flow" \
  --parent $EPIC \
  --priority medium
```

### 3. List All Children

```bash
# Search for items under this epic
node scripts/backlog.js search "User" --folder next | \
  jq '.[] | select(.id | startswith("'$EPIC'"))'
```

## Cross-Project Dependencies

### Frontend Item Depends on Backend API

```bash
# Create frontend item with backend dependency
node scripts/backlog.js create \
  --kind task \
  --title "Login page" \
  --project frontend \
  --depends-on api/B-003 \
  --related api/B-004

# Output:
# {"id":"frontend/B-001","path":"next/B-001_login_page.md","project":"frontend"}
```

### Find All References to an Item

```bash
# Find what depends on this API item
node scripts/backlog.js xref api/B-003

# Output shows all items that reference api/B-003
```

### Completing Items with Cross-Project Dependencies

```bash
# Backend team completes API
node scripts/backlog.js complete api/B-003 --project api

# Frontend team can now validate their dependent item
node scripts/backlog.js validate frontend/B-001 --project frontend
# Should now pass validation
```

## Backlog Hygiene

### Weekly Review Script

```bash
#!/bin/bash
# weekly-review.sh

echo "=== Backlog Health Report ==="
echo ""

echo "=== Stale Items (>30 days) ==="
node scripts/backlog.js hygiene --stale-days 30 | \
  jq '.stale_next + .stale_working'

echo ""
echo "=== Old Done Items (>7 days) ==="
node scripts/backlog.js hygiene --done-days 7 | \
  jq '.old_done'

echo ""
echo "=== Stats by Project ==="
node scripts/backlog.js stats | \
  jq 'to_entries | .[] | "\(.key): \(.value.next) next, \(.value.working) working"'
```

### Archive Old Completed Items

```bash
# Find items done for more than 7 days
for id in $(node scripts/backlog.js hygiene --done-days 7 | jq -r '.old_done[].id'); do
  echo "Archiving $id..."
  node scripts/backlog.js archive $id
done
```

### Dependency Validation

```bash
# Validate all items in working/
for id in $(node scripts/backlog.js list --folder working | jq -r '.[].id'); do
  echo "Validating $id..."
  if ! node scripts/backlog.js validate $id; then
    echo "⚠️  Validation failed for $id"
  fi
done
```

### Age Distribution Check

```bash
# Check age distribution
node scripts/backlog.js stats | jq '.default.age'

# Output:
# {
#   "next": {
#     "oldest_days": 45,
#     "avg_days": 23,
#     "items_over_30d": 3
#   },
#   "working": {
#     "oldest_days": 12,
#     "avg_days": 6,
#     "items_over_30d": 0
#   }
# }
```

## Updating Item Content

### Edit Item Body

```bash
# 1. Get current body
node scripts/backlog.js get B-001 | jq -r '.body' > /tmp/B-001.md

# 2. Edit the file
vim /tmp/B-001.md

# 3. Update with version history
cat /tmp/B-001.md | node scripts/backlog.js update-body B-001 \
  --message "Added acceptance criteria"
```

### View Version History

```bash
# Get all versions
node scripts/backlog.js history B-001

# Get last 5 versions
node scripts/backlog.js history B-001 --limit 5

# Extract specific version diff
node scripts/backlog.js history B-001 | jq '.[0].diff'
```

## Multi-Project Operations

### Global Search

```bash
# Search across all projects
node scripts/backlog.js search "authentication"

# Output shows results from all projects with qualified IDs
```

### Stats for All Projects

```bash
# Get stats for all projects
node scripts/backlog.js stats | jq 'keys'

# Get stats for specific project
node scripts/backlog.js stats --project backend-api
```

### Create Cross-Project Epic

```bash
# Create shared epic
EPIC=$(node scripts/backlog.js create \
  --kind epic \
  --title "Authentication System" \
  --project shared \
  --priority high | jq -r '.id')

# Frontend task referencing shared epic
node scripts/backlog.js create \
  --kind task \
  --title "Login UI" \
  --project frontend \
  --related shared/$EPIC

# Backend task referencing shared epic
node scripts/backlog.js create \
  --kind task \
  --title "Auth API" \
  --project backend \
  --related shared/$EPIC
```

## Batch Operations

### Bulk Complete

```bash
# Complete multiple items at once
for id in B-001 B-002 B-003; do
  node scripts/backlog.js complete $id
done
```

### Bulk Tag

```bash
# Add same tag to multiple items (via update-body)
for id in B-001 B-002 B-003; do
  node scripts/backlog.js get $id | \
    jq -r '.body' | \
    sed 's/\*\*Tags:\*\* \[/\*\*Tags:\*\* [security, /' | \
    node scripts/backlog.js update-body $id --message "Added security tag"
done
```

### Bulk Priority Change

```bash
# Change priority for multiple items
IDS=("B-001" "B-002" "B-003")

for id in "${IDS[@]}"; do
  node scripts/backlog.js get $id | \
    jq -r '.body' | \
    sed 's/\*\*Priority:\*\* Medium/\*\*Priority:\*\* High/' | \
    node scripts/backlog.js update-body $id --message "Escalated priority"
done
```

## Advanced Queries

### Find High Priority Items Not Started

```bash
node scripts/backlog.js list --folder next | \
  jq '.[] | select(.priority == "High" and .status == "Not Started")'
```

### Find Blocked Items

```bash
node scripts/backlog.js list --folder working | \
  jq '.[] | select(.status == "Blocked")'
```

### Find Items by Tag

```bash
# Search is fuzzy, so this finds items with the tag
node scripts/backlog.js search "auth" | \
  jq '.[] | select(.tags | contains(["auth"]))'
```

### Find Items Older Than X Days

```bash
# Using stats age data
node scripts/backlog.js stats | \
  jq '.default.age.next | select(.items_over_30d > 0)'
```

## Best Practices

1. **Daily**: Review `working/`, complete finished items, pick next work
2. **Weekly**: Run hygiene checks, archive old done items, review stale items
3. **Sprint Planning**: Review stats, validate dependencies, move items to working
4. **Before Creating**: Search first to avoid duplicates
5. **When Blocked**: Update item body with blocker details, adjust status
6. **Cross-Project**: Always use qualified IDs (`project/B-NNN`)
7. **Tagging**: Use consistent tags across projects for better search
8. **Dependencies**: Validate before moving to working
9. **Archiving**: Keep `done/` lean — archive after 7 days
10. **Updating**: Use version history (`--message`) to track changes
