# B-014: Build & Publish Pipeline

**Created:** 2026-02-21  
**Updated:** 2026-02-21  
**Type:** Epic  
**Priority:** Medium  
**Status:** Done  
**Estimate:** TBD  
**Verified-By:** N/A  
**Parent:** N/A  
**Depends-On:** [B-009]  
**Tags:** [build, publish, devops]  

---

## Goal

Set up build and publish per spec 07-architecture.md: (1) tsup or esbuild config to bundle src/ → dist/scripts/hub.js as single file. (2) publish-skill.sh script that copies SKILL.md + scripts/hub.js + references/ + node_modules/better-sqlite3 to ~/.copilot/skills/agents-hub/. (3) npm scripts: dev (watch mode), build, test, test:watch, bundle. (4) Verify published skill works: run hub.js from skill directory, test all commands. Published layout: SKILL.md, scripts/hub.js, references/{api-reference.md, examples.md}, node_modules/ (bundled native deps).

## Acceptance Criteria

- [ ]

