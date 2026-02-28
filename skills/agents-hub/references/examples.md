# agents-hub — Workflow Examples

Real-world protocols showing how agents use the hub for coordination.

---

## Example 1: Single-Worker Session (v16 compatible)

The simplest mode. One Orchestrator + its subagents share a single `#main` channel.

### Setup

```bash
# Initialize single-worker hub
$HUB init --mode single
```

**Output:**
```json
{
  "hub_id": "550e8400-e29b-41d4-a716-446655440000",
  "mode": "single",
  "channels": ["#main"]
}
```

### Phase 1: Scout Exploration

Scout explores codebase and posts findings to hub:

```bash
# Post finding about auth implementation
$HUB post --channel '#main' --type note --author scout \
  --content "Found: Auth uses bcrypt for password hashing (sha256 salt)" \
  --tags '["finding","auth","security"]' \
  --metadata '{"path":"src/auth.ts","lines":[45,60],"snippet_id":"X-1"}'

# Post finding about email service
$HUB post --channel '#main' --type note --author scout \
  --content "Found: SendGrid configured for transactional email" \
  --tags '["finding","email","config"]' \
  --metadata '{"path":"src/email/config.ts","lines":[10,25],"snippet_id":"X-2"}'

# Post constraint
$HUB post --channel '#main' --type note --author scout \
  --content "Constraint: User.email field is nullable (legacy data)" \
  --tags '["constraint","schema"]' \
  --metadata '{"path":"src/models/User.ts","lines":[23,30]}'
```

### Phase 2: Creative Planning

Creative searches hub for context, then proposes approach:

```bash
# Search for auth-related findings
$HUB search "auth bcrypt" --channel '#main' --limit 5

# Creative posts decision proposal
$HUB post --channel '#main' --type decision --author creative \
  --content "## Approach: Token-Based Password Reset\n\n1. Generate secure token (crypto.randomBytes)\n2. Email magic link with token\n3. Verify token on GET /auth/reset/:token\n4. Update password if valid" \
  --tags '["proposal","auth"]' \
  --metadata '{"status":"proposed","approach_id":"D-1","references":["X-1","X-2"]}'
```

**Response (Orchestrator approves):**
```bash
DECISION_ID="msg-550e8400-..."

# Orchestrator approves decision
$HUB reply --thread $DECISION_ID --author orchestrator \
  --content "Approved. Proceed with token-based reset flow." \
  --metadata '{"status":"approved"}'
```

### Phase 3: Executor Implementation

Executor reads approved decision and executes:

```bash
# Read approved decisions
$HUB read --type decision --channel '#main'

# Post progress updates
$HUB post --channel '#main' --type status --author executor \
  --content "Step 1/4: Token generator created (src/auth/magic-token.ts)" \
  --metadata '{"step":1,"total_steps":4,"files_changed":["src/auth/magic-token.ts"]}'

$HUB post --channel '#main' --type status --author executor \
  --content "Step 2/4: POST /auth/reset endpoint implemented" \
  --metadata '{"step":2,"total_steps":4}'

$HUB post --channel '#main' --type status --author executor \
  --content "Step 3/4: GET /auth/reset/:token endpoint implemented" \
  --metadata '{"step":3,"total_steps":4}'

$HUB post --channel '#main' --type status --author executor \
  --content "Step 4/4: Tests created and passing (8/8)" \
  --metadata '{"step":4,"total_steps":4,"tests_passing":8}'
```

### Phase 4: Completion

```bash
# Orchestrator posts completion
$HUB post --channel '#main' --type status --author orchestrator \
  --content "Task complete: Magic link password reset implemented" \
  --tags '["complete"]' \
  --metadata '{"files_changed":["src/auth/magic-token.ts","src/routes/auth.ts","tests/magic-link.test.ts"]}' 

# Check final status
$HUB status --channel '#main' --verbose
```

---

## Example 2: Multi-Worker Parallel Session (v17)

Super-Orchestrator manages N workers on git worktrees.

### Phase 1: Initialization

Super-Orchestrator sets up multi-worker hub:

```bash
# Initialize multi-worker mode
$HUB init --mode multi
```

**Output:**
```json
{
  "hub_id": "660e8400-...",
  "mode": "multi-worker",
  "channels": ["#main", "#general"]
}
```

**Create worker channels and spawn workers:**

```bash
# Worker 1: B-042 (Password Reset)
git worktree add ../worktree-B042 -b feature/B-042
$HUB channel create '#worker-B042' --worker-id B042 \
  --description "Worker B042: Implement password reset"

$HUB post --channel '#general' --type status --author super-orchestrator \
  --content "Worker B042 assigned: Implement password reset" \
  --tags '["worker-start"]' \
  --metadata '{"worker_id":"B042","backlog_item":"B-042"}'

# Spawn worker (autopilot mode)
cd ../worktree-B042
copilot -p "Implement password reset per backlog item B-042" \
  --agent Orchestrator --allow-all --autopilot --no-ask-user &

# Worker 2: B-043 (Email Templates)
cd /Users/crilopez/dev/mcp/agents-hub
git worktree add ../worktree-B043 -b feature/B-043
$HUB channel create '#worker-B043' --worker-id B043 \
  --description "Worker B043: Email template system"

$HUB post --channel '#general' --type status --author super-orchestrator \
  --content "Worker B043 assigned: Email template system" \
  --tags '["worker-start"]' \
  --metadata '{"worker_id":"B043","backlog_item":"B-043"}'

cd ../worktree-B043
copilot -p "Implement email template system per backlog item B-043" \
  --agent Orchestrator --allow-all --autopilot --no-ask-user &
```

### Phase 2: Worker Execution

**Worker B042 (in its worktree):**

```bash
# Worker posts start status
$HUB post --channel '#worker-B042' --type status --author orchestrator \
  --content "Starting: Implement password reset" \
  --tags '["start"]'

# Scout explores, posts findings to worker channel
$HUB post --channel '#worker-B042' --type note --author scout \
  --content "Found: existing auth module uses JWT" \
  --tags '["finding","auth"]'

# Before implementing, search other channels for related work
$HUB search "email template" --limit 5

# Found that Worker B043 is working on email templates
# Read their notes
$HUB read --channel '#worker-B043' --type note --tags email --limit 3

# Worker proceeds with implementation
$HUB post --channel '#worker-B042' --type status --author executor \
  --content "Implementation complete: password reset flow" \
  --tags '["complete"]' \
  --metadata '{"files_changed":["src/auth/reset.ts","src/routes/auth.ts","tests/reset.test.ts"]}'
```

**Worker B043 (in parallel):**

```bash
# Worker posts start
$HUB post --channel '#worker-B043' --type status --author orchestrator \
  --content "Starting: Email template system" \
  --tags '["start"]'

# Scout finds email config
$HUB post --channel '#worker-B043' --type note --author scout \
  --content "Found: SendGrid already configured in src/email/config.ts" \
  --tags '["finding","email"]'

# Creative proposes template approach
$HUB post --channel '#worker-B043' --type decision --author creative \
  --content "Use Handlebars for email templates with i18n support" \
  --metadata '{"status":"proposed"}'

# Worker completes
$HUB post --channel '#worker-B043' --type status --author executor \
  --content "Complete: Email template system with 3 templates" \
  --tags '["complete"]' \
  --metadata '{"files_changed":["src/email/templates.ts","templates/reset.hbs","templates/welcome.hbs"]}'
```

### Phase 3: Cross-Worker Knowledge Sharing

Worker B042 discovers Worker B043's email templates:

```bash
# Worker B042 needs to send reset email
$HUB search "email template reset" --limit 5
```

**Result:**
```json
{
  "results": [
    {
      "channel": "#worker-B043",
      "content": "Complete: Email template system with 3 templates",
      "metadata": {"files_changed": ["templates/reset.hbs"]},
      "rank": -1.5
    }
  ]
}
```

Worker B042 can now reference Worker B043's template work:

```bash
# Post cross-reference note
$HUB post --channel '#worker-B042' --type note --author executor \
  --content "Using reset.hbs template from Worker B043 for password reset emails" \
  --tags '["cross-reference"]' \
  --metadata '{"references":"#worker-B043"}'
```

### Phase 4: Super-Orchestrator Monitors Completion

```bash
# Monitor for completion
$HUB read --type status --tags complete

# Check overall status
$HUB status --verbose
```

**Output:**
```json
{
  "channels": {
    "#general": {"messages": 5, "unresolved_requests": 0},
    "#worker-B042": {"messages": 28, "unresolved_requests": 0},
    "#worker-B043": {"messages": 22, "unresolved_requests": 0}
  },
  "total_messages": 55,
  "total_unresolved": 0
}
```

### Phase 5: Merge & Cleanup

```bash
# Super-Orchestrator merges completed workers
cd /Users/crilopez/dev/mcp/agents-hub

# Merge B-042
git merge feature/B-042
git worktree remove ../worktree-B042
git branch -d feature/B-042

$HUB post --channel '#general' --type status --author super-orchestrator \
  --content "Worker B042 merged successfully" \
  --metadata '{"worker_id":"B042","status":"merged"}'

# Merge B-043
git merge feature/B-043
git worktree remove ../worktree-B043
git branch -d feature/B-043

$HUB post --channel '#general' --type status --author super-orchestrator \
  --content "Worker B043 merged successfully" \
  --metadata '{"worker_id":"B043","status":"merged"}'

# Final summary
$HUB post --channel '#general' --type status --author super-orchestrator \
  --content "All workers complete. 2/2 merged successfully." \
  --tags '["session-complete"]'
```

---

## Example 3: Blocked Worker Resolution

When a worker encounters an issue it cannot resolve alone.

### Step 1: Worker Identifies Blocker

Worker B042 Executor hits a type error:

```bash
# Post blocker request
MSG_ID=$($HUB post --channel '#worker-B042' --type request --author executor \
  --content "Blocked: SharedTypes.AuthResponse type doesn't match API contract.\n\nExpected: { token: string, expiresAt: Date }\nGot: { accessToken: string, exp: number }\n\nFile: src/types/shared.ts:42" \
  --tags '["blocked","types","auth"]' \
  --metadata '{"severity":"blocker","target":"super-orchestrator","resolved":false,"request_type":"help","context":{"file":"src/types/shared.ts","line":42}}' | jq -r '.id')

echo "Posted request: $MSG_ID"
```

### Step 2: Worker Enters Wait State

```bash
# Worker watches for resolution
echo "Waiting for resolution..."
$HUB watch --channel '#worker-B042' --timeout 300
```

**Alternative:** Worker exits with code 42 (blocked), Super-Orchestrator resumes later.

### Step 3: Super-Orchestrator Detects Request

Super-Orchestrator is watching for blockers:

```bash
# Detect unresolved requests
$HUB read --type request --unresolved
```

**Output:**
```json
{
  "messages": [
    {
      "id": "msg-uuid",
      "channel": "#worker-B042",
      "type": "request",
      "content": "Blocked: SharedTypes.AuthResponse type mismatch...",
      "metadata": {
        "severity": "blocker",
        "target": "super-orchestrator",
        "resolved": false
      }
    }
  ]
}
```

### Step 4: Super-Orchestrator Investigates

```bash
# Check if other workers have relevant info
$HUB search "AuthResponse" --channel '#worker-B043'

# Read Worker B043's notes
$HUB read --channel '#worker-B043' --tags types,auth
```

**Finds:** Worker B043 updated `SharedTypes` in commit `abc123def`.

### Step 5: Super-Orchestrator Posts Resolution

```bash
# Reply with resolution
$HUB reply --thread $MSG_ID --author super-orchestrator \
  --content "## Resolution\n\nWorker B043 updated SharedTypes in commit abc123def.\n\n**Action:** Pull latest from main branch:\n\`\`\`bash\ngit pull origin main\n\`\`\`\n\nThe correct type is:\n\`\`\`typescript\n{ accessToken: string, exp: number }\n\`\`\`\n\nUpdate your code to match this signature." \
  --metadata '{"resolved":true,"commit":"abc123def"}'
```

### Step 6: Worker Resumes

Worker's watch command returns the resolution:

```json
{"id":"msg-reply-uuid","parent_id":"msg-uuid","content":"## Resolution...","metadata":{"resolved":true}}
```

Worker reads the full thread:

```bash
# Read full thread for context
$HUB read-thread $MSG_ID
```

Worker pulls latest and continues:

```bash
git pull origin main

# Post status update
$HUB post --channel '#worker-B042' --type status --author executor \
  --content "Blocker resolved. Updated types and continuing implementation." \
  --tags '["unblocked"]'
```

---

## Example 4: Scout Request via Hub

Replaces the `scout_requests` JSON pattern. Subagents request information via hub messages.

### Step 1: Executor Needs Information

Executor (inside Worker B042) needs to know the `sendEmail` function signature:

```bash
# Post scout request
REQUEST_ID=$($HUB post --channel '#worker-B042' --type request --author executor \
  --content "Need: What is the sendEmail function signature and where is it defined?" \
  --tags '["scout-request","email"]' \
  --metadata '{"request_type":"scout","severity":"major","resolved":false}' | jq -r '.id')
```

### Step 2: Orchestrator Detects and Delegates

Worker B042 Orchestrator detects the scout request:

```bash
# Read unresolved scout requests
$HUB read --channel '#worker-B042' --type request --unresolved
```

Orchestrator delegates to Scout (via `task` tool in actual implementation):

```bash
# Scout explores and posts answer
$HUB reply --thread $REQUEST_ID --author scout \
  --content "## sendEmail Function\n\n**Signature:**\n\`\`\`typescript\nsendEmail(to: string, subject: string, body: string): Promise<void>\n\`\`\`\n\n**Location:** src/email/service.ts:45-48\n\n**Usage:**\n\`\`\`typescript\nawait sendEmail('user@example.com', 'Password Reset', emailBody);\n\`\`\`" \
  --metadata '{"resolved":true,"path":"src/email/service.ts","lines":[45,48]}'
```

### Step 3: Executor Reads Answer

```bash
# Read the thread to get Scout's answer
$HUB read-thread $REQUEST_ID
```

**Output:**
```json
{
  "thread": [
    {
      "id": "request-id",
      "content": "Need: What is the sendEmail function signature...",
      "author": "executor",
      "type": "request"
    },
    {
      "id": "reply-id",
      "parent_id": "request-id",
      "content": "## sendEmail Function...",
      "author": "scout",
      "type": "note",
      "metadata": {"resolved": true, "path": "src/email/service.ts"}
    }
  ]
}
```

Executor proceeds with implementation using the signature.

---

## Example 5: Multi-Model Audit via Hub

The T3+ multi-model audit (Gemini, Opus, GPT) uses hub for coordination.

### Step 1: Orchestrator Prepares Audit

```bash
# Post audit request
AUDIT_ID=$($HUB post --channel '#main' --type request --author orchestrator \
  --content "Multi-model audit: Review implementation of password reset flow" \
  --tags '["audit","verification"]' \
  --metadata '{"request_type":"review","models":["gemini-3-pro-preview","claude-opus-4.6","gpt-5.3-codex"],"files":["src/auth/reset.ts","src/routes/auth.ts","tests/reset.test.ts"]}' | jq -r '.id')
```

### Step 2: Three Verifier Instances Post Reviews

**Gemini Review:**
```bash
$HUB reply --thread $AUDIT_ID --author verifier \
  --content "## Gemini Review\n\n**Verdict:** Revision Required\n\n**Issues Found:** 2\n\n1. **Security:** Token should expire after use (missing one-time-use check)\n2. **Validation:** Missing email format validation before sending reset link\n\n**Recommendation:** Add token invalidation after successful reset." \
  --metadata '{"model":"gemini-3-pro-preview","verdict":"revision_required","issues_count":2}'
```

**Opus Review:**
```bash
$HUB reply --thread $AUDIT_ID --author verifier \
  --content "## Opus Review\n\n**Verdict:** Approved with Notes\n\n**Issues Found:** 1\n\n1. **Minor:** Consider rate limiting on reset endpoint to prevent abuse\n\n**Strengths:**\n- Good test coverage (8/8 tests)\n- Proper error handling\n- Secure token generation\n\n**Recommendation:** Approve, but add rate limiting in follow-up." \
  --metadata '{"model":"claude-opus-4.6","verdict":"approved_with_notes","issues_count":1}'
```

**GPT Review:**
```bash
$HUB reply --thread $AUDIT_ID --author verifier \
  --content "## GPT Review\n\n**Verdict:** Approved\n\n**Issues Found:** 0\n\n**Strengths:**\n- Cryptographically secure token generation\n- Proper async/await usage\n- Comprehensive test coverage\n- Good error messages\n\n**Recommendation:** Approve as-is." \
  --metadata '{"model":"gpt-5.3-codex","verdict":"approved","issues_count":0}'
```

### Step 3: Orchestrator Reconciles Reviews

```bash
# Read all reviews in thread
$HUB read-thread $AUDIT_ID
```

**Orchestrator analysis:**

```json
{
  "consensus_issues": [
    {
      "issue": "Token should expire after use",
      "models": ["gemini-3-pro-preview"],
      "severity": "high"
    }
  ],
  "unique_insights": [
    {
      "insight": "Rate limiting suggestion",
      "models": ["claude-opus-4.6"],
      "severity": "low"
    },
    {
      "insight": "Email format validation missing",
      "models": ["gemini-3-pro-preview"],
      "severity": "medium"
    }
  ],
  "verdict_summary": {
    "approved": 1,
    "approved_with_notes": 1,
    "revision_required": 1
  },
  "recommendation": "Revise: Fix token one-time-use issue, then proceed"
}
```

**Orchestrator posts synthesis:**
```bash
$HUB reply --thread $AUDIT_ID --author orchestrator \
  --content "## Multi-Model Audit Summary\n\n**Verdict:** Revision Required (2/3 models flagged issues)\n\n**Critical Issue:**\n- Token should be invalidated after use (Gemini)\n\n**Follow-Up Items:**\n- Add email format validation (Gemini)\n- Consider rate limiting in next iteration (Opus)\n\n**Action:** Executor to fix token invalidation, then re-verify." \
  --metadata '{"final_verdict":"revision_required","critical_issues":1,"follow_up_items":2}'
```

---

## Example 6: Checkpoint & Recovery

For long-running sessions, agents periodically checkpoint progress.

### Checkpoint Creation

Orchestrator posts checkpoint every 15 turns:

```bash
# Checkpoint 1 (turn 15)
$HUB post --channel '#main' --type note --author orchestrator \
  --content "## Checkpoint 1\n\n### Done\n- Token generator implemented\n- POST /auth/reset endpoint created\n\n### Remaining\n- GET /auth/reset/:token endpoint\n- Tests\n- Integration with email service\n\n### Context\n- Using crypto.randomBytes for tokens\n- SendGrid configured for email\n- User.email is nullable (handle legacy data)" \
  --tags '["checkpoint"]' \
  --metadata '{"checkpoint_number":1,"turn":15,"steps_completed":2,"total_steps":4}'

# Checkpoint 2 (turn 30)
$HUB post --channel '#main' --type note --author orchestrator \
  --content "## Checkpoint 2\n\n### Done\n- All endpoints implemented\n- Token generation and verification working\n- Email integration complete\n\n### Remaining\n- Write tests\n- Handle edge cases (expired tokens, invalid emails)\n\n### Recent Decision\n- D-1: Use 24-hour token expiration" \
  --tags '["checkpoint"]' \
  --metadata '{"checkpoint_number":2,"turn":30,"steps_completed":3,"total_steps":4}'
```

### Recovery from Checkpoint

If session crashes and is resumed:

```bash
# Read last checkpoint
$HUB read --channel '#main' --tags checkpoint --limit 1
```

**Output:**
```json
{
  "messages": [
    {
      "content": "## Checkpoint 2...",
      "metadata": {
        "checkpoint_number": 2,
        "turn": 30,
        "steps_completed": 3,
        "total_steps": 4
      },
      "created_at": "2026-02-21T17:15:00Z"
    }
  ]
}
```

**Read all activity since checkpoint:**
```bash
# Get checkpoint timestamp
CHECKPOINT_TIME="2026-02-21T17:15:00Z"

# Read status messages since checkpoint
$HUB read --channel '#main' --type status --since $CHECKPOINT_TIME
```

**Reconstruct state:**

- Last checkpoint: 3/4 steps done
- Status messages since: 1 more step completed
- Current state: 4/4 steps done, tests passing
- Action: Run final verification and complete

---

## Example 7: Combined Multi-Worker with Blockers

Real-world scenario: Worker B042 blocked, Worker B043 has the answer.

### Setup

```bash
# Multi-worker hub
$HUB init --mode multi

# Two workers running in parallel
$HUB channel create '#worker-B042' --worker-id B042
$HUB channel create '#worker-B043' --worker-id B043
```

### Worker B042 Gets Blocked

```bash
# Worker B042 needs auth token format
BLOCK_ID=$($HUB post --channel '#worker-B042' --type request --author executor \
  --content "Blocked: Need JWT token payload structure for password reset" \
  --tags '["blocked","auth","jwt"]' \
  --metadata '{"severity":"blocker","target":"super-orchestrator","resolved":false}' | jq -r '.id')

# Worker B042 watches for resolution
$HUB watch --channel '#worker-B042' --timeout 300 &
WATCH_PID=$!
```

### Super-Orchestrator Searches Other Workers

```bash
# Search for JWT info across all channels
$HUB search "JWT token payload" --limit 10
```

**Finds:** Worker B043 documented JWT structure 20 minutes ago.

```bash
# Read Worker B043's relevant notes
$HUB read --channel '#worker-B043' --tags jwt,auth
```

**Output:**
```json
{
  "messages": [
    {
      "content": "JWT payload structure: { userId: string, email: string, type: 'reset'|'auth', exp: number }",
      "author": "scout",
      "channel": "#worker-B043",
      "tags": ["finding", "jwt", "auth"]
    }
  ]
}
```

### Super-Orchestrator Posts Resolution

```bash
# Post resolution to Worker B042
$HUB reply --thread $BLOCK_ID --author super-orchestrator \
  --content "## Resolution\n\nWorker B043 documented JWT structure:\n\n\`\`\`typescript\n{ userId: string, email: string, type: 'reset'|'auth', exp: number }\n\`\`\`\n\nFor password reset, use:\n\`\`\`typescript\nconst payload = {\n  userId: user.id,\n  email: user.email,\n  type: 'reset',\n  exp: Math.floor(Date.now() / 1000) + (24 * 60 * 60)\n};\n\`\`\`" \
  --metadata '{"resolved":true,"source":"#worker-B043"}'
```

### Worker B042 Resumes

Worker B042's watch receives the resolution and continues:

```bash
# Kill watch process (resolution received)
kill $WATCH_PID

# Read full resolution
$HUB read-thread $BLOCK_ID

# Post status update
$HUB post --channel '#worker-B042' --type status --author executor \
  --content "Blocker resolved. Implementing JWT payload per Worker B043's structure." \
  --tags '["unblocked"]'
```

### Cross-Reference Note

```bash
# Worker B042 posts cross-reference for future sessions
$HUB post --channel '#worker-B042' --type note --author executor \
  --content "Using JWT payload structure from Worker B043. Thanks for the documentation!" \
  --tags '["cross-reference","jwt"]' \
  --metadata '{"references":"#worker-B043"}'
```

---

## Best Practices Summary

### 1. Use Channels Effectively
- **Single-worker:** Use `#main` for simplicity
- **Multi-worker:** Create dedicated `#worker-{id}` channels per worker
- **Cross-worker:** Search other channels before duplicating work

### 2. Tag Consistently
Common tags: `finding`, `blocked`, `auth`, `security`, `complete`, `checkpoint`, `cross-reference`

### 3. Set Severity Appropriately
- `info` — FYI only
- `minor` — Could use help
- `major` — Slowing progress
- `blocker` — Cannot proceed

### 4. Search Before Posting
Avoid duplicate work by searching for existing findings:
```bash
$HUB search "auth bcrypt" --limit 5
```

### 5. Use Threads for Conversations
Keep related messages together:
```bash
# Request
MSG_ID=$($HUB post --type request ... | jq -r '.id')

# Reply
$HUB reply --thread $MSG_ID --content "..."
```

### 6. Checkpoint Long Sessions
Every 15 turns, post checkpoint with done/remaining:
```bash
$HUB post --type note --tags '["checkpoint"]' --content "..."
```

### 7. Export for Analysis
```bash
# Export channel history
$HUB export --channel '#worker-B042' > worker-B042-history.ndjson

# Analyze offline
jq 'select(.type == "request")' worker-B042-history.ndjson
```

### 8. Watch for Real-Time Coordination
```bash
# Blocked worker watches for resolution
$HUB watch --channel '#worker-B042' --timeout 300

# Super-Orchestrator watches for blockers
$HUB watch --type request --timeout 0  # Wait indefinitely
```
