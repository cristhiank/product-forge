# B-011: Worker Reliability & Observability — Eliminate Silent Failures and Manual Monitoring

**Created:** 2026-02-25  
**Updated:** 2026-02-25  
**Type:** Epic  
**Priority:** High  
**Status:** Not Started  
**Estimate:** TBD  
**Verified-By:** N/A  
**Parent:** N/A  
**Tags:** [reliability, observability, dx]  

---

## Goal

## Goal
Make the copilot-cli-skill trustworthy enough that orchestrators can rely on worker self-reports without manual verification. Today, orchestrators compensate for skill gaps by manually inspecting git diff, git log, build output, and files_changed after every worker — this wastes tokens and time.

## Evidence (from B-030 + B-031 sessions)
1. B-031.11 required 3 spawns — first silently wrote to wrong backlog project, second stalled, third succeeded
2. output.log is heavily buffered — orchestrators learned to ignore it and use git log/diff instead
3. 20+ stale dead workers accumulated between sessions — hub showed them "active" forever
4. Worker PIDs track the wrapper, not the copilot process — causes completed_no_exit status
5. Post-merge build verification is manual and repetitive

## Success Criteria
- Orchestrator can call validateWorker() after completion and get a structured pass/fail with scope violations
- SKILL.md monitoring guidance matches actual best practices (git-based, not log-based)
- Stale workers auto-cleaned at session start
- Worker completion includes structured report with files changed, commits made, build result

## Acceptance Criteria

- [ ]

