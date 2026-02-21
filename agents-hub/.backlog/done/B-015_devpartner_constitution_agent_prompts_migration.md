# B-015: DevPartner Constitution & Agent Prompts Migration

**Created:** 2026-02-21  
**Updated:** 2026-02-21  
**Type:** Epic  
**Priority:** Medium  
**Status:** Done  
**Estimate:** TBD  
**Verified-By:** N/A  
**Parent:** N/A  
**Depends-On:** [B-013]  
**Tags:** [migration, constitution]  

---

## Goal

Update DevPartner v17 to use agents-hub instead of agents-board, per spec 06-migration.md. Changes: (1) devpartner constitution (SKILL.md) — replace all board.* method references with hub CLI commands, replace entity types (Fact→note+finding, Snippet→note+snippet, Alert→request, Decision→decision, PlanStep→note+plan), replace 'snippets-first' with 'search-first', add channel awareness for multi-worker. (2) Agent prompts — replace $BOARD with $HUB in all 6 agent .md files (Scout, Creative, Planner, Verifier, Executor, Memory-Miner), update command examples. (3) Orchestrator prompt — add multi-worker protocol support, channel management. This is a BREAKING CHANGE — v17+ only.

## Acceptance Criteria

- [ ]

