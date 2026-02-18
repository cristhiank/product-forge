# Backlog Integration Patterns

Integration patterns for Git, CI/CD, chat tools, and automation.

## Git Integration

### Pre-Commit Hook: Validate Referenced Items

Ensure all referenced backlog items exist before committing:

```bash
#!/bin/bash
# .git/hooks/pre-commit

# Find all markdown files in commit
git diff --cached --name-only --diff-filter=ACM | grep '.md$' | while read file; do
  # Extract referenced IDs (B-NNN format)
  grep -oE 'B-[0-9]+(\.[0-9]+)?' "$file" | sort -u | while read id; do
    # Validate each ID
    if ! node scripts/backlog.js validate "$id" > /dev/null 2>&1; then
      echo "❌ Invalid backlog reference in $file: $id"
      exit 1
    fi
  done
done

exit 0
```

### Post-Commit Hook: Auto-Update Item

Automatically update backlog item when related code is committed:

```bash
#!/bin/bash
# .git/hooks/post-commit

COMMIT_MSG=$(git log -1 --pretty=%B)

# Extract backlog ID from commit message (e.g., "[B-001] Fix login bug")
ID=$(echo "$COMMIT_MSG" | grep -oE 'B-[0-9]+(\.[0-9]+)?' | head -1)

if [ -n "$ID" ]; then
  # Get current body
  BODY=$(node scripts/backlog.js get "$ID" | jq -r '.body')
  
  # Append commit reference
  COMMIT_SHA=$(git rev-parse HEAD)
  NEW_BODY="$BODY

## Recent Commits
- [$COMMIT_SHA](../commit/$COMMIT_SHA): $COMMIT_MSG"

  # Update item
  echo "$NEW_BODY" | node scripts/backlog.js update-body "$ID" \
    --message "Auto-updated from commit $COMMIT_SHA"
fi
```

### Pre-Push Hook: Check Hygiene

Prevent pushing if backlog health is poor:

```bash
#!/bin/bash
# .git/hooks/pre-push

# Check for stale items
STALE=$(node scripts/backlog.js hygiene --stale-days 30 | \
  jq '.stale_working | length')

if [ "$STALE" -gt 5 ]; then
  echo "⚠️  Warning: $STALE stale items in working/"
  echo "Run: node scripts/backlog.js hygiene --stale-days 30"
  read -p "Continue anyway? [y/N] " -n 1 -r
  echo
  if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    exit 1
  fi
fi

exit 0
```

## CI/CD Integration

### GitHub Actions: Backlog Health Check

Run scheduled hygiene checks:

```yaml
# .github/workflows/backlog-health.yml
name: Backlog Health Check

on:
  schedule:
    - cron: '0 9 * * 1'  # Every Monday at 9am
  workflow_dispatch:

jobs:
  health-check:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      
      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '18'
      
      - name: Check backlog health
        run: |
          node scripts/backlog.js hygiene --stale-days 30 > health.json
          
          STALE_NEXT=$(jq '.stale_next | length' health.json)
          STALE_WORKING=$(jq '.stale_working | length' health.json)
          OLD_DONE=$(jq '.old_done | length' health.json)
          
          echo "📊 Backlog Health Report"
          echo "Stale items in next/: $STALE_NEXT"
          echo "Stale items in working/: $STALE_WORKING"
          echo "Old done items: $OLD_DONE"
          
          # Fail if too many stale items
          if [ $STALE_NEXT -gt 10 ]; then
            echo "❌ Too many stale items in next/"
            exit 1
          fi
          
          if [ $STALE_WORKING -gt 3 ]; then
            echo "❌ Too many stale items in working/"
            exit 1
          fi
      
      - name: Create issue if unhealthy
        if: failure()
        uses: actions/github-script@v6
        with:
          script: |
            github.rest.issues.create({
              owner: context.repo.owner,
              repo: context.repo.repo,
              title: 'Backlog health check failed',
              body: 'Automated backlog health check found issues. Review stale items.',
              labels: ['backlog', 'maintenance']
            })
```

### GitLab CI: Auto-Archive Done Items

Automatically archive old completed items:

```yaml
# .gitlab-ci.yml
backlog-archive:
  stage: maintain
  only:
    - schedules
  script:
    - node scripts/backlog.js hygiene --done-days 7 > hygiene.json
    - |
      jq -r '.old_done[].id' hygiene.json | while read id; do
        echo "Archiving $id..."
        node scripts/backlog.js archive "$id"
      done
    - |
      if git diff --quiet; then
        echo "No items to archive"
      else
        git config user.email "ci@example.com"
        git config user.name "CI Bot"
        git add .
        git commit -m "chore: auto-archive completed items"
        git push origin main
      fi
```

### Jenkins: Validate PR References

Ensure PR description references valid backlog items:

```groovy
// Jenkinsfile
pipeline {
  agent any
  
  stages {
    stage('Validate Backlog References') {
      steps {
        script {
          def prBody = env.CHANGE_BODY ?: ''
          def ids = (prBody =~ /B-[0-9]+(\.[0-9]+)?/).collect { it[0] }
          
          if (ids.isEmpty()) {
            echo "⚠️  No backlog references in PR description"
            return
          }
          
          ids.each { id ->
            def result = sh(
              script: "node scripts/backlog.js validate ${id}",
              returnStatus: true
            )
            
            if (result != 0) {
              error("❌ Invalid backlog reference: ${id}")
            }
          }
          
          echo "✅ All backlog references valid: ${ids.join(', ')}"
        }
      }
    }
  }
}
```

## Slack Integration

### Daily Summary Bot

Post daily backlog summary to Slack:

```bash
#!/bin/bash
# daily-backlog-summary.sh

STATS=$(node scripts/backlog.js stats | jq -c '{
  next: .default.next,
  working: .default.working,
  done: .default.done
}')

NEXT=$(echo "$STATS" | jq -r '.next')
WORKING=$(echo "$STATS" | jq -r '.working')
DONE=$(echo "$STATS" | jq -r '.done')

# Get stale items
STALE=$(node scripts/backlog.js hygiene --stale-days 30 | \
  jq '.stale_working | length')

MESSAGE="{
  \"text\": \"📊 Daily Backlog Summary\",
  \"blocks\": [
    {
      \"type\": \"section\",
      \"text\": {
        \"type\": \"mrkdwn\",
        \"text\": \"*Daily Backlog Summary*\"
      }
    },
    {
      \"type\": \"section\",
      \"fields\": [
        {\"type\": \"mrkdwn\", \"text\": \"*Next:* $NEXT\"},
        {\"type\": \"mrkdwn\", \"text\": \"*Working:* $WORKING\"},
        {\"type\": \"mrkdwn\", \"text\": \"*Done:* $DONE\"},
        {\"type\": \"mrkdwn\", \"text\": \"*Stale:* $STALE\"}
      ]
    }
  ]
}"

curl -X POST "$SLACK_WEBHOOK_URL" \
  -H 'Content-Type: application/json' \
  -d "$MESSAGE"
```

### Item Completion Notification

Notify channel when high-priority items complete:

```bash
#!/bin/bash
# notify-completion.sh

ITEM_ID=$1

# Get item details
ITEM=$(node scripts/backlog.js get "$ITEM_ID")
TITLE=$(echo "$ITEM" | jq -r '.title')
PRIORITY=$(echo "$ITEM" | jq -r '.metadata.Priority')

if [ "$PRIORITY" == "High" ]; then
  MESSAGE="{
    \"text\": \"✅ High priority item completed: [$ITEM_ID] $TITLE\"
  }"
  
  curl -X POST "$SLACK_WEBHOOK_URL" \
    -H 'Content-Type: application/json' \
    -d "$MESSAGE"
fi
```

Add to git hook:

```bash
#!/bin/bash
# .git/hooks/post-commit

# ... existing code ...

# Notify Slack if completion commit
if echo "$COMMIT_MSG" | grep -q "complete.*B-[0-9]"; then
  ID=$(echo "$COMMIT_MSG" | grep -oE 'B-[0-9]+(\.[0-9]+)?' | head -1)
  ./scripts/notify-completion.sh "$ID"
fi
```

## Discord Integration

### Webhook Notification

```bash
#!/bin/bash
# discord-notify.sh

STATS=$(node scripts/backlog.js stats)
NEXT=$(echo "$STATS" | jq -r '.default.next')
WORKING=$(echo "$STATS" | jq -r '.default.working')

curl -X POST "$DISCORD_WEBHOOK_URL" \
  -H 'Content-Type: application/json' \
  -d "{
    \"content\": \"📊 **Backlog Update**\",
    \"embeds\": [{
      \"title\": \"Current Status\",
      \"fields\": [
        {\"name\": \"Next\", \"value\": \"$NEXT\", \"inline\": true},
        {\"name\": \"Working\", \"value\": \"$WORKING\", \"inline\": true}
      ],
      \"color\": 3447003
    }]
  }"
```

## Email Reports

### Weekly Digest

```bash
#!/bin/bash
# weekly-digest.sh

HYGIENE=$(node scripts/backlog.js hygiene --stale-days 30)
STATS=$(node scripts/backlog.js stats)

STALE_NEXT=$(echo "$HYGIENE" | jq '.stale_next')
STALE_WORKING=$(echo "$HYGIENE" | jq '.stale_working')
OLD_DONE=$(echo "$HYGIENE" | jq '.old_done')

REPORT="Weekly Backlog Report

Stale Items in Next:
$STALE_NEXT

Stale Items in Working:
$STALE_WORKING

Old Done Items (should archive):
$OLD_DONE

Stats:
$STATS
"

echo "$REPORT" | mail -s "Weekly Backlog Report" team@example.com
```

## Automation Scripts

### Auto-Prioritize by Age

Increase priority of old items:

```bash
#!/bin/bash
# auto-prioritize.sh

# Find items in next/ older than 60 days
node scripts/backlog.js list --folder next | \
  jq -r '.[] | select(.days_old > 60) | .id' | \
  while read id; do
    echo "Escalating priority for $id (>60 days old)"
    
    # Get body and update priority
    node scripts/backlog.js get "$id" | \
      jq -r '.body' | \
      sed 's/\*\*Priority:\*\* Medium/\*\*Priority:\*\* High/' | \
      sed 's/\*\*Priority:\*\* Low/\*\*Priority:\*\* Medium/' | \
      node scripts/backlog.js update-body "$id" \
        --message "Auto-escalated due to age"
  done
```

### Auto-Tag by Content

Tag items based on content:

```bash
#!/bin/bash
# auto-tag.sh

node scripts/backlog.js list | jq -r '.[].id' | while read id; do
  BODY=$(node scripts/backlog.js get "$id" | jq -r '.body')
  
  TAGS=()
  
  # Detect tags from content
  echo "$BODY" | grep -iq "security\|auth\|jwt" && TAGS+=("security")
  echo "$BODY" | grep -iq "database\|sql\|migration" && TAGS+=("database")
  echo "$BODY" | grep -iq "frontend\|ui\|component" && TAGS+=("frontend")
  echo "$BODY" | grep -iq "api\|endpoint\|route" && TAGS+=("backend")
  
  if [ ${#TAGS[@]} -gt 0 ]; then
    TAG_STR=$(IFS=,; echo "${TAGS[*]}")
    echo "Auto-tagging $id with: $TAG_STR"
    
    # Update tags (simplified - real implementation would merge with existing)
    echo "$BODY" | \
      sed "s/\*\*Tags:\*\* \[\]/\*\*Tags:\*\* [$TAG_STR]/" | \
      node scripts/backlog.js update-body "$id" \
        --message "Auto-tagged"
  fi
done
```

## Troubleshooting

### No Projects Found

```bash
# Error: No .backlog/ directories found

# Solution 1: Check structure
ls -la .backlog/  # Should have next/, working/, done/, archive/

# Solution 2: Specify root explicitly
node scripts/backlog.js list --root /path/to/workspace
```

### Item Not Found

```bash
# Error: Item not found: B-001

# Verify ID format
node scripts/backlog.js list | jq -r '.[].id'  # Check actual IDs

# In multi-project mode, use qualified IDs
node scripts/backlog.js get frontend/B-001  # Not just B-001
```

### Validation Errors

```bash
# Validate returns issues
node scripts/backlog.js validate B-001

# Common issues:
# - Missing required metadata fields
# - Invalid folder references
# - Broken dependency links
# - Circular dependencies
```

### Permission Errors in CI

```bash
# Error: EACCES permission denied

# Solution: Ensure script is executable
chmod +x scripts/backlog.js

# Or call with node explicitly
node scripts/backlog.js list
```

### JSON Parsing Errors in Scripts

```bash
# Error: parse error in jq

# Always check command exit status before piping to jq
if OUTPUT=$(node scripts/backlog.js list 2>&1); then
  echo "$OUTPUT" | jq '.[] | .id'
else
  echo "Command failed: $OUTPUT"
  exit 1
fi
```

## Best Practices

1. **Git Hooks**: Use pre-commit to validate references, post-commit to update items
2. **CI/CD**: Run hygiene checks on schedule, fail builds on poor health
3. **Notifications**: Only notify on high-priority or exceptional events
4. **Automation**: Use cron for regular maintenance (archiving, priority escalation)
5. **Error Handling**: Always check exit codes before parsing JSON
6. **Rate Limiting**: Don't spam webhooks — batch notifications
7. **Versioning**: Use `--message` when auto-updating items for audit trail
