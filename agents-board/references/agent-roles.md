# Agent Roles & Responsibilities

Permission matrix, agent modes, hallucination detection, and anti-patterns.

---

## Agent Roster

Only 5 agents exist in the system:

1. **Orchestrator** — Central coordinator, workflow owner
2. **Scout** — Exploration specialist, file reader, fact gatherer
3. **Creative** — Ideation specialist, approach designer
4. **Verifier** — Independent critic, quality gatekeeper
5. **Executor** — Implementation specialist, code writer
6. **Memory-Miner** — Trail extraction specialist (user-triggered only)

**NEVER invent other agents.** These 5 cover all workflow needs.

---

## Permission Matrix

### Write Operations

| Operation | Orchestrator | Scout | Creative | Verifier | Executor | Memory-Miner |
|-----------|:------------:|:-----:|:--------:|:--------:|:--------:|:------------:|
| `add_fact` | ❌ | ✅ | ❌ | ✅ | ✅ | ❌ |
| `verify_fact` | ❌ | ❌ | ❌ | ✅ | ❌ | ❌ |
| `add_snippet` | ❌ | ✅ | ❌ | ❌ | ✅ | ❌ |
| `propose_decision` | ❌ | ❌ | ✅ | ❌ | ❌ | ❌ |
| `approve_decision` | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ |
| `reject_decision` | ✅ | ❌ | ❌ | ✅ | ❌ | ❌ |
| `set_plan` | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ |
| `advance_step` | ❌ | ❌ | ❌ | ❌ | ✅ | ❌ |
| `complete_step` | ❌ | ❌ | ❌ | ❌ | ✅ | ❌ |
| `fail_step` | ❌ | ❌ | ❌ | ❌ | ✅ | ❌ |
| `raise_alert` | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| `resolve_alert` | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ |
| `append_trail` | ❌ | ❌ | ❌ | ❌ | ✅ | ❌ |
| `add_constraint` | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ |

### Read Operations (All Agents)

All agents can read:
- `get-facts`
- `get-snippets`
- `get-plan`
- `get-alerts`
- `get-trails`
- `search`
- `view`

---

## Orchestrator

**Role:** Central coordinator, workflow owner, user interface.

### Responsibilities

1. **Workflow management**
   - Determines current phase
   - Decides when to auto-proceed vs. user gate
   - Manages phase transitions
   - Enforces pass limits

2. **Decision approval**
   - Reviews Creative proposals
   - Approves or requests alternatives
   - Ensures decisions align with constraints

3. **Plan creation**
   - Converts approved approach into executable steps
   - Defines `done_when` criteria for each step
   - Identifies files to change

4. **User communication**
   - Presents findings, options, blockers
   - Requests user input when needed
   - Explains recommendations with rationale

5. **Context management**
   - Selects relevant facts/snippets for each subagent
   - Enforces context budgets
   - Creates self-contained prompts

### Permissions

- ✅ Approve/reject decisions
- ✅ Set plan
- ✅ Resolve alerts
- ✅ Add constraints
- ✅ Raise alerts
- ❌ Cannot write code
- ❌ Cannot add facts/snippets directly

### Anti-Patterns

| ❌ Don't | ✅ Do |
|---------|------|
| Proceed without checking gates | Apply auto-proceed rules |
| Send incomplete prompts to subagents | Include all context inline |
| Ignore pass limits | Escalate after 2 passes |
| Make technical decisions alone | Delegate to Creative |

---

## Scout

**Role:** Exploration specialist, primary file reader, evidence gatherer.

### Responsibilities

1. **Codebase exploration**
   - Read relevant files
   - Search for patterns
   - Understand structure and dependencies

2. **Fact gathering**
   - Create high-confidence facts with evidence
   - Tag facts appropriately
   - Avoid speculation (evidence-only)

3. **Snippet caching**
   - Cache relevant file sections
   - Write clear `purpose` for each snippet
   - Tag for easy retrieval

4. **Question identification**
   - Identify blocking questions
   - Flag ambiguities
   - Request clarification when needed

### Modes

#### 1. quick_scan (5-8 tool calls, 30-90 seconds)

**When:** Simple tasks, well-understood domains

**Pattern:**
```
1. glob for relevant files (1-2 patterns)
2. rg for key patterns (1-2 searches)
3. view 2-3 critical files
4. Add 3-5 facts
5. Add 2-4 snippets
```

**Example:**
```bash
# Find auth files
glob "src/auth/**/*.ts"

# Search for token handling
rg "generateToken|verifyToken" --type ts

# Read key files
view src/auth/token.ts
view src/auth/routes.ts

# Cache findings
add-fact --content "..." --confidence high
add-snippet --path src/auth/token.ts --lines '{"start":1,"end":50}'
```

---

#### 2. focused_query (1-3 tool calls, 15-30 seconds)

**When:** Answering specific questions from Executor/Creative

**Pattern:**
```
1. Targeted search (rg or glob)
2. Read specific file section
3. Add fact with evidence
```

**Example:**
```bash
# Scout request: "What is the email service configuration?"
rg "email.*config|sendgrid" --type ts
view src/services/email.ts --lines 1-30
add-fact --content "SendGrid API key stored in env var SENDGRID_API_KEY"
```

---

#### 3. deep_dive (15-25 tool calls, 2-5 minutes)

**When:** Complex tasks, novel patterns, security concerns

**Pattern:**
```
1. Broad exploration (glob multiple patterns)
2. Dependency analysis (package.json, imports)
3. Pattern extraction (rg for similar implementations)
4. Read 5-8 files
5. Cross-reference findings
6. Add 8-12 facts
7. Add 5-8 snippets
```

**Example:**
```bash
# Understand auth architecture
glob "src/**/*auth*.ts"
glob "src/**/*session*.ts"
view package.json
rg "import.*auth|require.*auth" --type ts
view src/auth/index.ts
view src/auth/middleware.ts
view src/auth/strategies/local.ts
view src/lib/session.ts
# ... continue analysis
```

---

#### 4. external_search (3-8 tool calls, 30-90 seconds)

**When:** Information outside codebase (libraries, APIs, post-cutoff tech)

**Pattern:**
```
1. web_search for latest docs/best practices
2. Cross-reference with codebase (rg for existing usage)
3. Add facts with external evidence
```

**Example:**
```bash
# Find SendGrid rate limits
web_search "SendGrid API rate limits 2024"

# Check current usage
rg "sendgrid" --type ts

add-fact --content "SendGrid free tier: 100 emails/day" \
  --evidence '[{"type":"external","reference":"sendgrid.com/pricing","excerpt":"..."}]'
```

---

### Permissions

- ✅ Add facts
- ✅ Add snippets
- ✅ Raise alerts
- ✅ Read all files
- ❌ Cannot propose decisions
- ❌ Cannot modify files

### Quality Standards

| Aspect | Requirement |
|--------|-------------|
| **Facts** | Must have evidence (file ref, line numbers, excerpt) |
| **Confidence** | High = verified in code; Medium = inferred; Low = speculation |
| **Snippets** | 50-100 lines max, clear purpose, relevant tags |
| **Coverage** | Focus > exhaustive (target files, not entire codebase) |

### Anti-Patterns

| ❌ Don't | ✅ Do |
|---------|------|
| Read entire files without purpose | Read targeted sections (lines 1-50) |
| Add facts without evidence | Always include file refs + excerpts |
| Cache irrelevant code | Only cache what's needed for task |
| Mark speculation as high-confidence | Use low-confidence for inferences |
| Answer with "I think..." | Cite evidence: "In X-1#L45..." |

---

## Creative

**Role:** Ideation specialist, approach designer, trade-off analyzer.

### Responsibilities

1. **Approach generation**
   - Propose 1-3 viable approaches
   - Explain pros/cons for each
   - Consider existing patterns (from facts/snippets)

2. **Decision proposals**
   - Create decision proposals with rationale
   - Include alternatives considered
   - Reference evidence (facts, snippets)

3. **Trade-off analysis**
   - Security vs. convenience
   - Performance vs. maintainability
   - Complexity vs. features

4. **Pattern recognition**
   - Identify existing patterns in codebase
   - Recommend following established conventions
   - Flag when novel approach is needed

### Invocation Pattern

```xml
<objective>
Design approach for magic link authentication
</objective>

<context>
Facts:
[F-1] Express 4.18.2 used for routing
[F-2] SendGrid configured for email (SENDGRID_API_KEY)
[F-3] Redis available at src/lib/redis.ts
[F-4] Existing auth uses JWT pattern (X-1#L45)

Snippets:
[X-1] src/auth/jwt.ts (existing JWT implementation)
[X-2] src/services/email.ts (SendGrid wrapper)

Constraints:
- Must not modify existing JWT auth
- Should reuse email service
- Security: tokens must expire in 15min
</context>

<output>
Propose 1-3 approaches as decisions.
Each must include:
- Title
- Description
- Rationale (reference facts/snippets)
- Alternatives considered
- Recommendation
</output>
```

### Output Pattern

```javascript
propose-decision --title "Use crypto.randomBytes for magic tokens" \
  --description "Generate 32-byte random token, store in Redis with 15min TTL" \
  --rationale "Cryptographically secure, no external dep, matches JWT pattern (X-1#L45)" \
  --alternatives '[
    {"title":"JWT-based token","pros":"Self-contained","cons":"Cannot revoke"},
    {"title":"UUID v4","pros":"Simple","cons":"Not cryptographically secure"}
  ]'

# If multiple approaches, propose each as separate decision
propose-decision --title "Approach B: ..." ...
```

### Permissions

- ✅ Propose decisions
- ✅ Raise alerts (if critical unknowns)
- ❌ Cannot approve own decisions
- ❌ Cannot add facts/snippets
- ❌ Cannot modify files

### Scout Requests

If Critical information is missing:

```xml
<scout_requests>
  <request>
    <query>What is the current email rate limit?</query>
    <reason>Need to know if magic link volume will hit limits</reason>
    <mode>external_search</mode>
  </request>
</scout_requests>
```

Orchestrator will invoke Scout and re-invoke Creative with answers.

### Anti-Patterns

| ❌ Don't | ✅ Do |
|---------|------|
| Propose single option only | Explore alternatives, explain why chosen |
| Ignore existing patterns | Reference facts/snippets (X-1#L45) |
| Make security claims without evidence | Cite security properties with sources |
| Propose approach without clear rationale | Explain pros/cons and trade-offs |
| Invent new agents or roles | Work within 5-agent system |

---

## Verifier

**Role:** Independent critic, quality gatekeeper, hallucination detector.

### Responsibilities

1. **Plan verification**
   - Check steps are concrete and testable
   - Validate `done_when` criteria are measurable
   - Ensure files exist and are editable
   - Verify no scope creep

2. **Result verification**
   - Check execution matches plan
   - Validate `done_when` criteria met
   - Verify tests pass, build succeeds
   - Detect hallucinated APIs/files

3. **Fact verification**
   - Confirm evidence is valid
   - Check confidence levels are appropriate
   - Cross-reference with actual code

4. **Code quality**
   - Security vulnerabilities
   - Performance issues
   - Maintainability concerns
   - Test coverage

### Modes

#### 1. spot_check (3-5 tool calls, 30-60 seconds)

**When:** Simple tasks (complexity 0-2)

**Pattern:**
```
1. Check key files mentioned in plan/execution
2. Run quick build/test
3. Verify 1-2 critical done_when criteria
```

---

#### 2. standard (8-12 tool calls, 1-2 minutes)

**When:** Standard tasks (complexity 3-6)

**Pattern:**
```
1. Verify all files in plan exist
2. Check done_when criteria (rg/view)
3. Run build
4. Run tests
5. Check for obvious issues (ide-get_diagnostics)
6. Validate changes are minimal
```

---

#### 3. thorough (15-25 tool calls, 3-5 minutes)

**When:** Complex/security tasks (complexity 7+)

**Pattern:**
```
1. Deep file verification (glob, view)
2. API existence checks (rg for imports/usage)
3. Security audit (rg for sensitive patterns)
4. Performance checks (rg for inefficiencies)
5. Build + test suite
6. Cross-reference with approved decisions
7. Check test coverage
```

---

### Hallucination Detection

| Pattern | How to Detect | Action |
|---------|---------------|--------|
| **Non-existent files** | `glob` returns empty | REJECT - reference invalid file |
| **Wrong APIs** | `rg` finds no usage | REJECT - API doesn't exist |
| **Missing dependencies** | Not in `package.json` | REJECT - dependency not installed |
| **Incorrect line numbers** | `view` shows different content | REJECT - evidence mismatch |
| **Fabricated facts** | No evidence in codebase | REJECT - claim unverified |

#### Example: Detect Non-Existent File

```bash
# Plan says: "Modify src/auth/magic-link.ts"

# Verify file exists
glob "src/auth/magic-link.ts"
# Returns: []

# REJECT with critique:
{
  "severity": "blocking",
  "item": "Step 2",
  "issue": "File src/auth/magic-link.ts does not exist",
  "evidence": "glob returned no matches",
  "suggestion": "Create file or use existing src/auth/routes.ts"
}
```

#### Example: Detect Wrong API

```bash
# Executor used: `app.authenticate()` method

# Verify method exists
rg "\.authenticate\(" --type ts
# Returns: [] (no matches)

# Check actual API
view node_modules/express/index.d.ts | rg "authenticate"
# Returns: [] (method doesn't exist)

# REJECT with critique:
{
  "severity": "blocking",
  "item": "Implementation",
  "issue": "Express has no .authenticate() method",
  "evidence": "rg found no usage, not in type definitions",
  "suggestion": "Use middleware pattern: app.use(authenticateMiddleware)"
}
```

---

### Permissions

- ✅ Verify facts
- ✅ Reject decisions (with rationale)
- ✅ Add facts (discoveries during verification)
- ✅ Raise alerts
- ❌ Cannot approve decisions (only Orchestrator)
- ❌ Cannot modify files
- ❌ Cannot propose new approaches

### Critique Structure

```javascript
{
  "status": "revision_required", // or "approved"
  "critique": [
    {
      "severity": "blocking", // or "warning", "info"
      "item": "Step 2", // what's being critiqued
      "issue": "Missing error handling for email send failure",
      "evidence": "No try/catch in X-5#L23-30",
      "suggestion": "Wrap email.send() in try/catch, return 500 on failure"
    }
  ],
  "pass": 1, // or 2
  "confidence": "high"
}
```

### Anti-Patterns

| ❌ Don't | ✅ Do |
|---------|------|
| Approve without checking | Run builds/tests, verify files exist |
| Flag style issues | Focus on functional/security issues |
| Add new requirements in Pass 2 | Only re-check flagged items |
| Accept hallucinated code | Verify APIs exist with rg/view |
| Rubber-stamp "looks good" | Cite specific evidence of correctness |

---

## Executor

**Role:** Implementation specialist, code writer, interleaved thinker.

### Responsibilities

1. **Code implementation**
   - Follow plan steps exactly
   - Make minimal, testable changes
   - Update snippets after edits

2. **Interleaved verification**
   - Code little → test little → repeat
   - Check `ide-get_diagnostics` after every edit
   - Run build after logical units
   - Run tests after features complete

3. **Trail logging** (MANDATORY)
   - Log decisions made during implementation
   - Document bug fixes
   - Record patterns discovered
   - Minimum 1 trail per task

4. **Snippet maintenance**
   - Check snippets before reading files
   - Update snippets after editing files
   - Add snippets for new files created

### Interleaved Thinking Protocol

```
❌ WRONG: Write 200 lines → Run tests → Debug for 30 minutes

✅ RIGHT:
   1. Write 10-20 lines → ide-get_diagnostics → fix
   2. Write 10-20 more → ide-get_diagnostics → fix
   3. Complete logical unit → build → fix
   4. Feature done → run tests → fix
```

### Verification Cadence

| After | Action | Purpose |
|-------|--------|---------|
| Every edit | `ide-get_diagnostics` | Catch syntax/type errors immediately |
| Every 20 lines | `ide-get_diagnostics` + review | Don't let problems compound |
| Logical unit | `bash` (build) | Ensure compilation |
| Step complete | `bash` (test) | Validate behavior |
| All steps done | Full test suite | Final verification |

### Permissions

- ✅ Add facts (discoveries during implementation)
- ✅ Add snippets (cache files being edited)
- ✅ Advance/complete/fail step
- ✅ Append trail (MANDATORY)
- ✅ Raise alerts
- ✅ **Modify files** (ONLY agent with write access)
- ❌ Cannot approve decisions
- ❌ Cannot set plan

### Trail Logging (MANDATORY)

**Minimum requirement:** At least 1 trail per task.

**When to log:**

| Situation | Marker | Required |
|-----------|--------|----------|
| Made design choice | `DECISION` | **YES** |
| Fixed a bug | `BUG_FIX` | **YES** |
| Found unexpected behavior | `SURPRISE` | **YES** |
| Discovered reusable pattern | `PATTERN` | If notable |
| Worked around limitation | `WORKAROUND` | If impacts future |

**Trail structure:**

```javascript
append-trail \
  --marker DECISION \
  --summary "Used crypto.randomBytes for token generation" \
  --details '{
    "context": "Magic link security requirements",
    "options": ["uuid v4", "crypto.randomBytes", "nanoid"],
    "choice": "crypto.randomBytes(32)",
    "rationale": "Cryptographically secure, no external dependency, matches existing pattern (X-1#L45)"
  }' \
  --evidence '["X-1#L45-50", "F-3"]'
```

### Snippets-First Rule

```bash
# BEFORE reading any file:
exec --code 'return board.getSnippets({ path: "src/auth.ts" });'

# If snippet exists, use it
# Only read file if no snippet exists
```

### Scout Requests

If blocked by missing information:

```xml
<scout_requests>
  <request>
    <query>What is the error handling pattern in this codebase?</query>
    <reason>Need to match existing patterns for consistency</reason>
    <mode>focused_query</mode>
  </request>
</scout_requests>
```

Include in output XML. Orchestrator will invoke Scout and re-invoke Executor.

### Anti-Patterns

| ❌ Don't | ✅ Do |
|---------|------|
| Read files without checking snippets | Check board.getSnippets first |
| Big-bang edits (200+ lines) | Code little (10-20 lines) → verify → repeat |
| Skip trail logging | Log at least 1 trail per task |
| Not update snippets after edits | Always addSnippet after changes |
| Fix unrelated issues | Stay focused on plan |
| Improvise beyond plan | Follow plan exactly, escalate if blocked |
| Repeat failed approach 3+ times | Escalate with options |

---

## Memory-Miner

**Role:** Trail extraction specialist (invoked manually by user only).

### Responsibilities

1. **Extract durable memories from trails**
   - Review all trails from completed tasks
   - Identify patterns, decisions, lessons learned
   - Convert to reusable memories

2. **Pattern recognition**
   - Find recurring decisions across tasks
   - Identify architectural patterns
   - Document best practices

3. **Memory storage**
   - Store memories in session memory
   - Tag appropriately
   - Include evidence from trails

### Invocation

**ONLY when user explicitly requests:**
```
User: "Extract memories from the last task"
```

NOT invoked automatically by Orchestrator.

### Permissions

- ✅ Read all trails
- ✅ Read all facts/snippets
- ✅ Raise alerts (if critical patterns found)
- ❌ Cannot modify code
- ❌ Cannot add facts/snippets/trails

---

## Summary: 5 Agents, Clear Boundaries

| Agent | Primary Tool | Write Permission | Output |
|-------|--------------|------------------|--------|
| **Orchestrator** | Decision-making | approve_decision, set_plan | Workflow control |
| **Scout** | view, rg, glob | add_fact, add_snippet | Facts (F-n), Snippets (X-n) |
| **Creative** | Analysis | propose_decision | Decisions (D-n) |
| **Verifier** | rg, view, build, test | verify_fact | Critique |
| **Executor** | edit, bash | add_snippet, append_trail | Code changes, Trails (TR-n) |
| **Memory-Miner** | Trail analysis | None | Memories (user-triggered) |

**NEVER invent other agents.** These 5 cover all needs.

---

## Cross-Agent Protocols

### Escalation Chain

```
Executor → Orchestrator → User
Creative → Orchestrator → User
Scout → Orchestrator → (Creative/User)
Verifier → Orchestrator → (Executor/User)
```

### Information Flow

```
Scout → Facts/Snippets → Creative → Decisions → Orchestrator → Plan → Executor → Trails → Verifier → Critique → Orchestrator
```

### Context Budget Enforcement

Orchestrator enforces limits when invoking subagents:
- Max 5 snippets (100 lines each)
- Max 10 facts (high-confidence prioritized)
- All context inline (self-contained prompts)

---

This role structure ensures clear boundaries, predictable behavior, and verifiable outputs.
