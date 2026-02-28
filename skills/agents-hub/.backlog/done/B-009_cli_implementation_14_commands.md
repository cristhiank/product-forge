# B-009: CLI Implementation (14 Commands)

**Created:** 2026-02-21  
**Completed:** 2026-02-21  
**Updated:** 2026-02-21  
**Type:** Epic  
**Priority:** High  
**Status:** Done  
**Estimate:** TBD  
**Verified-By:** N/A  
**Parent:** N/A  
**Depends-On:** [B-008]  
**Tags:** [cli, commands]  

---

## Goal

Implement src/cli.ts per spec 02-cli-api.md using Commander.js or yargs. 14 commands: init, channel create, channel list, post, reply, read, read-thread, search, watch, status, update, export, import, gc, stats. Global options: --db (default .devpartner/hub.db), --json (default true), --pretty. All output JSON. CLI parses args, instantiates Hub, calls methods, prints JSON to stdout. Entry point: scripts/hub.js (compiled). Handle errors with JSON error output and non-zero exit codes. Parse --tags as JSON array, --metadata as JSON object.

## Acceptance Criteria

- [ ]

