# Agents Board API Reference

Complete CLI and exec mode documentation for the agents-board skill.

## CLI Entry Point

```bash
node scripts/board.js <command> [options]
```

All commands return JSON to stdout:
- Success: `{ "result": <data> }`
- Error: `{ "error": "<message>" }`

**Note:** The board is agent-flow-agnostic. The `--agent` flag accepts any role name you define to match your multi-agent architecture.

---

## Global Flags

All commands require:
- `--task-id <id>` — Task identifier (e.g., `T-1`)
- `--path <directory>` — Workspace root path

---

## Task Management Commands

### create-task

Create a new task and initialize the board.

```bash
node scripts/board.js create-task \
  --goal "Implement magic link authentication" \
  --context "User wants passwordless login" \
  --constraints '["Must use existing email service", "No external auth providers"]' \
  --path /workspace
```

**Parameters:**
- `--goal <text>` (required) — Main objective of the task
- `--context <text>` (optional) — Additional background information
- `--constraints <json-array>` (optional) — List of constraints as JSON array

**Returns:**
```json
{
  "result": {
    "task_id": "T-1",
    "status": "setup",
    "created_at": "2024-01-15T10:30:00Z"
  }
}
```

---

### list-tasks

List all tasks in the workspace.

```bash
node scripts/board.js list-tasks --path /workspace
```

**Returns:**
```json
{
  "result": [
    {
      "task_id": "T-1",
      "goal": "Implement magic link authentication",
      "status": "execution",
      "created_at": "2024-01-15T10:30:00Z"
    }
  ]
}
```

---

### archive-task

Archive a completed or cancelled task.

```bash
node scripts/board.js archive-task \
  --task-id T-1 \
  --path /workspace
```

**Parameters:**
- `--task-id <id>` (required) — Task to archive

**Returns:**
```json
{
  "result": {
    "task_id": "T-1",
    "archived": true,
    "archived_at": "2024-01-15T12:00:00Z"
  }
}
```

---

### view

Get quick board status overview (~100 tokens).

```bash
node scripts/board.js view \
  --task-id T-1 \
  --path /workspace
```

**Returns:**
```json
{
  "result": {
    "task_id": "T-1",
    "status": "execution",
    "phase": "execution",
    "facts_count": 12,
    "snippets_count": 8,
    "decisions_count": 3,
    "alerts_count": 0,
    "current_step": 2,
    "total_steps": 4
  }
}
```

---

## Facts Management

### add-fact

Add a new fact discovered during exploration or execution.

```bash
node scripts/board.js add-fact \
  --task-id T-1 \
  --agent researcher \
  --content "Codebase uses Express 4.18.2 for HTTP routing" \
  --confidence high \
  --evidence '[{"type":"file","reference":"package.json#L12","excerpt":"express: 4.18.2"}]' \
  --tags "dependency,http,routing" \
  --path /workspace
```

**Parameters:**
- `--agent <role>` (required) — Any agent role name (e.g., researcher, implementer, reviewer)
- `--content <text>` (required) — The fact statement
- `--confidence <level>` (required) — high | medium | low
- `--evidence <json-array>` (required) — Array of evidence objects
- `--tags <comma-sep>` (optional) — Comma-separated tags

**Evidence object structure:**
```json
{
  "type": "file" | "snippet" | "test" | "external",
  "reference": "path/to/file.js#L10-L20",
  "excerpt": "relevant code or text"
}
```

**Returns:**
```json
{
  "result": {
    "fact_id": "F-1",
    "created_at": "2024-01-15T10:35:00Z"
  }
}
```

---

### get-facts

Retrieve facts with optional filtering.

```bash
node scripts/board.js get-facts \
  --task-id T-1 \
  --confidence high \
  --agent researcher \
  --path /workspace
```

**Parameters:**
- `--confidence <level>` (optional) — Filter by confidence level
- `--agent <role>` (optional) — Filter by agent that created the fact

**Returns:**
```json
{
  "result": [
    {
      "fact_id": "F-1",
      "content": "Codebase uses Express 4.18.2 for HTTP routing",
      "confidence": "high",
      "created_by": "researcher",
      "evidence": [...],
      "tags": ["dependency", "http", "routing"],
      "verified": false
    }
  ]
}
```

---

### verify-fact

A reviewing agent validates or disputes a fact.

```bash
node scripts/board.js verify-fact \
  --task-id T-1 \
  --agent reviewer \
  --fact-id F-1 \
  --status confirmed \
  --verification-notes "Verified in package.json and node_modules" \
  --path /workspace
```

**Parameters:**
- `--fact-id <id>` (required) — Fact to verify
- `--status <status>` (required) — confirmed | disputed | needs_review
- `--verification-notes <text>` (optional) — Verification details

**Returns:**
```json
{
  "result": {
    "fact_id": "F-1",
    "verified": true,
    "verified_by": "reviewer",
    "verified_at": "2024-01-15T11:00:00Z"
  }
}
```

---

## Snippets Management

### add-snippet

Cache file content for reuse across agents.

```bash
node scripts/board.js add-snippet \
  --task-id T-1 \
  --agent researcher \
  --path src/auth/routes.ts \
  --lines '{"start":1,"end":45}' \
  --content "$(cat src/auth/routes.ts | head -45)" \
  --purpose "Authentication routes implementation" \
  --tags "auth,routes,target" \
  --path /workspace
```

**Parameters:**
- `--agent <role>` (required) — Any agent role name
- `--path <file-path>` (required) — Relative path from workspace root
- `--lines <json>` (required) — `{"start": N, "end": M}` object
- `--content <text>` (required) — Actual file content
- `--purpose <text>` (required) — Why this snippet is relevant
- `--tags <comma-sep>` (optional) — Comma-separated tags

**Returns:**
```json
{
  "result": {
    "snippet_id": "X-1",
    "path": "src/auth/routes.ts",
    "created_at": "2024-01-15T10:40:00Z"
  }
}
```

---

### get-snippets

Retrieve cached snippets with optional filtering.

```bash
node scripts/board.js get-snippets \
  --task-id T-1 \
  --path src/auth/routes.ts \
  --tags auth,target \
  --path /workspace
```

**Parameters:**
- `--path <file-path>` (optional) — Filter by file path
- `--tags <comma-sep>` (optional) — Filter by tags (OR logic)

**Returns:**
```json
{
  "result": [
    {
      "snippet_id": "X-1",
      "path": "src/auth/routes.ts",
      "lines": {"start": 1, "end": 45},
      "content": "...",
      "purpose": "Authentication routes implementation",
      "tags": ["auth", "routes", "target"],
      "created_by": "researcher",
      "created_at": "2024-01-15T10:40:00Z"
    }
  ]
}
```

---

## Decision Management

### propose-decision

Any agent can propose architectural decisions.

```bash
node scripts/board.js propose-decision \
  --task-id T-1 \
  --agent planner \
  --title "Use JWT for magic link tokens" \
  --description "Encode user_id + expiry in JWT signed with secret" \
  --rationale "Self-contained, no DB lookup needed, automatic expiry" \
  --alternatives '[{"title":"UUID in database","pros":"Revocable","cons":"DB lookup overhead"}]' \
  --tags "auth,security,token" \
  --path /workspace
```

**Parameters:**
- `--agent <role>` (required) — Any agent role name
- `--title <text>` (required) — Decision title
- `--description <text>` (required) — What is being decided
- `--rationale <text>` (required) — Why this choice
- `--alternatives <json-array>` (optional) — Other options considered
- `--tags <comma-sep>` (optional) — Tags

**Alternative object structure:**
```json
{
  "title": "Option name",
  "pros": "Benefits",
  "cons": "Drawbacks"
}
```

**Returns:**
```json
{
  "result": {
    "decision_id": "D-1",
    "status": "proposed",
    "created_at": "2024-01-15T10:50:00Z"
  }
}
```

---

### approve-decision

A coordinating agent approves a proposed decision.

```bash
node scripts/board.js approve-decision \
  --task-id T-1 \
  --agent coordinator \
  --decision-id D-1 \
  --notes "Approved - aligns with existing auth patterns" \
  --path /workspace
```

**Parameters:**
- `--decision-id <id>` (required) — Decision to approve
- `--notes <text>` (optional) — Approval notes

**Returns:**
```json
{
  "result": {
    "decision_id": "D-1",
    "status": "approved",
    "approved_by": "coordinator",
    "approved_at": "2024-01-15T11:00:00Z"
  }
}
```

---

### reject-decision

Reject a proposed decision with reason.

```bash
node scripts/board.js reject-decision \
  --task-id T-1 \
  --agent coordinator \
  --decision-id D-1 \
  --reason "JWT cannot be revoked - conflicts with security requirements" \
  --path /workspace
```

**Parameters:**
- `--decision-id <id>` (required) — Decision to reject
- `--reason <text>` (required) — Why rejected

**Returns:**
```json
{
  "result": {
    "decision_id": "D-1",
    "status": "rejected",
    "rejected_at": "2024-01-15T11:00:00Z"
  }
}
```

---

## Plan Management

### set-plan

A coordinating agent creates an execution plan.

```bash
node scripts/board.js set-plan \
  --task-id T-1 \
  --agent coordinator \
  --goal "Implement magic link authentication" \
  --approach "Add token generation, email sending, and verification endpoints" \
  --steps '[
    {
      "title": "Create token generator",
      "description": "Implement crypto-based token generation in src/auth/token.ts",
      "done_when": ["Function generateMagicToken() exists", "Returns 64-char hex string", "Unit tests pass"],
      "files": ["src/auth/token.ts", "tests/auth/token.test.ts"]
    },
    {
      "title": "Add POST /auth/magic endpoint",
      "description": "Accept email, generate token, send link",
      "done_when": ["Endpoint returns 200", "Email sent via SendGrid", "Token stored in Redis"],
      "files": ["src/routes/auth.ts", "src/services/email.ts"]
    }
  ]' \
  --path /workspace
```

**Parameters:**
- `--goal <text>` (required) — Plan goal (matches task goal)
- `--approach <text>` (required) — High-level approach
- `--steps <json-array>` (required) — Array of step objects

**Step object structure:**
```json
{
  "title": "Step title",
  "description": "What to do",
  "done_when": ["Criteria 1", "Criteria 2"],
  "files": ["file1.ts", "file2.ts"]
}
```

**Returns:**
```json
{
  "result": {
    "plan_id": "P-1",
    "total_steps": 2,
    "current_step": 0,
    "created_at": "2024-01-15T11:10:00Z"
  }
}
```

---

### get-plan

Retrieve current execution plan.

```bash
node scripts/board.js get-plan \
  --task-id T-1 \
  --path /workspace
```

**Returns:**
```json
{
  "result": {
    "plan_id": "P-1",
    "goal": "Implement magic link authentication",
    "approach": "Add token generation, email sending, and verification endpoints",
    "steps": [
      {
        "step_number": 1,
        "title": "Create token generator",
        "description": "...",
        "done_when": ["..."],
        "files": ["..."],
        "status": "completed"
      },
      {
        "step_number": 2,
        "title": "Add POST /auth/magic endpoint",
        "status": "in_progress"
      }
    ],
    "current_step": 2,
    "total_steps": 2
  }
}
```

---

### advance-step

An implementing agent moves to the next plan step.

```bash
node scripts/board.js advance-step \
  --task-id T-1 \
  --agent implementer \
  --path /workspace
```

**Returns:**
```json
{
  "result": {
    "current_step": 2,
    "total_steps": 4,
    "step_title": "Add POST /auth/magic endpoint"
  }
}
```

---

### complete-step

An implementing agent marks current step as completed.

```bash
node scripts/board.js complete-step \
  --task-id T-1 \
  --agent implementer \
  --notes "All tests passing, snippet X-5 updated" \
  --path /workspace
```

**Parameters:**
- `--notes <text>` (optional) — Completion notes

**Returns:**
```json
{
  "result": {
    "step_number": 1,
    "status": "completed",
    "completed_at": "2024-01-15T11:30:00Z"
  }
}
```

---

### fail-step

An implementing agent marks current step as failed (escalation needed).

```bash
node scripts/board.js fail-step \
  --task-id T-1 \
  --agent implementer \
  --reason "Build error - missing dependency 'rate-limiter-flexible'" \
  --path /workspace
```

**Parameters:**
- `--reason <text>` (required) — Why step failed

**Returns:**
```json
{
  "result": {
    "step_number": 1,
    "status": "failed",
    "failed_at": "2024-01-15T11:25:00Z",
    "reason": "Build error - missing dependency 'rate-limiter-flexible'"
  }
}
```

---

## Alerts Management

### raise-alert

Any agent can raise alerts for blockers, warnings, or info.

```bash
node scripts/board.js raise-alert \
  --task-id T-1 \
  --agent implementer \
  --severity blocker \
  --title "Missing dependency prevents build" \
  --description "Package 'rate-limiter-flexible' required but not in package.json\n\nOptions:\n1. npm install rate-limiter-flexible\n2. Use alternative rate limiting" \
  --tags "dependency,blocker" \
  --path /workspace
```

**Parameters:**
- `--agent <role>` (required) — Agent raising the alert
- `--severity <level>` (required) — blocker | warning | info
- `--title <text>` (required) — Alert title
- `--description <text>` (required) — Detailed description with context
- `--tags <comma-sep>` (optional) — Tags

**Returns:**
```json
{
  "result": {
    "alert_id": "A-1",
    "severity": "blocker",
    "status": "active",
    "created_at": "2024-01-15T11:25:00Z"
  }
}
```

---

### resolve-alert

Mark alert as resolved.

```bash
node scripts/board.js resolve-alert \
  --task-id T-1 \
  --agent coordinator \
  --alert-id A-1 \
  --resolution "User approved npm install rate-limiter-flexible" \
  --path /workspace
```

**Parameters:**
- `--alert-id <id>` (required) — Alert to resolve
- `--resolution <text>` (required) — How it was resolved

**Returns:**
```json
{
  "result": {
    "alert_id": "A-1",
    "status": "resolved",
    "resolved_at": "2024-01-15T11:30:00Z"
  }
}
```

---

## Trail Management

### append-trail

Any agent logs decisions, bug fixes, patterns, insights.

```bash
node scripts/board.js append-trail \
  --task-id T-1 \
  --agent implementer \
  --marker DECISION \
  --summary "Used crypto.randomBytes for token generation" \
  --details '{"context":"Magic link security","options":["uuid v4","crypto.randomBytes","nanoid"],"choice":"crypto.randomBytes(32)","rationale":"Cryptographically secure, no external dependency"}' \
  --evidence '["X-1#L45-50","F-3"]' \
  --path /workspace
```

**Parameters:**
- `--marker <type>` (required) — DECISION | BUG_FIX | PATTERN | WORKAROUND | INSIGHT
- `--summary <text>` (required) — One-line summary
- `--details <text>` (optional) — JSON object with context, options, choice, rationale
- `--evidence <json-array>` (optional) — References to snippets/facts

**Returns:**
```json
{
  "result": {
    "trail_id": "TR-1",
    "marker": "DECISION",
    "created_at": "2024-01-15T11:40:00Z"
  }
}
```

---

### get-trails

Retrieve execution trail logs.

```bash
node scripts/board.js get-trails \
  --task-id T-1 \
  --path /workspace
```

**Returns:**
```json
{
  "result": [
    {
      "trail_id": "TR-1",
      "marker": "DECISION",
      "summary": "Used crypto.randomBytes for token generation",
      "details": {...},
      "evidence": ["X-1#L45-50", "F-3"],
      "created_by": "implementer",
      "created_at": "2024-01-15T11:40:00Z"
    }
  ]
}
```

---

## Search

### search

Full-text search across all board entities (FTS5 with BM25 ranking).

```bash
node scripts/board.js search "authentication token" \
  --task-id T-1 \
  --types facts,snippets,decisions \
  --tags auth,security \
  --limit 10 \
  --path /workspace
```

**Parameters:**
- `<query>` (positional, required) — Search keywords
- `--types <comma-sep>` (optional) — Filter by entity types
- `--tags <comma-sep>` (optional) — Filter by tags
- `--limit <n>` (optional) — Max results (default: 20)

**Entity types:**
- `facts`, `snippets`, `decisions`, `alerts`, `trails`, `steps`

**Returns:**
```json
{
  "result": [
    {
      "type": "fact",
      "id": "F-3",
      "content": "JWT tokens used for authentication",
      "rank": 0.95,
      "highlights": ["authentication <b>token</b>"]
    },
    {
      "type": "snippet",
      "id": "X-1",
      "path": "src/auth/token.ts",
      "purpose": "Token generation logic",
      "rank": 0.87
    }
  ]
}
```

---

## Constraints Management

### add-constraint

Add a new constraint to the task.

```bash
node scripts/board.js add-constraint \
  --task-id T-1 \
  --agent coordinator \
  --content "Must not modify existing authentication logic" \
  --priority must \
  --classification non_functional \
  --path /workspace
```

**Parameters:**
- `--content <text>` (required) — Constraint description
- `--priority <level>` (required) — must | should | nice_to_have
- `--classification <type>` (optional) — functional | non_functional | security | performance | compatibility

**Returns:**
```json
{
  "result": {
    "constraint_id": "C-1",
    "created_at": "2024-01-15T10:32:00Z"
  }
}
```

---

## Exec Mode (JavaScript Code Execution)

Execute arbitrary JavaScript code with full board API access.

### Usage

```bash
node scripts/board.js exec \
  --task-id T-1 \
  --agent coordinator \
  --code '<javascript-code>' \
  --path /workspace
```

The `board` object is injected with all API methods. Any agent role name can be used with the `--agent` flag.

### Available Board Methods

All methods from the CLI are available as `board.<method>()`:

- `board.getFacts({ confidence: ["high"], agent: "researcher" })`
- `board.getSnippets({ path: "src/auth.ts", tags: ["target"] })`
- `board.getPlan()`
- `board.getAlerts({ severity: "blocker", status: "active" })`
- `board.getTrails()`
- `board.search({ text: "auth", types: ["facts", "snippets"], limit: 5 })`
- `board.view()` — returns status object

### Example 1: Query and Filter

```bash
node scripts/board.js exec \
  --task-id T-1 \
  --agent researcher \
  --code '
    const facts = board.getFacts({ confidence: ["high"] });
    const authFacts = facts.filter(f => f.tags?.includes("auth"));
    return {
      total_facts: facts.length,
      auth_facts: authFacts.length,
      auth_fact_ids: authFacts.map(f => f.fact_id)
    };
  ' \
  --path /workspace
```

### Example 2: Board Status

```bash
node scripts/board.js exec \
  --task-id T-1 \
  --agent coordinator \
  --code '
    const status = board.view();
    const plan = board.getPlan();
    const alerts = board.getAlerts({ status: "active" });
    
    return {
      phase: status.phase,
      current_step: plan?.current_step,
      total_steps: plan?.total_steps,
      active_alerts: alerts.length,
      blocker_alerts: alerts.filter(a => a.severity === "blocker").length
    };
  ' \
  --path /workspace
```

### Example 3: Multi-Entity Search

```bash
node scripts/board.js exec \
  --task-id T-1 \
  --agent reviewer \
  --code '
    const results = board.search({ text: "authentication", limit: 10 });
    
    const byType = results.reduce((acc, r) => {
      acc[r.type] = (acc[r.type] || 0) + 1;
      return acc;
    }, {});
    
    return {
      total_results: results.length,
      by_type: byType,
      top_3: results.slice(0, 3).map(r => ({
        type: r.type,
        id: r.id,
        rank: r.rank
      }))
    };
  ' \
  --path /workspace
```

### Example 4: Conditional Logic

```bash
node scripts/board.js exec \
  --task-id T-1 \
  --agent coordinator \
  --code '
    const plan = board.getPlan();
    const facts = board.getFacts({ confidence: ["high", "medium"] });
    
    if (!plan) {
      return { ready: false, reason: "No plan set" };
    }
    
    if (facts.length < 5) {
      return { ready: false, reason: "Insufficient facts (need 5+)" };
    }
    
    return {
      ready: true,
      current_step: plan.current_step,
      available_facts: facts.length
    };
  ' \
  --path /workspace
```

### Example 5: Complex Query Pattern

```bash
node scripts/board.js exec \
  --task-id T-1 \
  --agent implementer \
  --code '
    // Get snippets for current step files
    const plan = board.getPlan();
    const currentStep = plan.steps[plan.current_step - 1];
    
    const snippetsNeeded = [];
    for (const file of currentStep.files) {
      const snippets = board.getSnippets({ path: file });
      if (snippets.length === 0) {
        snippetsNeeded.push(file);
      }
    }
    
    // Check for related facts
    const facts = board.getFacts({ confidence: ["high"] });
    const relevantFacts = facts.filter(f => 
      currentStep.files.some(file => 
        f.evidence.some(e => e.reference?.includes(file))
      )
    );
    
    return {
      step: currentStep.title,
      files: currentStep.files,
      missing_snippets: snippetsNeeded,
      relevant_facts: relevantFacts.map(f => f.fact_id),
      ready_to_execute: snippetsNeeded.length === 0
    };
  ' \
  --path /workspace
```

---

## Output Format

All commands return JSON:

**Success:**
```json
{
  "result": <data>
}
```

**Error:**
```json
{
  "error": "Error message",
  "details": "Optional additional context"
}
```

---

## Error Handling

Common error patterns:

| Error | Cause | Solution |
|-------|-------|----------|
| `Task not found` | Invalid task_id | Check with `list-tasks` |
| `Agent not authorized` | Wrong agent for operation | Check permission matrix |
| `Invalid JSON` | Malformed JSON in parameter | Validate JSON syntax |
| `Missing required parameter` | Required flag not provided | Add missing flag |
| `Entity not found` | Invalid fact/snippet/decision ID | Check entity exists |
| `Constraint violation` | Operation violates constraint | Review constraint rules |

---

## Best Practices

1. **Always check snippets before reading files:**
   ```bash
   # Check first
   node scripts/board.js exec --code 'return board.getSnippets({ path: "src/auth.ts" })'
   
   # Only read if no snippet exists
   ```

2. **Use exec mode for complex queries:**
   ```bash
   # Better than multiple CLI calls
   node scripts/board.js exec --code '
     const facts = board.getFacts({ confidence: ["high"] });
     const snippets = board.getSnippets({ tags: ["target"] });
     return { facts: facts.length, snippets: snippets.length };
   '
   ```

3. **Reference evidence in all operations:**
   ```bash
   # Always include evidence
   --evidence '[{"type":"file","reference":"src/auth.ts#L10"}]'
   ```

4. **Use search for discovery:**
   ```bash
   # Find related entities
   node scripts/board.js search "authentication" --types facts,snippets
   ```

5. **Log trails during execution:**
   ```bash
   # Log important decisions and patterns
   --marker DECISION --summary "..." --evidence '[...]'
   ```
