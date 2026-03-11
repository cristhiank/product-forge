# Visual Vocabulary

> Console-optimized visual aids for T2+ tasks. Subagents use these patterns to make architecture, flow, and comparison visible in terminal output.

**Trigger:** Include visual aids when task complexity is T2+ (complexity score ≥ 3).

---

## Pattern Catalog

### ① Component Box

**When to use:** Modules, services, architectural boundaries, system topology.
**Modes:** design (L2+), explore (architecture mapping), product (feature decomposition)

```
┌─────────┐     ┌─────────┐     ┌─────────┐
│ Frontend │────▶│   API   │────▶│   DB    │
└─────────┘     └────┬────┘     └─────────┘
                     │
                     ▼
                ┌─────────┐
                │ Keycloak│
                └─────────┘
```

---

### ② Layer Stack

**When to use:** Stacked architectures, middleware chains, layered systems.
**Modes:** design (L2+), explore (system overview)

```
┌─────────────────────────────┐
│         Presentation        │
├─────────────────────────────┤
│         Application         │
├─────────────────────────────┤
│          Domain             │
├─────────────────────────────┤
│       Infrastructure        │
└─────────────────────────────┘
```

---

### ③ Dependency Tree

**When to use:** File hierarchies, module trees, task dependencies.
**Modes:** explore (file structures), plan (task dependencies), verify (scope mapping)

```
src/
├── auth/
│   ├── AuthProvider.tsx
│   ├── useAuth.ts
│   └── login-page.tsx
├── api/
│   ├── client.ts          ← shared HTTP client
│   └── hooks/
│       ├── useBookings.ts
│       └── useClients.ts
└── features/
    ├── bookings/
    └── pricing/           ← gold standard module
```

---

### ④ Sequence Flow

**When to use:** Process flows, user journeys, data paths.
**Modes:** design (L3 interactions), plan (step flow), product (user journeys)

Horizontal:
```
User ──▶ Login Page ──▶ Auth Service ──▶ Token ──▶ Dashboard
                            │
                            ▼
                       Keycloak IdP
```

Vertical:
```
Browser
  │ POST /login
  ▼
API Gateway
  │ validate + forward
  ▼
Auth Service
  │ OIDC code exchange
  ▼
Keycloak ──▶ JWT ──▶ API Gateway ──▶ Set-Cookie ──▶ Browser
```

---

### ⑤ State Machine

**When to use:** Entity lifecycles, workflow states.
**Modes:** design (entity lifecycles), plan (workflow states)

```
         ┌─────────┐
    ┌───▶│  DRAFT  │
    │    └────┬────┘
    │         │ submit
    │         ▼
    │    ┌─────────┐    reject    ┌──────────┐
    │    │ PENDING │─────────────▶│ REJECTED │
    │    └────┬────┘              └────┬─────┘
    │         │ approve                │ revise
    │         ▼                        │
    │    ┌─────────┐                   │
    │    │APPROVED │◀──────────────────┘
    │    └────┬────┘
    │         │ publish
    │         ▼
    │    ┌─────────┐
    └────│  LIVE   │
  archive└─────────┘
```

---

### ⑥ Parallel Tracks

**When to use:** Concurrent phases, worker dispatch.
**Modes:** plan (phase concurrency), coordinator (worker status)

Phase view:
```
Phase 1 ──────┬─── Phase 3 ─── Phase 4
              │
      ┌───────┴───────┐
      │  Can parallel  │
      ├───────┬───────┤
      │  2a   │  2b   │
      └───────┴───────┘
```

Worker view:
```
Coordinator
  ├──▶ Worker A (auth module)     ──▶ ✅ 4 files, tests pass
  ├──▶ Worker B (API endpoints)   ──▶ 🟡 running...
  └──▶ Worker C (frontend hooks)  ──▶ ✅ 3 files, build clean
```

---

### ⑦ Tradeoff Matrix

**When to use:** Approach scoring, multi-criteria analysis.
**Modes:** ideate (approach comparison), verify (pass/fail), product (prioritization)

```
Approach      │ Perf │ Maint │ Risk │ Effort │ Score
──────────────┼──────┼───────┼──────┼────────┼──────
A: EF Core    │ 🟡   │ 🟢    │ 🟢   │ 🟡     │ ★★★★
B: Raw SQL    │ 🟢   │ 🔴    │ 🟡   │ 🟢     │ ★★★
C: Hybrid     │ 🟢   │ 🟡    │ 🟡   │ 🔴     │ ★★½
              ▲ recommended
```

---

### ⑧ Impact Grid

**When to use:** Prioritization, effort vs value analysis.
**Modes:** product (feature prioritization), ideate (approach selection)

```
         High Value
              │
    Quick     │    Strategic
    Wins 🟢   │    Bets 🟡
              │
──────────────┼──────────────
              │
    Fill-ins  │    Money
    ⚪        │    Pits 🔴
              │
         Low Value
    Low Effort    High Effort
```

---

### ⑨ Before/After

**When to use:** Refactoring impact, migration plans.
**Modes:** ideate (change impact), plan (migration steps)

```
BEFORE                          AFTER
──────                          ─────
useState + useEffect            React Query hooks
  ↓                               ↓
Manual loading/error state      Built-in states
  ↓                               ↓
No cache, refetch on mount      Shared cache + stale-while-revalidate
  ↓                               ↓
9 useState calls per route      1 useQuery call per data need
```

---

### ⑩ Dashboard

**When to use:** Status overview, results summary.
**Modes:** verify (results overview), coordinator (dispatch results)

```
┌─ Verification Results ─────────────────────────┐
│                                                  │
│  Build      ✅ clean    Tests    ✅ 262/262     │
│  Lint       ✅ 0 warns  Coverage 🟡 78%         │
│  Types      ✅ clean    Security ✅ 0 vulns     │
│                                                  │
│  Scope: 4 files changed, 0 unintended           │
└──────────────────────────────────────────────────┘
```

---

## Pattern-Mode Mapping

| Mode        | Primary Patterns         | Secondary Patterns        |
|-------------|--------------------------|---------------------------|
| explore     | ③ Tree, ① Box            | ② Stack                   |
| ideate      | ⑦ Matrix, ⑧ Grid         | ⑨ Before/After            |
| design      | ① Box, ④ Flow, ⑤ State   | ② Stack                   |
| plan        | ⑥ Tracks, ③ Tree         | ④ Flow                    |
| verify      | ⑩ Dashboard, ⑦ Matrix    | ③ Tree                    |
| product     | ④ Flow, ⑧ Grid           | ⑦ Matrix, ① Box           |
| coordinator | ⑩ Dashboard, ⑥ Tracks    | —                         |

---

## Unicode Character Reference

Box drawing:
```
┌ ┐ └ ┘ │ ─ ┬ ┴ ├ ┤ ┼
```

Double lines:
```
═ ║ ╔ ╗ ╚ ╝
```

Arrows:
```
▶ ▼ ◀ ▲ ──▶ ──→ ← → ↑ ↓
```

Status emoji (use sparingly):
```
🟢 good/pass  🟡 warning/partial  🔴 bad/fail
✅ complete   ❌ failed           ⚠️ caution
```

---

## Guidelines

- Keep diagrams compact: max ~15 lines tall, ~70 chars wide for terminal readability
- Use emoji sparingly and only for status: 🟢🟡🔴 ✅❌⚠️
- Tables always work — use them as the baseline visual aid
- Diagrams supplement tables, never replace them
- Label all arrows and connections
- Prefer box-drawing characters (`┌─┐`) over ASCII approximations (`+--+`)
- Test readability in a monospaced terminal font before committing
