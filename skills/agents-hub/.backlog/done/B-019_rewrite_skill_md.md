# B-019: Rewrite SKILL.md for Code-Generation Approach

**Created:** 2026-02-21  
**Updated:** 2026-02-25  
**Type:** Feature  
**Priority:** High  
**Status:** Done  
**Estimate:** TBD  
**Verified-By:** N/A  
**Parent:** N/A  
**Depends-On:** [B-018]  
**Tags:** [docs, skill, agent-api]  

---

## Goal

Rewrite SKILL.md to teach agents the `hub exec` + SDK approach as the primary interaction method. Keep CLI reference as fallback. Show examples of common agent workflows using SDK helpers.

## Key Changes

- Primary examples use `hub exec 'sdk.method(...)'` instead of `$HUB post --flags`
- Show SDK method reference with signatures
- Keep CLI reference section (compressed) for backward compat
- Update all workflow examples (post finding, search, request help, resolve)
- Update trigger words section

## Acceptance Criteria

- [ ] SDK approach is primary, CLI is secondary
- [ ] All common workflows shown with exec examples
- [ ] Method reference with signatures
- [ ] References docs updated if needed
