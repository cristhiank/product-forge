# agents-hub — Protocols & Workflows

## Overview

This document defines the communication protocols that agents follow when using the hub. These protocols are referenced by agent prompts and the constitution.

---

## Protocol 1: Single-Worker Session (v16 compatible)

The simplest mode. One Orchestrator + its subagents share a single `#main` channel.

```
Session Start:
  Orchestrator → hub init --mode single
  → Creates hub.db with #main channel

Exploration:
  Orchestrator → delegates to Scout
  Scout → hub post --channel '#main' --type note --author scout \
    --content "Found: auth uses bcrypt" --tags '["finding","auth"]'

Planning:
  Orchestrator → delegates to Creative
  Creative → hub post --channel '#main' --type decision --author creative \
    --content "Use token-based reset flow" --metadata '{"status":"proposed"}'
  Orchestrator → hub reply --thread <decision-id> --author orchestrator \
    --content "Approved" --metadata '{"status":"approved"}'

Execution:
  Orchestrator → delegates to Executor
  Executor → hub post --channel '#main' --type status --author executor \
    --content "Step 1/3: token generator created" --metadata '{"step":1,"total_steps":3}'

Completion:
  Orchestrator → hub post --channel '#main' --type status --author orchestrator \
    --content "Task complete" --tags '["complete"]'
```

---

## Protocol 2: Multi-Worker Parallel Session (v17)

Super-Orchestrator manages N workers on git worktrees.

### Phase 1: Initialization

```
Super-Orchestrator:
  1. hub init --mode multi
  2. Read backlog → identify parallel-safe items
  3. Propose items to user → user confirms
  4. For each confirmed item:
     a. git worktree add ../worktree-B042 -b feature/B-042
     b. hub channel create '#worker-B042' --worker-id B042
     c. hub post --channel '#general' --type status --author super-orchestrator \
        --content "Worker B042 assigned: Implement password reset"
     d. Spawn: copilot -p "..." --agent Orchestrator --allow-all --autopilot --no-ask-user
```

### Phase 2: Worker Execution

Each worker Orchestrator operates independently in its worktree:

```
Worker B042 Orchestrator:
  1. hub post --channel '#worker-B042' --type status --author orchestrator \
     --content "Starting: Implement password reset" --tags '["start"]'
  
  2. [Normal v16 workflow on #worker-B042 channel]
     Scout posts notes, Creative posts decisions, Executor posts status updates
  
  3. Before Scout explores, check other channels:
     hub search "auth" --limit 5
     → May find relevant notes from #worker-B043
  
  4. hub post --channel '#worker-B042' --type status --author orchestrator \
     --content "Complete: password reset implemented" --tags '["complete"]' \
     --metadata '{"files_changed":["src/auth/reset.ts","src/email/templates.ts"]}'
```

### Phase 3: Cross-Worker Knowledge Sharing

Workers passively learn from each other by reading other channels:

```
Worker B043 (implementing email service):
  # Before implementing email templates, check if anyone else has relevant context
  hub search "email template" --limit 5
  
  # Found: Worker B042 already created email templates for password reset
  # Read their notes for implementation patterns
  hub read --channel '#worker-B042' --tags snippet,email --limit 3
```

### Phase 4: Merge & Completion

```
Super-Orchestrator:
  # Monitor for completion
  hub read --type status --tags complete

  # For each completed worker:
  1. cd main-dir
  2. git merge feature/B-042
     - If clean → success
     - If trivial conflict → auto-resolve
     - If complex → hub post --channel '#general' --type request \
       --author super-orchestrator --content "Merge conflict needs user resolution" \
       --metadata '{"target":"user","severity":"blocker"}'
  3. git worktree remove ../worktree-B042
  4. git branch -d feature/B-042
  5. hub post --channel '#general' --type status --author super-orchestrator \
     --content "Worker B042 merged successfully"
  
  # Final summary
  hub post --channel '#general' --type status --author super-orchestrator \
    --content "All workers complete. 3/3 merged." --tags '["session-complete"]'
```

---

## Protocol 3: Blocked Worker Resolution

When a worker encounters an issue it cannot resolve alone.

### Severity Levels

| Severity | Action | Who resolves |
|----------|--------|--------------|
| `info` | FYI, no action needed | No one (informational) |
| `minor` | Could use help, not blocking | Super-Orch when convenient |
| `major` | Slowing progress significantly | Super-Orch ASAP |
| `blocker` | Cannot proceed | Super-Orch immediately |

### Flow

```
Step 1: Worker identifies blocker
  Worker B042 Executor hits a type error from a shared module.

Step 2: Worker posts request
  hub post --channel '#worker-B042' --type request --author executor \
    --content "Blocked: SharedTypes.AuthResponse type doesn't match API contract. \
    Expected { token: string, expiresAt: Date } but got { accessToken: string, exp: number }." \
    --tags '["blocked","types","auth"]' \
    --metadata '{"severity":"blocker","target":"super-orchestrator","resolved":false, \
      "request_type":"help","context":{"file":"src/types/shared.ts","line":42}}'

Step 3: Worker enters wait state
  # Option A: Watch for resolution (worker stays alive)
  hub watch --channel '#worker-B042' --timeout 300
  
  # Option B: Exit with code 42 (worker hands off)
  # The worker process exits, Super-Orch resumes later

Step 4: Super-Orchestrator detects request
  # Polling unresolved requests
  hub read --type request --unresolved
  
  # Or watching for requests
  hub watch --type request --channel '#general'

Step 5: Super-Orchestrator resolves
  # May: check other workers' channels, ask user, run Scout, etc.
  
  # Check if Worker B043 has relevant info
  hub search "AuthResponse" --channel '#worker-B043'
  
  # Post resolution
  hub reply --thread <request-id> --author super-orchestrator \
    --content "Resolution: Worker B043 updated SharedTypes in commit abc123. \
    Pull latest from main: git pull origin main. The correct type is \
    { accessToken: string, exp: number } — update your code to match." \
    --metadata '{"resolved":true}'

Step 6: Worker resumes
  # Worker's watch unblocks, reads resolution, adapts implementation.
```

### Escalation Path

```
Worker blocked → 60s timeout → Super-Orch attempts resolution
  → Success → Worker continues
  → Failure → Super-Orch asks user
    → User provides answer → hub reply → Worker continues
    → User says "skip" → Worker marks task as partial, exits
```

---

## Protocol 4: Scout Request via Hub

Replaces the `scout_requests` JSON pattern from v15/v16. Now uses hub messages.

```
Step 1: Subagent needs information
  Executor (inside Worker B042):
    hub post --channel '#worker-B042' --type request --author executor \
      --content "Need: what is the sendEmail function signature?" \
      --tags '["scout-request"]' \
      --metadata '{"request_type":"scout","severity":"major"}'

Step 2: Orchestrator detects and delegates to Scout
  Worker B042 Orchestrator sees the request:
    hub read --channel '#worker-B042' --type request --unresolved
  
  Delegates to Scout → Scout explores → Scout posts answer:
    hub reply --thread <request-id> --author scout \
      --content "sendEmail(to: string, subject: string, body: string): Promise<void>" \
      --metadata '{"resolved":true,"path":"src/email/service.ts","lines":[45,48]}'

Step 3: Executor reads the thread
  hub read-thread <request-id>
  → Gets the full thread with question + answer
```

---

## Protocol 5: Multi-Model Audit via Hub

The T3+ multi-model audit (Gemini, Opus, GPT) now uses hub channels.

```
Step 1: Orchestrator prepares audit
  hub post --channel '#main' --type request --author orchestrator \
    --content "Multi-model audit: review implementation of password reset" \
    --tags '["audit"]' \
    --metadata '{"request_type":"review","models":["gemini-3-pro","claude-opus-4.6","gpt-5.3-codex"]}'

Step 2: Three parallel Verifier instances post to the same thread
  # Gemini
  hub reply --thread <audit-id> --author verifier \
    --content "Gemini review: 2 issues found..." \
    --metadata '{"model":"gemini-3-pro","verdict":"revision_required"}'
  
  # Opus
  hub reply --thread <audit-id> --author verifier \
    --content "Opus review: 1 issue found..." \
    --metadata '{"model":"claude-opus-4.6","verdict":"approved_with_notes"}'
  
  # GPT
  hub reply --thread <audit-id> --author verifier \
    --content "GPT review: approved, no issues..." \
    --metadata '{"model":"gpt-5.3-codex","verdict":"approved"}'

Step 3: Orchestrator reads the thread and reconciles
  hub read-thread <audit-id>
  → All 3 reviews in one thread
  → Orchestrator identifies consensus issues, unique insights
```

---

## Protocol 6: Checkpoint & Recovery

For long-running sessions, agents periodically checkpoint progress.

```
Every N turns (configurable, default 15):
  Orchestrator posts a checkpoint note:
    hub post --channel '#main' --type note --author orchestrator \
      --content "## Checkpoint 2\n\n### Done\n- Token generator\n- Email service\n\n### Remaining\n- Wire up endpoint\n- Add tests" \
      --tags '["checkpoint"]' \
      --metadata '{"checkpoint_number":2,"turn":30}'
```

If a session crashes and is resumed:
```
  # Read last checkpoint
  hub read --channel '#main' --tags checkpoint --limit 1
  
  # Read all status messages since checkpoint
  hub read --channel '#main' --type status --since <checkpoint-timestamp>
  
  # Reconstruct what was done and what remains
```
