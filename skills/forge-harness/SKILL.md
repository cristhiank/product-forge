# forge-harness — Forge Agentic Flywheel Toolkit

Deterministic metrics collection, codebase garbage collection, and harness changelog management for the Forge agent system. Part of the agentic flywheel: agents produce data, retrospective mode analyzes it, harness improves.

## Concepts

**Harness** — The collection of mode files, quality gates, engineering preferences, and templates that shape how Forge subagents operate. When output is unsatisfying, improve the harness — not just the artifact.

**Flywheel** — Metrics from each run feed back into retrospective analysis, which proposes harness patches. The system improves itself over time.

**Why Loop / How Loop** — The coordinator owns the why loop (user intent → outcomes). Subagents run the how loop (producing artifacts). This toolkit instruments the how loop.

Reference: [Humans and Agents](https://martinfowler.com/articles/exploring-gen-ai/humans-and-agents.html) — Martin Fowler

---

## Quick Start

```bash
HARNESS="node <skill-dir>/scripts/index.js"

# Log a metric
$HARNESS exec --code 'return harness.metrics.log({ runId: "run-42", metric: "dispatch", value: "explore", mode: "explore" })'

# Query recent metrics
$HARNESS exec --code 'return harness.metrics.query({ since: "7d" })'

# Run a GC scan
$HARNESS exec --code 'return harness.gc.scan({ type: "debt" })'

# Check harness health
$HARNESS exec --code 'return harness.health()'
```

---

## Invocation

All operations go through exec. The `harness` object is pre-loaded in a sandboxed VM.

```bash
$HARNESS exec --code '<javascript>'      # Via flag
$HARNESS exec '<javascript>'             # Positional arg
$HARNESS exec --code '...' --timeout 15000  # Custom timeout (ms)
$HARNESS exec --code '...' --pretty      # Pretty-print JSON output
```

**Sandbox restrictions:**
- Available globals: `harness`, `console`, `JSON`, `Math`, `Date`, `Promise`, `Array`, `Object`, `String`, `Number`, `Boolean`, `Map`, `Set`, `parseInt`, `parseFloat`
- Blocked: `require`, `import`, `fetch`, `setTimeout`, `setInterval`, `process`, file system
- Default timeout: 10000ms

**Output format:**
```json
{ "success": true, "result": <return_value>, "execution_time_ms": 45 }
{ "success": false, "error": "message", "execution_time_ms": 0 }
```

---

## API Reference

### harness.metrics — Run Metrics

Track verification results, retries, scope drift, user satisfaction, and other flywheel signals.

```javascript
// Log a metric entry
harness.metrics.log({
  runId: "run-42",         // Required — forge run ID
  metric: "verify_result", // Required — metric name
  value: "pass",           // Required — metric value
  mode: "verify",          // Optional — forge mode that produced this
  tier: "T3",              // Optional — complexity tier
  sessionId: "abc-123"     // Optional — session ID
})

// Query metrics with filters
harness.metrics.query({
  runId: "run-42",     // Filter by run ID
  since: "7d",         // Filter by time: "30d", "24h", "60m"
  mode: "verify",      // Filter by mode
  metric: "verify_result", // Filter by metric name
  limit: 50            // Max results
})

// Get aggregated summary
harness.metrics.summary()              // All runs
harness.metrics.summary({ runId: "run-42" }) // Specific run
// Returns: { totalRuns, totalEntries, passRate, avgRetries, scopeDriftRate, correctionRate, byMetric }

// Aggregate by mode
harness.metrics.aggregateByMode()
// Returns: { [mode]: { runs, passRate, avgRetries, avgCorrections } }
```

**Standard metric names:**

| Metric | Values | When to log |
|--------|--------|-------------|
| `dispatch` | mode name | On every subagent dispatch |
| `verify_result` | `pass`, `fail`, `revision_required` | After VERIFY completes |
| `retry_count` | number as string | On retry |
| `scope_drift` | `true`, `false` | After scope drift check |
| `correction_count` | number as string | After execution with CORRECTION markers |
| `user_signal` | `positive`, `negative`, `neutral` | On user satisfaction signal |
| `turns_to_completion` | number as string | On task completion |

### harness.gc — Garbage Collection Scanner

Deterministic codebase scans for debt, stale docs, and dead exports. Results are persisted for trending.

```javascript
// Run a scan
harness.gc.scan({ type: "debt" })           // TODO/FIXME/HACK/XXX catalog
harness.gc.scan({ type: "stale-docs" })     // README vs actual code cross-ref
harness.gc.scan({ type: "dead-exports" })   // Unused TS/JS export detection
harness.gc.scan({ type: "all" })            // Run all scan types
harness.gc.scan({ type: "debt", path: "./src" }) // Scope to a directory

// Query persisted findings
harness.gc.getFindings()                              // All findings
harness.gc.getFindings({ severity: "warning" })       // By severity
harness.gc.getFindings({ type: "debt", limit: 20 })   // By type + limit

// Clear old findings
harness.gc.clearFindings()                             // Clear all
harness.gc.clearFindings({ olderThan: "2026-01-01" })  // Clear before date
```

**Scan types:**

| Type | What it finds | Severity |
|------|--------------|----------|
| `debt` | TODO, FIXME, HACK, XXX, WORKAROUND, TEMP comments | FIXME/HACK → warning, others → info |
| `stale-docs` | README references to non-existent files, broken links | warning |
| `dead-exports` | Named exports used only at declaration site | info |

### harness.changelog — Harness Version Tracking

Track changes to mode files, quality gates, and engineering preferences.

```javascript
// Add a changelog entry (also appends to the actual mode file)
harness.changelog.add({
  modeFile: "execute.md",
  entry: "Tightened scope drift check to flag >1.3x expected line count"
})

// View changelogs
harness.changelog.show()                          // All mode files
harness.changelog.show({ modeFile: "execute.md" }) // Specific file

// Recent entries across all files
harness.changelog.recent()               // Last 20
harness.changelog.recent({ limit: 5 })   // Last 5

// Initialize changelog sections in all mode files
harness.changelog.init()
```

### harness.health — Harness Health

Aggregated health report combining metrics and GC data.

```javascript
// Full health report
harness.health()
// Returns: {
//   metricsCount, lastGcScan, suggestGc, runsSinceLastGc,
//   recentFailRate, recentEntries, gcFindingsCount
// }

// Should we run GC?
harness.health.suggestGc()
// Returns: { suggest: true/false, reason: "...", runsSinceLastGc: N }
```

---

## Compositional Patterns

The exec API supports multi-step workflows in a single call. This is the primary advantage over CLI subcommands.

### Retrospective data gathering

```javascript
// Gather all context for a retrospective in one call
const run = await harness.metrics.query({ runId: "run-42" });
const history = await harness.metrics.query({ since: "30d", metric: "verify_result" });
const failRate = history.filter(m => m.value === "fail").length / history.length;
const gc = failRate > 0.3 ? harness.gc.scan({ type: "all" }) : null;
const changes = harness.changelog.recent({ limit: 10 });
return { run, history, failRate, gc, changes };
```

### Post-dispatch metrics logging

```javascript
// Log multiple metrics for a completed run
harness.metrics.log({ runId: "run-42", metric: "dispatch", value: "execute", mode: "execute", tier: "T3" });
harness.metrics.log({ runId: "run-42", metric: "verify_result", value: "pass", mode: "verify" });
harness.metrics.log({ runId: "run-42", metric: "turns_to_completion", value: "5", mode: "execute" });
return harness.metrics.summary({ runId: "run-42" });
```

### Periodic health check with conditional GC

```javascript
const health = harness.health();
if (health.suggestGc) {
  const findings = harness.gc.scan({ type: "all" });
  return { health, gcRan: true, findings };
}
return { health, gcRan: false };
```

### Changelog after harness patch

```javascript
harness.changelog.add({ modeFile: "verify.md", entry: "Added scope drift line-count check (retrospective finding)" });
harness.changelog.add({ modeFile: "execute.md", entry: "Reduced T3 code cadence from 20 to 15 lines" });
return harness.changelog.recent({ limit: 5 });
```

---

## Data Storage

All data is persisted to `.git/forge/harness.db` (SQLite with WAL mode). This location:
- Is never git-tracked (inside `.git/`)
- Survives session restarts
- Is per-repository (each repo has its own flywheel data)
- Is consistent with agents-hub pattern (`.git/devpartner/`)

---

## Integration Points

### Coordinator (forge.agent.md / forge-gpt.agent.md)

The coordinator logs metrics at dispatch and verification time. Load this skill in the coordinator context to enable flywheel tracking.

### Retrospective Mode

After a failed verification or user rejection, retrospective mode queries metrics history to identify patterns and propose harness patches.

### GC Mode

GC mode calls `harness.gc.scan()` for deterministic findings, then adds LLM analysis for priority and context.

### Memory Mode

Enhanced memory mode checks if session learnings suggest harness improvements and logs changes via `harness.changelog.add()`.
