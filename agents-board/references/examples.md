# Board Usage Examples

Generic examples showing how to use the agents-board for multi-agent collaboration. The board is **workflow-agnostic** — use any agent names, any workflow phases, any coordination pattern.

**Note:** Examples use generic role names like `agent-a`, `researcher`, `implementer`. Replace these with your own agent architecture.

---

## Example 1: Basic Workflow

A simple end-to-end workflow showing core board operations.

### Step 1: Create Task

```bash
node scripts/board.js create-task \
  --goal "Add user profile endpoint" \
  --context "Expose GET /api/users/:id endpoint with caching" \
  --constraints '["Must reuse existing auth middleware","Cache TTL 5 minutes"]' \
  --path /workspace

# Returns: {"result": {"task_id": "T-1", "status": "setup"}}
```

### Step 2: Add Facts

Multiple agents can contribute facts about the codebase.

```bash
# Agent A discovers framework
node scripts/board.js add-fact \
  --task-id T-1 \
  --agent researcher \
  --content "Codebase uses Express 4.18.2 with custom middleware pipeline" \
  --confidence high \
  --evidence '[{"type":"file","reference":"package.json#L12","excerpt":"express: 4.18.2"}]' \
  --tags "framework,http" \
  --path /workspace

# Agent B discovers caching layer
node scripts/board.js add-fact \
  --task-id T-1 \
  --agent researcher \
  --content "Redis client configured at src/cache/redis.ts with 5min default TTL" \
  --confidence high \
  --evidence '[{"type":"file","reference":"src/cache/redis.ts#L8","excerpt":"DEFAULT_TTL = 300"}]' \
  --tags "cache,redis,config" \
  --path /workspace

# Agent C discovers auth pattern
node scripts/board.js add-fact \
  --task-id T-1 \
  --agent researcher \
  --content "Auth middleware at src/middleware/auth.ts exports requireAuth function" \
  --confidence high \
  --evidence '[{"type":"file","reference":"src/middleware/auth.ts#L15","excerpt":"export const requireAuth = ..."}]' \
  --tags "auth,middleware,pattern" \
  --path /workspace
```

### Step 3: Cache Snippets

```bash
# Cache auth middleware for implementer to reference
node scripts/board.js add-snippet \
  --task-id T-1 \
  --agent researcher \
  --path src/middleware/auth.ts \
  --lines '{"start":15,"end":30}' \
  --content "$(cat src/middleware/auth.ts | sed -n '15,30p')" \
  --purpose "Auth middleware pattern to reuse" \
  --tags "auth,middleware,pattern" \
  --path /workspace

# Returns: {"result": {"snippet_id": "X-1"}}
```

### Step 4: Search for Related Content

```bash
# Find all auth-related facts and snippets
node scripts/board.js search "authentication middleware" \
  --task-id T-1 \
  --types facts,snippets \
  --tags auth \
  --limit 10 \
  --path /workspace

# Returns ranked results across facts and snippets
```

### Step 5: Create Plan

```bash
node scripts/board.js set-plan \
  --task-id T-1 \
  --agent planner \
  --goal "Add user profile endpoint" \
  --approach "Create new route with auth middleware and Redis caching" \
  --steps '[
    {
      "title": "Create route handler",
      "description": "Add GET /api/users/:id to src/routes/users.ts",
      "done_when": ["Route registered", "Uses requireAuth middleware", "Returns user profile JSON"],
      "files": ["src/routes/users.ts"]
    },
    {
      "title": "Add caching layer",
      "description": "Wrap handler with Redis cache using existing client",
      "done_when": ["Cache hit returns cached data", "Cache miss fetches and stores", "TTL set to 5 minutes"],
      "files": ["src/routes/users.ts", "src/cache/redis.ts"]
    },
    {
      "title": "Add tests",
      "description": "Unit tests for route and caching behavior",
      "done_when": ["Auth test passes", "Cache hit test passes", "Cache miss test passes"],
      "files": ["tests/routes/users.test.ts"]
    }
  ]' \
  --path /workspace

# Returns: {"result": {"plan_id": "P-1", "total_steps": 3, "current_step": 0}}
```

### Step 6: Execute Steps

```bash
# Implementer advances to step 1
node scripts/board.js advance-step \
  --task-id T-1 \
  --agent implementer \
  --path /workspace

# ... implementer does work ...

# Mark step complete
node scripts/board.js complete-step \
  --task-id T-1 \
  --agent implementer \
  --notes "Route created, uses requireAuth from X-1 pattern" \
  --path /workspace

# Log decision trail
node scripts/board.js append-trail \
  --task-id T-1 \
  --agent implementer \
  --marker DECISION \
  --summary "Used existing requireAuth middleware instead of creating new" \
  --details '{"context":"Need auth protection","options":["Create new middleware","Reuse requireAuth"],"choice":"Reuse requireAuth","rationale":"Matches existing pattern in X-1"}' \
  --evidence '["X-1#L15-30","F-3"]' \
  --path /workspace
```

### Step 7: Quick Status Check

```bash
node scripts/board.js view \
  --task-id T-1 \
  --path /workspace

# Returns:
# {
#   "result": {
#     "task_id": "T-1",
#     "status": "in_progress",
#     "facts_count": 3,
#     "snippets_count": 1,
#     "decisions_count": 0,
#     "alerts_count": 0,
#     "current_step": 2,
#     "total_steps": 3
#   }
# }
```

---

## Example 2: Multi-Agent Collaboration

Two agents working in parallel, sharing knowledge through the board.

### Agent A: Explores Database Layer

```bash
# Agent A finds database info
node scripts/board.js add-fact \
  --task-id T-1 \
  --agent agent-a \
  --content "PostgreSQL 14 with Prisma ORM, User model defined in schema.prisma" \
  --confidence high \
  --evidence '[{"type":"file","reference":"prisma/schema.prisma#L10-25","excerpt":"model User {...}"}]' \
  --tags "database,prisma,schema" \
  --path /workspace

# Agent A caches schema snippet
node scripts/board.js add-snippet \
  --task-id T-1 \
  --agent agent-a \
  --path prisma/schema.prisma \
  --lines '{"start":10,"end":25}' \
  --content "model User {\n  id String @id\n  email String @unique\n  name String?\n}" \
  --purpose "User model schema for implementer" \
  --tags "database,schema,user" \
  --path /workspace
```

### Agent B: Explores API Layer

```bash
# Agent B finds API patterns (parallel with Agent A)
node scripts/board.js add-fact \
  --task-id T-1 \
  --agent agent-b \
  --content "API routes follow REST pattern in src/routes/, use async/await with try/catch" \
  --confidence high \
  --evidence '[{"type":"file","reference":"src/routes/posts.ts#L5-20","excerpt":"router.get(/, async (req, res) => { try {...} catch {...} })"}]' \
  --tags "api,pattern,error-handling" \
  --path /workspace

# Agent B caches error handling pattern
node scripts/board.js add-snippet \
  --task-id T-1 \
  --agent agent-b \
  --path src/routes/posts.ts \
  --lines '{"start":5,"end":20}' \
  --content "router.get('/', async (req, res) => {\n  try {\n    const posts = await db.post.findMany();\n    res.json(posts);\n  } catch (err) {\n    res.status(500).json({ error: err.message });\n  }\n});" \
  --purpose "Error handling pattern for implementer" \
  --tags "api,pattern,error-handling" \
  --path /workspace
```

### Agent C: Reads Both Agents' Work

```bash
# Agent C uses exec mode to combine both findings
node scripts/board.js exec \
  --task-id T-1 \
  --agent agent-c \
  --code '
    const facts = board.getFacts({ confidence: ["high"] });
    const dbFacts = facts.filter(f => f.tags?.includes("database"));
    const apiFacts = facts.filter(f => f.tags?.includes("api"));
    
    const snippets = board.getSnippets({});
    const dbSnippets = snippets.filter(s => s.tags?.includes("schema"));
    const apiSnippets = snippets.filter(s => s.tags?.includes("pattern"));
    
    return {
      db_info: {
        facts: dbFacts.map(f => f.fact_id),
        snippets: dbSnippets.map(s => s.snippet_id)
      },
      api_info: {
        facts: apiFacts.map(f => f.fact_id),
        snippets: apiSnippets.map(s => s.snippet_id)
      },
      ready_to_implement: dbSnippets.length > 0 && apiSnippets.length > 0
    };
  ' \
  --path /workspace

# Agent C now has complete context from both A and B without re-reading files
```

---

## Example 3: Exec Mode Patterns

Complex queries using the JavaScript API.

### Pattern 1: Conditional Readiness Check

```bash
node scripts/board.js exec \
  --task-id T-1 \
  --agent coordinator \
  --code '
    const plan = board.getPlan();
    const facts = board.getFacts({ confidence: ["high"] });
    const snippets = board.getSnippets({});
    const alerts = board.getAlerts({ status: "active", severity: "blocker" });
    
    if (alerts.length > 0) {
      return {
        ready: false,
        reason: "Blocker alerts unresolved",
        blockers: alerts.map(a => a.alert_id)
      };
    }
    
    if (!plan) {
      return { ready: false, reason: "No plan created" };
    }
    
    if (facts.length < 3) {
      return {
        ready: false,
        reason: "Insufficient exploration",
        facts_needed: 3 - facts.length
      };
    }
    
    return {
      ready: true,
      facts: facts.length,
      snippets: snippets.length,
      current_step: plan.current_step
    };
  ' \
  --path /workspace
```

### Pattern 2: Gap Analysis

```bash
node scripts/board.js exec \
  --task-id T-1 \
  --agent coordinator \
  --code '
    const plan = board.getPlan();
    if (!plan || plan.current_step === 0) {
      return { status: "no_plan" };
    }
    
    const currentStep = plan.steps[plan.current_step - 1];
    const gaps = [];
    
    // Check if we have snippets for all files in current step
    for (const file of currentStep.files) {
      const snippets = board.getSnippets({ path: file });
      if (snippets.length === 0) {
        gaps.push({
          type: "missing_snippet",
          file: file,
          step: currentStep.title
        });
      }
    }
    
    // Check for related facts
    const facts = board.getFacts({ confidence: ["high"] });
    const relevantFacts = facts.filter(f =>
      currentStep.files.some(file =>
        f.evidence?.some(e => e.reference?.includes(file))
      )
    );
    
    if (relevantFacts.length === 0) {
      gaps.push({
        type: "no_related_facts",
        step: currentStep.title,
        files: currentStep.files
      });
    }
    
    return {
      step: currentStep.title,
      gaps: gaps,
      ready: gaps.length === 0,
      relevant_facts: relevantFacts.map(f => f.fact_id)
    };
  ' \
  --path /workspace
```

### Pattern 3: Cross-Entity Search

```bash
node scripts/board.js exec \
  --task-id T-1 \
  --agent researcher \
  --code '
    // Search for "cache" across all entity types
    const searchResults = board.search({
      text: "cache redis",
      types: ["facts", "snippets", "decisions", "trails"],
      limit: 20
    });
    
    // Group by entity type
    const byType = searchResults.reduce((acc, result) => {
      if (!acc[result.type]) {
        acc[result.type] = [];
      }
      acc[result.type].push({
        id: result.id,
        rank: result.rank,
        preview: result.content?.substring(0, 100) || result.path
      });
      return acc;
    }, {});
    
    // Find highest-ranked result of each type
    const topByType = {};
    for (const [type, results] of Object.entries(byType)) {
      topByType[type] = results.sort((a, b) => b.rank - a.rank)[0];
    }
    
    return {
      total_results: searchResults.length,
      by_type: Object.keys(byType).reduce((acc, k) => {
        acc[k] = byType[k].length;
        return acc;
      }, {}),
      top_match_per_type: topByType
    };
  ' \
  --path /workspace
```

---

## Example 4: Search Patterns

Using full-text search with filters.

### Search 1: Find All Authentication-Related Content

```bash
# Keyword search across facts and snippets
node scripts/board.js search "authentication jwt token" \
  --task-id T-1 \
  --types facts,snippets \
  --limit 10 \
  --path /workspace

# Returns BM25-ranked results:
# [
#   {
#     "type": "fact",
#     "id": "F-3",
#     "content": "JWT tokens used for authentication in src/auth/jwt.ts",
#     "rank": 0.95,
#     "highlights": ["<b>authentication</b> ... <b>JWT</b> <b>tokens</b>"]
#   },
#   {
#     "type": "snippet",
#     "id": "X-2",
#     "path": "src/auth/jwt.ts",
#     "purpose": "JWT token generation and validation",
#     "rank": 0.87
#   }
# ]
```

### Search 2: Filter by Tags

```bash
# Find high-confidence facts tagged with "security"
node scripts/board.js search "validation input" \
  --task-id T-1 \
  --types facts \
  --tags security,validation \
  --limit 5 \
  --path /workspace
```

### Search 3: Decision Trails

```bash
# Find all decisions related to database
node scripts/board.js search "database schema migration" \
  --task-id T-1 \
  --types decisions,trails \
  --limit 10 \
  --path /workspace

# Returns decisions and trail entries that mention database
```

### Search 4: Combine with Exec for Post-Processing

```bash
node scripts/board.js exec \
  --task-id T-1 \
  --agent researcher \
  --code '
    // Search for error handling patterns
    const results = board.search({
      text: "error handling try catch",
      types: ["snippets", "facts"],
      limit: 20
    });
    
    // Filter to only snippets with rank > 0.7
    const highQualitySnippets = results
      .filter(r => r.type === "snippet" && r.rank > 0.7)
      .map(r => ({
        snippet_id: r.id,
        path: r.path,
        rank: r.rank,
        tags: r.tags
      }));
    
    // Get full snippet details for top match
    const topSnippetId = highQualitySnippets[0]?.snippet_id;
    const topSnippet = topSnippetId 
      ? board.getSnippets({}).find(s => s.snippet_id === topSnippetId)
      : null;
    
    return {
      total_results: results.length,
      high_quality_snippets: highQualitySnippets.length,
      top_match: topSnippet ? {
        id: topSnippet.snippet_id,
        path: topSnippet.path,
        purpose: topSnippet.purpose,
        lines: topSnippet.lines
      } : null
    };
  ' \
  --path /workspace
```

---

## Example 5: Alert Management

Handling blockers and escalations.

### Raise Alert

```bash
node scripts/board.js raise-alert \
  --task-id T-1 \
  --agent implementer \
  --severity blocker \
  --title "Missing dependency: ioredis" \
  --description "Redis caching requires ioredis package which is not installed.

Current error:
  Error: Cannot find module 'ioredis'

Options:
1. Install ioredis: npm install ioredis
2. Use alternative caching (memory-based)
3. Skip caching for now" \
  --tags "dependency,blocker,redis" \
  --path /workspace

# Returns: {"result": {"alert_id": "A-1", "severity": "blocker", "status": "active"}}
```

### Check Active Alerts

```bash
# Coordinator checks for blockers
node scripts/board.js exec \
  --task-id T-1 \
  --agent coordinator \
  --code '
    const alerts = board.getAlerts({ status: "active" });
    const blockers = alerts.filter(a => a.severity === "blocker");
    const warnings = alerts.filter(a => a.severity === "warning");
    
    return {
      total_alerts: alerts.length,
      blockers: blockers.map(a => ({
        id: a.alert_id,
        title: a.title,
        created_by: a.created_by
      })),
      warnings: warnings.map(a => ({
        id: a.alert_id,
        title: a.title
      }))
    };
  ' \
  --path /workspace
```

### Resolve Alert

```bash
node scripts/board.js resolve-alert \
  --task-id T-1 \
  --agent coordinator \
  --alert-id A-1 \
  --resolution "Installed ioredis@5.3.2 via npm. Build now passes." \
  --path /workspace
```

---

## Example 6: Decision Workflow

Proposing, reviewing, and approving decisions.

### Propose Decision

```bash
node scripts/board.js propose-decision \
  --task-id T-1 \
  --agent planner \
  --title "Use Redis for session storage" \
  --description "Store user sessions in Redis with 24hr TTL instead of in-memory" \
  --rationale "Scalable across multiple server instances, automatic expiry, battle-tested" \
  --alternatives '[
    {
      "title": "PostgreSQL sessions table",
      "pros": "Single data store, ACID guarantees",
      "cons": "Slower, manual cleanup needed, higher DB load"
    },
    {
      "title": "In-memory sessions",
      "pros": "Fast, simple",
      "cons": "Lost on restart, not scalable"
    }
  ]' \
  --tags "architecture,sessions,redis" \
  --path /workspace

# Returns: {"result": {"decision_id": "D-1", "status": "proposed"}}
```

### Review and Approve

```bash
# Coordinator reviews
node scripts/board.js exec \
  --task-id T-1 \
  --agent coordinator \
  --code '
    const decisions = board.getDecisions({ status: "proposed" });
    
    // Check if we have Redis facts
    const facts = board.getFacts({ confidence: ["high"] });
    const redisFacts = facts.filter(f => 
      f.tags?.includes("redis") || f.content.toLowerCase().includes("redis")
    );
    
    return {
      pending_decisions: decisions.length,
      decisions: decisions.map(d => ({
        id: d.decision_id,
        title: d.title,
        proposed_by: d.created_by
      })),
      redis_context_available: redisFacts.length > 0,
      redis_facts: redisFacts.map(f => f.fact_id)
    };
  ' \
  --path /workspace

# Approve decision
node scripts/board.js approve-decision \
  --task-id T-1 \
  --agent coordinator \
  --decision-id D-1 \
  --notes "Approved. Redis client already configured per F-2. Aligns with scalability requirements." \
  --path /workspace
```

---

## Summary

These examples show the board as a **generic shared blackboard**:

- **Any agent** can add facts, snippets, decisions, alerts, trails
- **No prescribed workflow** — agents coordinate however makes sense for your task
- **Search across everything** — FTS5 full-text search with ranking
- **Exec mode** — JavaScript API for complex queries and logic
- **Role-agnostic** — use your own agent names (researcher, planner, implementer, etc.)

The board provides **shared memory and coordination primitives**. Your agents define the workflow.
