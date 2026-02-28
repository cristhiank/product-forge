# Backlog Best Practices & Hygiene

Detailed guidance on maintaining a healthy backlog, multi-project patterns, and tips for effective use.

## Backlog Hygiene

**The key to preventing backlog rot.**

### Weekly Review

```bash
# Find stale items (not updated in 30+ days)
node scripts/index.js hygiene --stale-days 30

# Output shows:
# - stale_next: Items in next/ not updated in 30 days
# - stale_working: Items in working/ not updated in 30 days
# - old_done: Items in done/ for more than 7 days (should archive)
```

### Archive Old Done Items

```bash
# Find and archive items done for >7 days
for id in $(node scripts/index.js hygiene --done-days 7 | jq -r '.old_done[].id'); do
  node scripts/index.js archive $id
done
```

### Fix Status/Folder Mismatches

```bash
# Detect mismatches (items where Status field doesn't match folder)
node scripts/index.js hygiene | jq '.status_folder_mismatches'

# Auto-repair all mismatches
node scripts/index.js hygiene --fix
```

### Dependency Validation

```bash
# Validate all items in working/
for id in $(node scripts/index.js list --folder working | jq -r '.[].id'); do
  node scripts/index.js validate $id
done
```

### Age Distribution

```bash
# Check age stats
node scripts/index.js stats | jq '.default.age'

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
node scripts/index.js create --kind task --title "Call user API" \
  --project web-app --depends-on backend-api/B-001

# Find all items referencing a backend item
node scripts/index.js xref backend-api/B-001
```

### Global Operations

```bash
# Search across all projects
node scripts/index.js search "authentication"

# Stats for specific project
node scripts/index.js stats --project backend-api

# Stats for all projects
node scripts/index.js stats
```

## Tips

- **Before creating:** Search first to avoid duplicates
- **When blocked:** Update item body with blocker details, adjust status
- **Dependencies:** Use `xref` to find impact before completing items
- **Estimates:** Track actuals vs. estimates to improve planning
- **Tags:** Use for categorization (e.g., `security`, `tech-debt`, `bug`)
- **Parent/Child:** Use for epics and subtasks to maintain hierarchy
- **History:** Use `history <id>` to see version changes over time
