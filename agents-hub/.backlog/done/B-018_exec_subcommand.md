# B-018: Exec Subcommand for CLI

**Created:** 2026-02-21  
**Updated:** 2026-02-21  
**Type:** Feature  
**Priority:** High  
**Status:** Next  
**Estimate:** TBD  
**Verified-By:** N/A  
**Parent:** N/A  
**Depends-On:** [B-017]  
**Tags:** [cli, exec, agent-api]  

---

## Goal

Add an `exec` subcommand to the CLI that evaluates JavaScript code with `Hub` and `HubSDK` pre-loaded in scope. This enables agents to generate code instead of constructing bash commands with nested JSON.

Usage:
```bash
hub exec 'await sdk.postFinding("Auth uses bcrypt", {tags: ["auth"]})'
hub exec --channel '#main' --author scout 'sdk.getFindings()'
```

## Implementation

- Add `exec` command to `src/cli.ts` using Commander.js
- Accept code string as argument
- Support `--channel` and `--author` flags for SDK defaults
- Use `AsyncFunction` constructor (not raw eval) to support await
- Pre-load `hub` (Hub instance) and `sdk` (HubSDK instance) in scope
- Return value of last expression as JSON to stdout
- Errors formatted as `{ "error": "..." }` matching CLI convention

## Acceptance Criteria

- [ ] `hub exec '<code>'` works from command line
- [ ] `hub` and `sdk` objects available in scope
- [ ] `--channel` and `--author` set SDK defaults
- [ ] await supported in code
- [ ] Output is JSON (last expression result)
- [ ] Errors output as JSON with non-zero exit
- [ ] Bundled in scripts/hub.js
