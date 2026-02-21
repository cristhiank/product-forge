# B-007: TypeScript Project Setup

**Created:** 2026-02-21  
**Updated:** 2026-02-21  
**Type:** Feature  
**Priority:** High  
**Status:** Next  
**Estimate:** TBD  
**Verified-By:** N/A  
**Parent:** N/A  
**Depends-On:** N/A  
**Tags:** [infra, typescript, build]  

---

## Goal

Set up TypeScript project infrastructure for copilot-cli-skill so bash scripts can be converted to a typed library with bundled output.

## Deliverables

- `package.json` with dependencies (better-sqlite3 not needed; commander for CLI)
- `tsconfig.json` targeting Node 20, ESM
- `src/` directory structure: index.ts, types.ts, workers.ts, sdk.ts, cli.ts
- esbuild config to bundle to `scripts/worker.js`
- `.gitignore` updates for dist/

## Acceptance Criteria

- [ ] `npm run build` compiles TypeScript
- [ ] `npm run bundle` produces scripts/worker.js
- [ ] Package exports types and classes
- [ ] Bash scripts untouched (backward compat)
