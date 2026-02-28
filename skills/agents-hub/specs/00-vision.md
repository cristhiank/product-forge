# agents-hub — Vision

## What Is agents-hub?

**agents-hub** is a real-time communication and knowledge-sharing hub for AI agents. Think of it as **Slack + a collaborative whiteboard**, designed from the ground up for multi-agent systems.

It replaces the agents-board skill entirely, based on hard-won lessons from 50+ real sessions.

## Why Replace agents-board?

### What Went Wrong

| Problem | Evidence | Impact |
|---------|----------|--------|
| **Over-engineered for simple tasks** | 7 entity types (fact, decision, alert, step, snippet, trail, constraint) with complex typed schemas | T1-T2 tasks (~60% of work) never use the board — too much ceremony |
| **No concurrent access** | JSON/JSONL files on disk with no locking | Multiple CLI processes corrupt data — blocks v17 parallel work |
| **Low adoption** | Session analysis: agents skip board operations, read files directly | Cost of using the board exceeds the benefit |
| **No inter-session communication** | Board is scoped to a single task_id | Workers in parallel can't see each other's findings |
| **Rigid plan structure** | `Plan` → `PlanStep[]` → `SubTask[]` with status tracking | Over-constrains the natural flow of work |
| **Exec mode rarely used** | JavaScript eval for complex queries was powerful but heavy | Agents default to simpler CLI commands |
| **Snippet/Fact confusion** | Snippets (cached file content) and Facts (assertions) are fundamentally different things stored in similar structures | Agents don't know when to use which |

### What Worked

| Feature | Keep in agents-hub? |
|---------|---------------------|
| Full-text search (FTS5 + BM25) | ✅ Yes — essential for finding relevant context |
| Role-based permissions | ✅ Yes — simplified |
| Evidence references | ✅ Yes — in metadata, not a separate type |
| Tags for filtering | ✅ Yes — first-class on all messages |
| Progressive context loading | ✅ Yes — status → search → full read |
| Audit trail | ✅ Yes — SQLite gives us this for free via WAL |

## Core Design Principles

### 1. Simplicity Over Completeness
4 message types instead of 7 entity types. Tags and metadata handle the rest. If an agent has to think about "should this be a fact or a snippet?", the system failed.

### 2. Concurrency First
SQLite WAL mode handles multiple readers + one writer. No file corruption. Multiple Copilot CLI processes can safely read/write simultaneously.

### 3. Channels as Namespaces
Inspired by Slack: `#general`, `#worker-B042`, `#main`. Workers read any channel for cross-pollination, write only their own + #general. This enables parallel work without interference.

### 4. Near-Real-Time Communication
`fs.watch` on the SQLite WAL file → workers get notified when new messages arrive. No polling needed for the `watch` command.

### 5. Search-First Knowledge Access
FTS5 full-text search across all messages. Future: semantic search via embeddings. Agents should search before reading, always.

### 6. Minimal Ceremony
No "create task → set mission → add constraints" ritual. Just `hub init` and start posting. The first message IS the mission.

## Target Users

1. **DevPartner v17 agents** — Super-Orchestrator, Orchestrator, Scout, Creative, Planner, Verifier, Executor
2. **Any multi-agent system** built on Copilot CLI custom agents
3. **Single-agent workflows** — works in single-channel mode identical to but simpler than agents-board

## Success Metrics

- **Adoption rate**: >80% of T3+ sessions actively use the hub (vs. ~40% for agents-board)
- **Message count**: Average 10+ messages per T3+ session (evidence of real usage)
- **Cross-worker reads**: In parallel sessions, workers read other workers' channels >50% of the time
- **Block resolution time**: <60 seconds from worker posting a request to receiving a response
- **Zero corruption**: No data loss from concurrent access across 100+ parallel sessions
