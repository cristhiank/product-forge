# Workflow Examples

Real-world examples showing complete workflows with actual CLI commands and board operations.

---

## Example 1: Simple Task (Complexity 2)

**Task:** Add a utility function to convert timestamps to ISO format.

**Complexity:** 2 (Simple — single file, well-understood pattern)

**Collapsed workflow:** setup → exploration → planning → execution → result_verify → complete

### Step 1: Setup

```bash
# Create task
node dist/skill-cli.js create-task \
  --goal "Add utility function to convert timestamps to ISO format" \
  --context "User wants consistent date formatting across API responses" \
  --constraints '["Must use built-in Date API","Must handle null/undefined"]' \
  --path /workspace

# Returns: {"result": {"task_id": "T-1", "status": "setup"}}
```

### Step 2: Exploration (Scout - quick_scan mode)

**Orchestrator → Scout:**
```xml
<objective>
Explore codebase for existing date/time utilities and formatting patterns.
</objective>

<context>
Task: Add utility function to convert timestamps to ISO format
Mode: quick_scan (5-8 tool calls)
Focus: Utility files, date handling, API responses
</context>
```

**Scout actions:**
```bash
# Find existing utilities
glob "src/utils/**/*.ts"
glob "src/lib/**/*.ts"

# Search for date handling
rg "Date\.|toISO|format.*date" --type ts

# Read utils structure
view src/utils/index.ts

# Read existing date utilities (if any)
view src/utils/date.ts

# Add findings
node dist/skill-cli.js add-fact \
  --task-id T-1 \
  --agent scout \
  --content "Utilities organized in src/utils/ with barrel export pattern" \
  --confidence high \
  --evidence '[{"type":"file","reference":"src/utils/index.ts","excerpt":"export * from ./date"}]' \
  --path /workspace

node dist/skill-cli.js add-fact \
  --task-id T-1 \
  --agent scout \
  --content "No existing ISO date formatting utility found" \
  --confidence high \
  --evidence '[{"type":"search","reference":"rg toISO","excerpt":"No matches"}]' \
  --path /workspace

node dist/skill-cli.js add-snippet \
  --task-id T-1 \
  --agent scout \
  --path src/utils/index.ts \
  --lines '{"start":1,"end":15}' \
  --content "$(cat src/utils/index.ts)" \
  --purpose "Barrel export pattern for utilities" \
  --tags "utils,pattern,target" \
  --path /workspace
```

**Scout → Orchestrator:**
```xml
<report>
  <facts>F-1, F-2</facts>
  <snippets>X-1</snippets>
  <confidence>high</confidence>
  <blocking_questions></blocking_questions>
</report>
```

**Gate:** Auto-proceed (complexity 2, high confidence, no blocking questions)

### Step 3: Planning (Skip Creative)

**Orchestrator creates plan directly (simple task, obvious approach):**

```bash
node dist/skill-cli.js set-plan \
  --task-id T-1 \
  --agent orchestrator \
  --goal "Add utility function to convert timestamps to ISO format" \
  --approach "Create formatToISO function in src/utils/date.ts, export via barrel" \
  --steps '[
    {
      "title": "Create formatToISO function",
      "description": "Add function in src/utils/date.ts that accepts timestamp and returns ISO string",
      "done_when": [
        "Function formatToISO exists in src/utils/date.ts",
        "Handles null/undefined (returns empty string or null)",
        "Uses Date.toISOString()",
        "Exported in src/utils/index.ts"
      ],
      "files": ["src/utils/date.ts", "src/utils/index.ts"]
    },
    {
      "title": "Add tests",
      "description": "Write unit tests for formatToISO",
      "done_when": [
        "Test file exists at tests/utils/date.test.ts",
        "Tests cover valid timestamp, null, undefined",
        "All tests pass"
      ],
      "files": ["tests/utils/date.test.ts"]
    }
  ]' \
  --path /workspace
```

**Gate:** Skip plan_verify (complexity 2, straightforward plan)

### Step 4: Execution

**Orchestrator → Executor:**
```xml
<objective>
Implement Step 1: Create formatToISO function
</objective>

<context>
Task ID: T-1
Complexity: 2
Current step: 1 of 2

Step details:
- Title: Create formatToISO function
- Description: Add function in src/utils/date.ts that accepts timestamp and returns ISO string
- Done when:
  * Function formatToISO exists in src/utils/date.ts
  * Handles null/undefined (returns empty string or null)
  * Uses Date.toISOString()
  * Exported in src/utils/index.ts
- Files: src/utils/date.ts, src/utils/index.ts

Snippets:
[X-1] src/utils/index.ts — Barrel export pattern

Facts:
[F-1] Utilities organized in src/utils/ with barrel export pattern
[F-2] No existing ISO date formatting utility found

Constraints:
- Must use built-in Date API
- Must handle null/undefined
</context>

<output>
Implement the step following interleaved thinking:
- Code little (10-20 lines)
- Verify (ide-get_diagnostics)
- Repeat
- Update snippets after edits
- Log at least 1 trail
</output>
```

**Executor actions:**

```bash
# Check snippets first (snippets-first rule)
node dist/skill-cli.js exec \
  --task-id T-1 \
  --agent executor \
  --code 'return board.getSnippets({ path: "src/utils/date.ts" });' \
  --path /workspace
# Returns: [] (no existing snippet)

# Read file to check if exists
view src/utils/date.ts
# File doesn't exist

# Create file with function (small unit)
cat > src/utils/date.ts << 'EOF'
/**
 * Converts a timestamp to ISO 8601 format string.
 * @param timestamp - Unix timestamp in milliseconds or Date object
 * @returns ISO string or null if input is null/undefined
 */
export function formatToISO(timestamp: number | Date | null | undefined): string | null {
  if (timestamp == null) {
    return null;
  }
  
  const date = timestamp instanceof Date ? timestamp : new Date(timestamp);
  return date.toISOString();
}
EOF

# Verify immediately
ide-get_diagnostics src/utils/date.ts
# Clean ✓

# Update barrel export
view src/utils/index.ts
# Add export

cat >> src/utils/index.ts << 'EOF'
export * from './date';
EOF

# Verify
ide-get_diagnostics src/utils/index.ts
# Clean ✓

# Build (logical unit complete)
npm run build
# Success ✓

# Update snippet for created file
node dist/skill-cli.js add-snippet \
  --task-id T-1 \
  --agent executor \
  --path src/utils/date.ts \
  --lines '{"start":1,"end":15}' \
  --content "$(cat src/utils/date.ts)" \
  --purpose "ISO date formatting utility (CREATED)" \
  --tags "utils,date,target,created" \
  --path /workspace

# Log trail (MANDATORY)
node dist/skill-cli.js append-trail \
  --task-id T-1 \
  --agent executor \
  --marker DECISION \
  --summary "Return null for null/undefined instead of throwing error" \
  --details '{"context":"Handling invalid input","options":["throw error","return null","return empty string"],"choice":"return null","rationale":"More flexible for optional fields, matches TypeScript strict null checks"}' \
  --evidence '["F-1"]' \
  --path /workspace

# Complete step
node dist/skill-cli.js complete-step \
  --task-id T-1 \
  --agent executor \
  --notes "Function created, build passes, snippet X-2 added, trail TR-1 logged" \
  --path /workspace

# Advance to next step
node dist/skill-cli.js advance-step \
  --task-id T-1 \
  --agent executor \
  --path /workspace
```

**Executor continues with Step 2 (tests):**

```bash
# Create test file
cat > tests/utils/date.test.ts << 'EOF'
import { describe, it, expect } from 'vitest';
import { formatToISO } from '../../src/utils/date';

describe('formatToISO', () => {
  it('converts timestamp to ISO string', () => {
    const timestamp = 1640000000000; // 2021-12-20T11:33:20.000Z
    const result = formatToISO(timestamp);
    expect(result).toBe('2021-12-20T11:33:20.000Z');
  });

  it('handles Date object', () => {
    const date = new Date('2021-12-20T11:33:20.000Z');
    const result = formatToISO(date);
    expect(result).toBe('2021-12-20T11:33:20.000Z');
  });

  it('returns null for null input', () => {
    expect(formatToISO(null)).toBeNull();
  });

  it('returns null for undefined input', () => {
    expect(formatToISO(undefined)).toBeNull();
  });
});
EOF

# Verify
ide-get_diagnostics tests/utils/date.test.ts
# Clean ✓

# Run tests
npm test -- tests/utils/date.test.ts
# 4/4 pass ✓

# Complete step
node dist/skill-cli.js complete-step \
  --task-id T-1 \
  --agent executor \
  --notes "All tests passing (4/4)" \
  --path /workspace
```

**Executor → Orchestrator:**
```xml
<report>
  <status>complete</status>
  <progress>2/2 steps</progress>
  <files_changed>
    <created>src/utils/date.ts, tests/utils/date.test.ts</created>
    <modified>src/utils/index.ts</modified>
  </files_changed>
  <verification>
    <build>pass</build>
    <tests>4/4 pass</tests>
  </verification>
  <trails_logged>TR-1 (DECISION)</trails_logged>
</report>
```

### Step 5: Result Verification (spot_check mode)

**Orchestrator → Verifier:**
```xml
<objective>
Verify execution results for formatToISO utility
</objective>

<context>
Mode: spot_check (complexity 2)
Pass: 1

Plan:
Step 1: Create formatToISO function ✓
Step 2: Add tests ✓

Done when criteria:
- Function formatToISO exists in src/utils/date.ts ✓
- Handles null/undefined ✓
- Uses Date.toISOString() ✓
- Exported in src/utils/index.ts ✓
- Tests exist and pass ✓

Files changed:
- Created: src/utils/date.ts, tests/utils/date.test.ts
- Modified: src/utils/index.ts
</context>
```

**Verifier actions:**

```bash
# Verify files exist
glob "src/utils/date.ts"
# Match ✓

glob "tests/utils/date.test.ts"
# Match ✓

# Check function implementation
view src/utils/date.ts
# Contains formatToISO ✓
# Uses toISOString() ✓
# Handles null/undefined ✓

# Check export
rg "export.*from.*date" src/utils/index.ts
# Found ✓

# Run tests
npm test -- tests/utils/date.test.ts
# 4/4 pass ✓

# Build
npm run build
# Success ✓
```

**Verifier → Orchestrator:**
```xml
<critique>
  <status>approved</status>
  <pass>1</pass>
  <confidence>high</confidence>
  <issues></issues>
</critique>
```

**Gate:** Auto-complete (complexity 2, all checks pass, no issues)

### Step 6: Complete

```bash
node dist/skill-cli.js archive-task \
  --task-id T-1 \
  --path /workspace
```

**Summary:**
- Duration: ~3-5 minutes
- Phases: setup → exploration → planning → execution → result_verify → complete
- Skipped: ideation (Creative), plan_verify (simple task)
- Facts: 2, Snippets: 2, Trails: 1
- Files: 2 created, 1 modified
- Auto-gates: All (no user intervention)

---

## Example 2: Standard Task (Complexity 5) with Scout Requests

**Task:** Implement rate limiting for API endpoints.

**Complexity:** 5 (Standard — multiple files, existing patterns to follow)

**Full workflow:** setup → exploration → ideation → planning → plan_verify → execution → result_verify → complete

### Step 1: Setup

```bash
node dist/skill-cli.js create-task \
  --goal "Implement rate limiting for API endpoints" \
  --context "Prevent abuse, limit to 100 req/min per IP" \
  --constraints '["Must not break existing endpoints","Should use Redis for distributed support"]' \
  --path /workspace

# Returns: {"result": {"task_id": "T-2", "status": "setup"}}
```

### Step 2: Exploration (Scout - focused_query mode)

```bash
# Find middleware patterns
glob "src/middleware/**/*.ts"

# Search for rate limiting
rg "rate.*limit|throttle" --type ts

# Check Redis setup
rg "redis|Redis" --type ts
view src/lib/redis.ts

# Check package.json for rate limiting libs
view package.json | rg "rate|limit"

# Add facts
node dist/skill-cli.js add-fact \
  --task-id T-2 \
  --agent scout \
  --content "Middleware pattern: functions in src/middleware/ imported in src/app.ts" \
  --confidence high \
  --evidence '[{"type":"file","reference":"src/app.ts#L10","excerpt":"import { authMiddleware } from ./middleware/auth"}]' \
  --path /workspace

node dist/skill-cli.js add-fact \
  --task-id T-2 \
  --agent scout \
  --content "Redis client configured at src/lib/redis.ts" \
  --confidence high \
  --evidence '[{"type":"file","reference":"src/lib/redis.ts#L1-L10","excerpt":"createClient()"}]' \
  --path /workspace

node dist/skill-cli.js add-fact \
  --task-id T-2 \
  --agent scout \
  --content "No existing rate limiting library in package.json" \
  --confidence high \
  --evidence '[{"type":"search","reference":"rg rate package.json","excerpt":"No matches"}]' \
  --path /workspace

# Cache snippets
node dist/skill-cli.js add-snippet \
  --task-id T-2 \
  --agent scout \
  --path src/middleware/auth.ts \
  --lines '{"start":1,"end":25}' \
  --content "..." \
  --purpose "Example middleware pattern" \
  --tags "middleware,pattern" \
  --path /workspace
```

**Scout → Orchestrator:**
```xml
<report>
  <facts>F-1, F-2, F-3</facts>
  <snippets>X-1</snippets>
  <confidence>high</confidence>
  <blocking_questions></blocking_questions>
</report>
```

### Step 3: Ideation (Creative)

**Orchestrator → Creative:**
```xml
<objective>
Design approach for API rate limiting (100 req/min per IP).
</objective>

<context>
Facts:
[F-1] Middleware pattern: functions in src/middleware/
[F-2] Redis client configured at src/lib/redis.ts
[F-3] No existing rate limiting library

Snippets:
[X-1] src/middleware/auth.ts — Middleware pattern example

Constraints:
- Must not break existing endpoints
- Should use Redis for distributed support
- 100 req/min per IP
</context>
```

**Creative discovers unknown:**

```xml
<report>
  <scout_requests>
    <request>
      <query>What rate limiting libraries are compatible with Express + Redis?</query>
      <reason>Need to evaluate library vs. custom implementation</reason>
      <mode>external_search</mode>
    </request>
  </scout_requests>
</report>
```

**Orchestrator → Scout (external_search):**

```bash
web_search "Express rate limiting Redis library 2024"

# Discovers: rate-limiter-flexible, express-rate-limit

node dist/skill-cli.js add-fact \
  --task-id T-2 \
  --agent scout \
  --content "Popular library: rate-limiter-flexible supports Redis, 10K+ weekly downloads" \
  --confidence medium \
  --evidence '[{"type":"external","reference":"npmjs.com/package/rate-limiter-flexible","excerpt":"Redis store support"}]' \
  --path /workspace
```

**Orchestrator re-invokes Creative with new fact:**

**Creative actions:**

```bash
# Propose Approach 1: Use rate-limiter-flexible
node dist/skill-cli.js propose-decision \
  --task-id T-2 \
  --agent creative \
  --title "Use rate-limiter-flexible library" \
  --description "Install rate-limiter-flexible, configure with Redis backend, create middleware" \
  --rationale "Battle-tested (10K+ downloads), Redis support built-in, minimal code" \
  --alternatives '[
    {
      "title": "Custom implementation",
      "pros": "No external dependency, full control",
      "cons": "More code to maintain, edge cases"
    },
    {
      "title": "express-rate-limit + Redis store",
      "pros": "Express-specific",
      "cons": "Two packages, less flexible"
    }
  ]' \
  --tags "rate-limit,library,recommended" \
  --path /workspace
```

**Creative → Orchestrator:**
```xml
<report>
  <decisions>D-1</decisions>
  <recommendation>D-1</recommendation>
  <rationale>rate-limiter-flexible is production-ready and matches our Redis requirement</rationale>
</report>
```

**Gate:** User gate (standard complexity, library decision)

**Orchestrator → User:**
```
Creative proposed 1 approach:

[D-1] Use rate-limiter-flexible library
- Pros: Battle-tested, Redis support, minimal code
- Cons: External dependency

Alternatives considered:
- Custom implementation (more code, more maintenance)
- express-rate-limit (less flexible)

Recommendation: D-1 because it's production-ready and matches Redis requirement.

Approve?
```

**User:** "Approved"

```bash
node dist/skill-cli.js approve-decision \
  --task-id T-2 \
  --agent orchestrator \
  --decision-id D-1 \
  --notes "User approved" \
  --path /workspace
```

### Step 4: Planning

```bash
node dist/skill-cli.js set-plan \
  --task-id T-2 \
  --agent orchestrator \
  --goal "Implement rate limiting for API endpoints" \
  --approach "Use rate-limiter-flexible with Redis backend" \
  --steps '[
    {
      "title": "Install dependency",
      "description": "Add rate-limiter-flexible to package.json",
      "done_when": [
        "Package in package.json dependencies",
        "npm install completes successfully"
      ],
      "files": ["package.json", "package-lock.json"]
    },
    {
      "title": "Create rate limit middleware",
      "description": "Implement middleware using rate-limiter-flexible with Redis store",
      "done_when": [
        "File src/middleware/rate-limit.ts exists",
        "Exports rateLimitMiddleware function",
        "Configured for 100 req/min per IP",
        "Uses Redis client from src/lib/redis.ts"
      ],
      "files": ["src/middleware/rate-limit.ts"]
    },
    {
      "title": "Apply middleware to routes",
      "description": "Add rate limit middleware to Express app",
      "done_when": [
        "Middleware imported in src/app.ts",
        "Applied globally or to specific routes",
        "Existing endpoints still functional"
      ],
      "files": ["src/app.ts"]
    },
    {
      "title": "Add tests",
      "description": "Test rate limiting behavior",
      "done_when": [
        "Test file exists",
        "Tests verify 100 req/min limit",
        "Tests verify 429 response after limit",
        "All tests pass"
      ],
      "files": ["tests/middleware/rate-limit.test.ts"]
    }
  ]' \
  --path /workspace
```

### Step 5: Plan Verification (Pass 1)

**Verifier actions:**

```bash
# Verify files exist (plan targets)
glob "src/lib/redis.ts"
# Exists ✓

glob "src/middleware/auth.ts"
# Exists ✓ (pattern reference)

# Check if rate-limiter-flexible is already installed
rg "rate-limiter-flexible" package.json
# Not found ✓ (will be installed)

# Verify Redis client is usable
view src/lib/redis.ts
# Exports client ✓

# Check app.ts structure
view src/app.ts
# Middleware can be added ✓

# Validate plan steps
# All steps have clear done_when ✓
# Files are concrete paths ✓
```

**Verifier → Orchestrator:**
```xml
<critique>
  <status>approved</status>
  <pass>1</pass>
  <confidence>high</confidence>
  <issues></issues>
</critique>
```

**Gate:** Auto-proceed (standard complexity, approved plan, no issues)

### Step 6: Execution

**Executor implements Step 1-4 with interleaved verification:**

```bash
# Step 1: Install dependency
npm install rate-limiter-flexible
# Success ✓

node dist/skill-cli.js complete-step --task-id T-2 --agent executor --path /workspace
node dist/skill-cli.js advance-step --task-id T-2 --agent executor --path /workspace

# Step 2: Create middleware (interleaved)
# Unit 1: Imports (10 lines)
cat > src/middleware/rate-limit.ts << 'EOF'
import { RateLimiterRedis } from 'rate-limiter-flexible';
import { Request, Response, NextFunction } from 'express';
import { redisClient } from '../lib/redis';

const rateLimiter = new RateLimiterRedis({
  storeClient: redisClient,
  keyPrefix: 'ratelimit',
  points: 100, // requests
  duration: 60, // per 60 seconds
});
EOF

ide-get_diagnostics src/middleware/rate-limit.ts
# Clean ✓

# Unit 2: Middleware function (15 lines)
cat >> src/middleware/rate-limit.ts << 'EOF'

export async function rateLimitMiddleware(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  const ip = req.ip || 'unknown';
  
  try {
    await rateLimiter.consume(ip);
    next();
  } catch (error) {
    res.status(429).json({ error: 'Too many requests' });
  }
}
EOF

ide-get_diagnostics src/middleware/rate-limit.ts
# Clean ✓

npm run build
# Success ✓

# Log trail
node dist/skill-cli.js append-trail \
  --task-id T-2 \
  --agent executor \
  --marker DECISION \
  --summary "Used IP address as rate limit key" \
  --details '{"context":"Identify unique clients","options":["IP address","User ID","API key"],"choice":"IP address","rationale":"Works for both authenticated and anonymous requests, matches requirement"}' \
  --evidence '["F-1","D-1"]' \
  --path /workspace

# Update snippet
node dist/skill-cli.js add-snippet \
  --task-id T-2 \
  --agent executor \
  --path src/middleware/rate-limit.ts \
  --lines '{"start":1,"end":30}' \
  --content "$(cat src/middleware/rate-limit.ts)" \
  --purpose "Rate limiting middleware implementation" \
  --tags "middleware,rate-limit,created" \
  --path /workspace

node dist/skill-cli.js complete-step --task-id T-2 --agent executor --path /workspace
node dist/skill-cli.js advance-step --task-id T-2 --agent executor --path /workspace

# Step 3: Apply middleware
view src/app.ts
# Check structure

# Add import + middleware
# (edit commands...)

npm run build
# Success ✓

node dist/skill-cli.js complete-step --task-id T-2 --agent executor --path /workspace
node dist/skill-cli.js advance-step --task-id T-2 --agent executor --path /workspace

# Step 4: Tests
# (create tests, verify pass...)

node dist/skill-cli.js complete-step --task-id T-2 --agent executor --path /workspace
```

### Step 7: Result Verification (standard mode)

**Verifier actions:**

```bash
# Verify all files changed
glob "src/middleware/rate-limit.ts"
# Exists ✓

# Check implementation
view src/middleware/rate-limit.ts
# Uses rate-limiter-flexible ✓
# Configured 100/60s ✓
# Uses Redis client ✓

# Verify applied to app
rg "rateLimitMiddleware" src/app.ts
# Found ✓

# Run tests
npm test -- tests/middleware/rate-limit.test.ts
# All pass ✓

# Build
npm run build
# Success ✓

# Check existing endpoints still work
npm test
# All pass ✓
```

**Verifier → Orchestrator:**
```xml
<critique>
  <status>approved</status>
  <pass>1</pass>
  <confidence>high</confidence>
</critique>
```

**Gate:** Auto-complete (standard complexity, all checks pass)

### Summary

- Duration: ~15-20 minutes
- Phases: All standard phases
- Scout requests: 1 (external search for library)
- User gates: 1 (decision approval)
- Facts: 4, Snippets: 2, Decisions: 1, Trails: 1+
- Pass limits: Plan verified in 1 pass, result verified in 1 pass

---

## Example 3: Complex Task with Escalation (Complexity 7)

**Task:** Refactor authentication to support OAuth + JWT + magic link.

**Complexity:** 7 (Complex — architectural change, many files, novel patterns)

### Scenario: Result Verification Fails Twice

After execution, Verifier finds issues:

**Pass 1:**

```xml
<critique>
  <status>revision_required</status>
  <pass>1</pass>
  <critique>
    <issue>
      <severity>blocking</severity>
      <item>OAuth callback handler</item>
      <issue>Missing state parameter validation (CSRF vulnerability)</issue>
      <evidence>X-8#L45 no state check</evidence>
      <suggestion>Validate state matches session value before exchanging code</suggestion>
    </issue>
    <issue>
      <severity>blocking</severity>
      <item>JWT refresh logic</item>
      <issue>No token rotation on refresh</issue>
      <evidence>X-10#L30 reuses same refresh token</evidence>
      <suggestion>Issue new refresh token on each refresh request</suggestion>
    </issue>
  </critique>
</critique>
```

**Executor fixes issues:**

```bash
# Fix OAuth state validation
# Fix JWT rotation
# Re-run tests
```

**Pass 2:**

```xml
<critique>
  <status>revision_required</status>
  <pass>2</pass>
  <critique>
    <issue>
      <severity>blocking</severity>
      <item>OAuth callback</item>
      <issue>State validation still bypassable if session is empty</issue>
      <evidence>X-8#L47 doesn't check if state exists</evidence>
      <suggestion>Require state in session, reject if missing</suggestion>
    </issue>
  </critique>
</critique>
```

**Max passes exceeded (2) → Escalation:**

```bash
node dist/skill-cli.js raise-alert \
  --task-id T-3 \
  --agent orchestrator \
  --severity blocker \
  --title "Result verification failed after 2 passes" \
  --description "OAuth state validation issue persists after fixes.

Pass 1 issues:
- Missing state parameter validation ✓ FIXED
- No token rotation ✓ FIXED

Pass 2 issues:
- State validation bypassable if session empty ✗ PERSISTS

Attempted:
- Added state check (X-8#L47)
- Added session validation
- Issue: Edge case when session expires between auth start and callback

Options:
A. Accept current state — Document limitation that auth fails if session expires (low risk)
B. Add Redis-based state store — More robust but adds complexity (1-2 more steps)
C. Reject auth if no session — Simpler but worse UX (user must restart flow)

Recommendation: Option B — Security-critical feature justifies extra complexity" \
  --tags "escalation,verification,security,user_decision" \
  --path /workspace
```

**Orchestrator → User:**

```
Verification failed after 2 passes on OAuth security issue.

Issue: State validation bypassable if session expires during OAuth flow.

Options:
A. Accept with documentation (fastest, low risk)
B. Add Redis state store (more robust, +2 steps)
C. Reject auth if no session (simpler, worse UX)

Recommendation: B (Redis state store) because this is a security-critical feature.

How should I proceed?
```

**User:** "Go with option B"

**Orchestrator:**
1. Resolves alert
2. Updates plan (adds 2 steps)
3. Re-invokes Executor
4. Re-verifies → passes

---

## Example 4: Exec Mode — Multi-Step Query

**Scenario:** Orchestrator checks if ready to proceed from exploration to ideation.

```bash
node dist/skill-cli.js exec \
  --task-id T-1 \
  --agent orchestrator \
  --code '
    // Check exploration completeness
    const facts = board.getFacts({ confidence: ["high", "medium"] });
    const snippets = board.getSnippets();
    const alerts = board.getAlerts({ status: "active", severity: "blocker" });
    
    // Check for blocking questions (scout_requests pattern)
    const scoutFacts = board.getFacts({ agent: "scout" });
    const hasBlockingQuestions = scoutFacts.some(f => 
      f.content.toLowerCase().includes("question") || 
      f.tags?.includes("blocking_question")
    );
    
    // Determine if ready
    const ready = 
      facts.length >= 3 && 
      snippets.length >= 2 && 
      alerts.length === 0 && 
      !hasBlockingQuestions;
    
    return {
      ready,
      reason: ready ? "Sufficient context to proceed" : "Need more exploration",
      facts_count: facts.length,
      snippets_count: snippets.length,
      active_blockers: alerts.length,
      has_blocking_questions: hasBlockingQuestions,
      next_action: ready ? "invoke_creative" : "request_user_input"
    };
  ' \
  --path /workspace
```

**Returns:**
```json
{
  "result": {
    "ready": true,
    "reason": "Sufficient context to proceed",
    "facts_count": 5,
    "snippets_count": 3,
    "active_blockers": 0,
    "has_blocking_questions": false,
    "next_action": "invoke_creative"
  }
}
```

---

## Example 5: Exec Mode — Snippet-First Pattern

**Scenario:** Executor checks if snippets exist before reading files.

```bash
node dist/skill-cli.js exec \
  --task-id T-1 \
  --agent executor \
  --code '
    // Get current step from plan
    const plan = board.getPlan();
    const currentStep = plan.steps[plan.current_step - 1];
    
    // Check snippets for each file
    const snippetsNeeded = [];
    const snippetsAvailable = [];
    
    for (const file of currentStep.files) {
      const snippets = board.getSnippets({ path: file });
      if (snippets.length === 0) {
        snippetsNeeded.push(file);
      } else {
        snippetsAvailable.push({
          file,
          snippet_id: snippets[0].id,
          lines: snippets[0].lines,
          purpose: snippets[0].purpose
        });
      }
    }
    
    return {
      step: currentStep.title,
      files: currentStep.files,
      snippets_available: snippetsAvailable,
      snippets_needed: snippetsNeeded,
      ready_to_code: snippetsNeeded.length === 0,
      action: snippetsNeeded.length > 0 
        ? `Read files: ${snippetsNeeded.join(", ")}` 
        : "Start coding with available snippets"
    };
  ' \
  --path /workspace
```

**Returns:**
```json
{
  "result": {
    "step": "Add POST /auth/magic endpoint",
    "files": ["src/routes/auth.ts", "src/auth/token.ts"],
    "snippets_available": [
      {
        "file": "src/auth/token.ts",
        "snippet_id": "X-1",
        "lines": {"start": 1, "end": 50},
        "purpose": "Token generation logic"
      }
    ],
    "snippets_needed": ["src/routes/auth.ts"],
    "ready_to_code": false,
    "action": "Read files: src/routes/auth.ts"
  }
}
```

---

## Example 6: Exec Mode — Search + Filter Pattern

**Scenario:** Creative searches for authentication-related context before proposing approach.

```bash
node dist/skill-cli.js exec \
  --task-id T-1 \
  --agent creative \
  --code '
    // Search for auth-related entities
    const searchResults = board.search({ 
      text: "authentication auth jwt token", 
      types: ["facts", "snippets", "decisions"],
      limit: 20 
    });
    
    // Group by type
    const byType = searchResults.reduce((acc, r) => {
      if (!acc[r.type]) acc[r.type] = [];
      acc[r.type].push(r);
      return acc;
    }, {});
    
    // Get high-confidence facts about auth
    const authFacts = (byType.facts || [])
      .map(f => board.getFacts().find(fact => fact.fact_id === f.id))
      .filter(f => f && f.confidence === "high");
    
    // Get snippets with auth patterns
    const authSnippets = (byType.snippets || [])
      .map(s => board.getSnippets().find(snip => snip.snippet_id === s.id))
      .filter(s => s && s.tags?.includes("pattern"));
    
    // Check for existing decisions
    const existingDecisions = byType.decisions || [];
    
    return {
      search_results_count: searchResults.length,
      high_confidence_facts: authFacts.length,
      pattern_snippets: authSnippets.length,
      existing_decisions: existingDecisions.length,
      context_sufficient: authFacts.length >= 2 && authSnippets.length >= 1,
      facts: authFacts.map(f => ({ id: f.fact_id, content: f.content })),
      patterns: authSnippets.map(s => ({ id: s.snippet_id, path: s.path, purpose: s.purpose }))
    };
  ' \
  --path /workspace
```

**Returns:**
```json
{
  "result": {
    "search_results_count": 12,
    "high_confidence_facts": 3,
    "pattern_snippets": 2,
    "existing_decisions": 0,
    "context_sufficient": true,
    "facts": [
      {"id": "F-1", "content": "Express 4.18.2 for routing"},
      {"id": "F-4", "content": "JWT pattern in X-1#L45"},
      {"id": "F-6", "content": "Redis available for session"}
    ],
    "patterns": [
      {"id": "X-1", "path": "src/auth/jwt.ts", "purpose": "JWT auth pattern"},
      {"id": "X-3", "path": "src/middleware/auth.ts", "purpose": "Middleware pattern"}
    ]
  }
}
```

---

## Key Takeaways from Examples

### Example 1 (Simple):
- Collapsed workflow (skip Creative, skip plan_verify)
- Auto-gates throughout
- Minimal tool calls (5-8 per agent)
- Duration: 3-5 minutes

### Example 2 (Standard):
- Full workflow with Scout requests
- User gate at decision approval
- Creative asks Scout for external info
- Duration: 15-20 minutes

### Example 3 (Complex):
- Max passes enforced (2)
- Escalation with structured options
- User makes final call
- Plan updated mid-execution

### Example 4-6 (Exec Mode):
- Complex queries in single call
- Multi-entity coordination
- Context-aware decision making
- Efficient alternative to multiple CLI calls

---

## CLI Command Patterns

### Quick Fact Addition
```bash
node dist/skill-cli.js add-fact \
  --task-id T-1 --agent scout \
  --content "..." \
  --confidence high \
  --evidence '[{"type":"file","reference":"...","excerpt":"..."}]' \
  --path /workspace
```

### Snippet After File Edit
```bash
node dist/skill-cli.js add-snippet \
  --task-id T-1 --agent executor \
  --path src/auth/token.ts \
  --lines '{"start":1,"end":50}' \
  --content "$(cat src/auth/token.ts | head -50)" \
  --purpose "Token generation (UPDATED)" \
  --tags "auth,target,modified" \
  --path /workspace
```

### Decision Proposal
```bash
node dist/skill-cli.js propose-decision \
  --task-id T-1 --agent creative \
  --title "..." \
  --description "..." \
  --rationale "..." \
  --alternatives '[...]' \
  --path /workspace
```

### Trail Logging
```bash
node dist/skill-cli.js append-trail \
  --task-id T-1 --agent executor \
  --marker DECISION \
  --summary "..." \
  --details '{"context":"...","choice":"...","rationale":"..."}' \
  --evidence '["X-1#L45","F-3"]' \
  --path /workspace
```

### Search
```bash
node dist/skill-cli.js search "auth token" \
  --task-id T-1 \
  --types facts,snippets \
  --limit 10 \
  --path /workspace
```

---

These examples demonstrate real-world workflows with actual commands, showing how the board coordinates multi-agent workflows from simple to complex scenarios.
