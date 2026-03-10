# REPORT v1

> Canonical subagent-to-coordinator contract for the `forge-gpt` fork.

**Status:** Draft v1
**Related:** `agents\forge-gpt\schemas\mission-brief.v1.md` | `agents\forge-gpt\SKILL.md` | `agents\forge\docs\FORGE_GPT_DESIGN.md`

<!-- Forge lineage: adapted from agents\forge\SKILL.md sections 445-498, agents\forge\modes\execute.md sections 150-175, and agents\forge\modes\verify.md sections 173-195. -->

---

## Purpose

Every `forge-gpt` subagent returns exactly one `<report version="1">` block.

The coordinator validates the block before it can emit `DISPATCH_COMPLETE`.

Subagents **never** emit coordinator terminal tokens.

This REPORT is a machine contract, not the user-facing answer. After validation, the coordinator translates it into a human summary.

---

## Status enum

Allowed values:

- `complete`
- `needs_input`
- `blocked`
- `failed`
- `timed_out`

### Meanings

| Status | Use when |
|--------|----------|
| `complete` | Requested work finished and required evidence is present |
| `needs_input` | The brief is valid but a missing design decision or clarification blocks safe progress |
| `blocked` | External blocker, dependency, or policy issue prevents completion |
| `failed` | Contract failure, unrecoverable execution error, or 2-attempt self-fix limit reached |
| `timed_out` | Time budget is nearly exhausted and the worker must stop cleanly |

`partial` is not part of v1.

---

## Required fields

| Field | Required | Validation rule |
|-------|:--------:|-----------------|
| `version` | Yes | Must be `"1"` |
| `run_echo.run_id` | Yes | Must match Mission Brief `run_id` |
| `run_echo.brief_hash` | Yes | Must match Mission Brief `brief_hash` |
| `run_echo.attempt_count` | Yes | Must match current attempt |
| `status` | Yes | Must be one of the allowed enum values |
| `summary` | Yes | 1-3 concise sentences |
| `artifacts` | Yes | At least one artifact entry or explicit `none` |
| `evidence` | Yes | At least one evidence entry or explicit reason for absence |
| `issues` | Yes | Explicit `none` or one or more issue entries |
| `next` | Yes | One concrete next step |

---

## Output shape rules

- Emit exactly one `<report version="1">` block.
- Emit no prose before or after the block.
- Put `run_id`, `brief_hash`, and `attempt_count` inside `<run_echo>`, never at the top level.

---

## Evidence minimums

If the run changed code or configuration, the report must include:

1. at least one command, diagnostic, or test evidence entry, and
2. at least one file or symbol reference tied to the work.

If the run did **not** change code, the report must explain why no build/test evidence exists.

---

## Canonical template

```xml
<report version="1">
  <run_echo>
    <run_id>forge-gpt-001</run_id>
    <brief_hash>sha256:abc123</brief_hash>
    <attempt_count>1</attempt_count>
  </run_echo>

  <status>complete</status>
  <summary>One to three concise sentences.</summary>

  <artifacts>
    <artifact type="file">path/to/file.ext</artifact>
  </artifacts>

  <evidence>
    <command name="npm test" exit_code="0">24 passed, 0 failed</command>
    <reference file="path/to/file.ext:42">What changed or what was verified.</reference>
  </evidence>

  <issues>none</issues>
  <next>Ready for verify-gpt review.</next>
</report>
```

---

## Valid example

```xml
<report version="1">
  <run_echo>
    <run_id>auth-endpoint-run</run_id>
    <brief_hash>sha256:f1e2d3</brief_hash>
    <attempt_count>1</attempt_count>
  </run_echo>

  <status>complete</status>
  <summary>Added request validation to the auth endpoint and kept the route contract unchanged.</summary>

  <artifacts>
    <artifact type="file">src/auth/AuthController.cs</artifact>
    <artifact type="test">tests/auth/AuthControllerTests.cs</artifact>
  </artifacts>

  <evidence>
    <command name="dotnet test" exit_code="0">24 passed, 0 failed</command>
    <reference file="src/auth/AuthController.cs:41">Added early request validation before token issuance.</reference>
  </evidence>

  <issues>none</issues>
  <next>Ready for verify-gpt review.</next>
</report>
```

---

## Invalid example

```markdown
## REPORT
STATUS: done
SUMMARY: Looks good.
```

Why invalid:

- Not wrapped in a `<report version="1">` block
- Missing `run_echo`
- `done` is not a valid status enum value
- Missing `artifacts`, `evidence`, `issues`, and `next`

### Another invalid example

```xml
<report version="1">
  <run_id>remove-webui-flutter</run_id>
  <brief_hash>sha256:abc123</brief_hash>
  <attempt_count>2</attempt_count>
  <status>pass</status>
  <summary>Verified.</summary>
</report>
```

Why invalid:

- Run metadata must be wrapped in `<run_echo>`
- `pass` is not a valid status enum value
- Missing `artifacts`, `evidence`, `issues`, and `next`
- Near-miss XML is still invalid

---

## Coordinator validation checklist

The coordinator should validate in this order:

1. Parse exactly one `<report version="1">` block.
   - **HALT IF** parsing fails.
2. Confirm `run_echo.run_id`, `brief_hash`, and `attempt_count` match the active run.
   - **HALT IF** any value mismatches.
3. Confirm `status` is one of the allowed enum values.
   - **HALT IF** it is not.
4. Confirm all required fields exist and are non-empty.
   - **HALT IF** any required field is missing.
5. If artifacts include code or config changes, confirm `evidence` includes command/diagnostic/test output plus at least one file or symbol reference.
   - **HALT IF** evidence is missing.
6. If `status = complete`, emit `DISPATCH_COMPLETE` only after summarizing and bookkeeping.
7. If `status != complete`, surface the issue and use the coordinator's `BLOCKED` lane instead of pretending the dispatch succeeded.

---

## Mode expectations

### Execute mode

- `artifacts` should list files changed or created
- `evidence` should include diagnostics or build/test output when code changed
- `issues` should call out any remaining limitation

### Verify mode

- `artifacts` should list verified files, plans, or reports
- `evidence` should cite checklist results and relevant references
- `issues` should enumerate defects or explicit `none`

---

## Malformed output rule

If a subagent cannot produce a valid REPORT, it should still attempt to return a best-effort `<report version="1">` block with `status = failed` and an `issues` description.

Do not fall back to freeform Markdown.

When in doubt, copy the canonical template exactly and fill in the fields rather than improvising a new shape.
