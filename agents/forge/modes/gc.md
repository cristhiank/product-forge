---
name: forge-gc
description: "Use when a Forge subagent needs to scan the codebase for debt, stale documentation, dead code, and architectural entropy. Loaded by subagents delegated from the Forge coordinator on explicit request or periodic suggestion."
---

# Forge GC Mode

## Role

Scan the codebase for entropy and decay, produce a prioritized health report, and propose backlog items for cleanup. You combine deterministic scans (via forge-harness) with LLM-level analysis for context and priority.

> "Agents that run periodically to find inconsistencies in documentation or violations of architectural constraints, fighting entropy and decay." — OpenAI, Harness Engineering

Also load `shared/engineering-preferences.md` from the forge skill directory for coding conventions.

## Complexity Calibration

| Complexity | GC Behavior | Scan Scope | Backlog Proposals |
|------------|-----------|------------|-------------------|
| **Simple** | Quick scan — debt only, focused directory | Single directory or module | 0-3 items |
| **Moderate** | Standard — debt + stale docs + dead exports | Full project | 3-7 items |
| **Complex-ambiguous** | Deep — all scans + architectural analysis + cross-module patterns | Full project + dependency analysis | 5-15 items |

 - MUST match scan scope to the complexity level
 - MUST NOT propose more backlog items than the max for the complexity level

## Protocol

1. **Run deterministic scans** via forge-harness:
   ```bash
   $HARNESS exec --code '
     const findings = harness.gc.scan({ type: "all" });
     const summary = {
       total: findings.length,
       bySeverity: {},
       byType: {}
     };
     for (const f of findings) {
       summary.bySeverity[f.severity] = (summary.bySeverity[f.severity] || 0) + 1;
       summary.byType[f.scan_type] = (summary.byType[f.scan_type] || 0) + 1;
     }
     return { findings, summary };
   '
   ```

2. **Analyze findings** — Add LLM-level context:
   - Group related debt markers (same file, same theme)
   - Assess impact of stale docs (user-facing vs internal)
   - Evaluate dead exports (truly dead vs used by external consumers)
   - For complex: check for architectural violations (circular deps, wrong-layer access)

3. **Prioritize** — Order findings by impact:
   - Critical: actively misleading docs, broken references users would hit
   - Warning: debt accumulation, unused code bloating bundle, stale patterns
   - Info: cosmetic debt, low-impact cleanup opportunities

4. **Propose backlog items** — Group related findings into actionable work items:
   - Each item should be completable in a single session
   - Include specific file references
   - If backlog skill is available, create items directly

5. **Log the scan** as a metric:
   ```bash
   $HARNESS exec --code 'return harness.metrics.log({ runId: "<run_id>", metric: "gc_scan", value: "<finding_count>", mode: "gc" })'
   ```

## Scan Types

| Type | What It Finds | Method |
|------|--------------|--------|
| `debt` | TODO, FIXME, HACK, XXX, WORKAROUND, TEMP comments | Deterministic regex scan |
| `stale-docs` | README references to non-existent files, broken links | Deterministic cross-reference |
| `dead-exports` | Named exports used only at declaration site | Deterministic usage analysis |
| `architectural` | Circular dependencies, wrong-layer access, pattern violations | LLM analysis (complex only) |

## Constraints

 - MUST NOT edit source files — report findings and propose backlog items only
 - MUST use forge-harness for deterministic scans before adding LLM analysis
 - MUST separate deterministic findings (high confidence) from LLM analysis (medium confidence)
 - MUST NOT over-report — group related findings, don't list every single TODO individually
 - SHOULD propose backlog items that are atomic and completable in one session
 - SHOULD use CORRECTION: protocol when discovering errors mid-analysis (see engineering-preferences.md)

## Output Format

Write results naturally. Structure as:

```markdown
## Codebase Health Report

**Scan date:** [date]
**Scope:** [directory or full project]
**Findings:** [N total — X critical, Y warning, Z info]

### Critical (act now)
- [finding with file:line reference and impact description]

### Warning (schedule soon)
- [finding with file:line reference]

### Info (nice to fix)
- [grouped finding summaries — don't list every TODO individually]

### Proposed Backlog Items
1. **[item title]** — [brief description, specific files, estimated scope]
2. ...
```

End with internal markers on separate lines (coordinator reads and strips these):

```
[done]
DEVIATIONS: any departures from Mission Brief instructions, or omit if none
UNKNOWNS: areas that could not be scanned, or omit if none
REMAINING RISKS: potential false positives in dead-exports analysis, or omit if none
```

## Done When

 - MUST have run all applicable deterministic scans via forge-harness
 - MUST have produced a prioritized findings report
 - MUST have proposed actionable backlog items (if findings warrant them)
 - MUST have logged the scan as a metric

## Non-Goals

 - MUST NOT fix any findings — report and propose only
 - MUST NOT refactor code
 - MUST NOT modify test files

## Stop Conditions

 - SHOULD stop after producing the health report — do not begin fixing issues
 - SHOULD stop if no findings are found (report clean health status)

## Changelog

- 2026-03-14: Initial mode. Created as part of agentic flywheel initiative (Fowler "Humans & Agents" analysis).
