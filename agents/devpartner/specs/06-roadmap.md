# DevPartner v17 — Implementation Roadmap

## Dependencies

```
agents-hub (independent project)
  ├── Phase 1: Schema + Core API
  ├── Phase 2: CLI
  ├── Phase 3: Watch + Real-Time
  ├── Phase 4: SKILL.md + References
  └── Phase 5: Tests

v17 agents (depends on agents-hub Phase 4)
  ├── Phase A: Copy v16 → v17
  ├── Phase B: Super-Orchestrator agent (NEW)
  ├── Phase C: Constitution + hub migration
  ├── Phase D: Update all agent prompts
  ├── Phase E: Build tools
  └── Phase F: Publish + Validate
```

## Critical Path

```
agents-hub P1 → P2 → P3 → P4 ──┐
                                  ├→ v17 Phase C → D → E → F
v17 Phase A ── Phase B ──────────┘
```

**Parallelizable**:
- agents-hub P1-P3 can run alongside v17 Phase A + B (Super-Orch spec doesn't need working hub)
- agents-hub P5 (tests) can run alongside v17 Phase E (build tools)

## agents-hub Phases

### Phase 1: Schema + Core API
- SQLite schema (messages, channels, hub_meta, FTS5)
- Connection factory with WAL mode
- Message CRUD (post, read, update)
- Reply/thread support
- Channel management (create, list)

### Phase 2: CLI
- CLI argument parser (commander or yargs)
- All commands: init, post, reply, read, read-thread, search, status, channel create/list
- JSON output format
- Error handling + exit codes

### Phase 3: Watch + Real-Time
- fs.watch on SQLite file
- `hub watch` command (blocking, NDJSON output)
- Polling fallback
- Timeout handling

### Phase 4: SKILL.md + References
- SKILL.md with triggers, anti-patterns, quick reference
- api-reference.md (complete CLI docs)
- examples.md (workflow patterns)
- publish-skill.sh

### Phase 5: Tests
- Unit tests for all core modules
- Integration tests for CLI
- Concurrency tests (multi-process access)
- Protocol tests (blocked worker, cross-worker search)

## v17 Phases

### Phase A: Copy v16 → v17
- `cp -r v16/ v17/`
- Update version references in all files

### Phase B: Super-Orchestrator Agent
- Create `v17/super_orchestrator.agent.md`
- Backlog analysis heuristics
- Worker spawn protocol
- Monitoring loop
- Merge protocol
- Error handling

### Phase C: Constitution + Hub Migration
- Update `v17/_constitution.md`:
  - Replace all board references with hub
  - Add Super-Orchestrator to agent table
  - Add channel protocol section
  - Add worktree awareness section
  - Update permissions matrix
  - Add new hard constraints

### Phase D: Update Agent Prompts
- Orchestrator: hub refs + parallel mode awareness
- Scout: hub refs + cross-worker search
- Creative: hub refs
- Planner: hub refs
- Executor: hub refs + blocked protocol
- Verifier: hub refs
- Memory-Miner: hub refs

### Phase E: Build Tools
- build-agents.py: add super_orchestrator
- publish.sh: add super_orchestrator, default to v17
- validate-agents.py: add super_orchestrator

### Phase F: Publish + Validate
- Run publish.sh --version=v17
- Run validate-agents.py --version v17
- Verify all 8 agents published correctly (7 from v16 + super_orchestrator)

## Risk Register

| Risk | Impact | Mitigation |
|------|--------|------------|
| Copilot CLI doesn't support `--autopilot` flag | Blocks v17 entirely | Validate flags before implementation |
| SQLite WAL has issues with NFS/network drives | Hub corruption | Require local filesystem |
| Workers consume too many API requests | Cost explosion | Default max 3 workers, model selection |
| Merge conflicts frequent in practice | User frustration | Improve independence analysis, warn proactively |
| Worker sessions too long for context window | Quality degradation | Checkpointing + `/compact` |
| Hub database grows too large | Performance degradation | `hub gc`, message limits per channel |

## Open Questions

1. **Should workers share a Copilot premium request budget?** If each worker uses independent requests, cost could be 3-5x.
2. **How does `--resume` interact with `--agent`?** Need to verify resumed sessions keep the agent context.
3. **Can we use `--share` to export session for monitoring?** Need to verify the output format is parseable.
4. **Should the Super-Orchestrator itself be a custom agent?** Or is it the main interactive session?
5. **How do we handle dependency chains?** (B-044 depends on B-042 → run B-042 first, then B-044)
