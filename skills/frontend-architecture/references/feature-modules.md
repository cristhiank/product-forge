# Feature Modules and API Clients

## Feature Module Structure

Each feature folder follows the same structure:

```
features/<feature>/
  index                     # Public surface (barrel file)
  routes/
    <n>-route
  components/
    *.component
  api/
    *-client
  hooks/
    use-something
  types/
    *.types
```

## Public Surface

Each feature has a barrel file that re-exports what other parts of the app are allowed to use. Typically this is just the route definitions.

Only the barrel file should be imported from outside the feature folder.

**Forbidden:** Importing a feature's internal component, hook, or API client from another feature. Always import from the barrel file.

## Shared API Client

A single shared API client is the only place that talks to the network for backend requests.

Responsibilities:
- Set base URL and credentials policy
- Attach standard headers (locale, correlation IDs, etc.)
- Handle structured error responses from the backend
- Map HTTP status codes to typed error objects
- Trigger auth redirect on 401 when appropriate

No other module should make raw HTTP calls for backend communication.

## Feature API Clients

Each feature has one or more API client files under its `api/` folder.

Rules:
- Only API client files call the shared client's helper functions
- Route loaders and actions call the feature's client functions, not the shared client directly
- Types in the feature's `types/` folder represent view models and UI contracts
- When the backend DTO shape differs from what the UI needs, the mapping happens in the API client, not in components

## API and Hook Consolidation (Refactoring)

When a feature has accumulated multiple scattered API files and hooks (common after organic growth or when platform/tenant scopes were built separately), consolidate them.

### When to Consolidate

- **Multiple API files for the same entity type** — e.g., `tenant-agents-api.ts` + `platform-agents-api.ts` + `agent-versions-api.ts` when they all manage agents
- **Duplicate hooks wrapping similar data** — e.g., `useAgents()`, `usePlatformAgents()`, `useAgentVersions()` that could be one hook with parameters
- **Feature has more API/hook files than component files** — a sign of over-fragmentation

### Consolidation Pattern

**API clients: N files → 1 unified client per feature**

Create a single API client that accepts scope or entity type as a parameter:

```
// Before: scattered files
api/tenant-agents-client.ts    → listAgents(), createAgent()
api/platform-agents-client.ts  → listPlatformAgents(), updatePlatformAgent()
api/agent-versions-client.ts   → listVersions(), createVersion()

// After: unified client
api/agents-client.ts           → listAgents(scope), createAgent(scope, data),
                                  updateAgent(scope, name, data),
                                  listVersions(agentId), createVersion(agentId, data)
```

The unified client routes to the correct backend endpoint based on scope:
- Scope determines the base path (e.g., `/api/settings/agents` vs `/api/platform/agents`)
- Operations available per scope are type-safe (e.g., `update` only available for scopes that support it)

**Hooks: N hooks → 1 parameterized hook per feature**

```
// Before: duplicate hooks
useAgents()           → fetches tenant agents
usePlatformAgents()   → fetches platform agents
useAgentVersions(id)  → fetches versions

// After: unified hook
useWorkbench(scope, entityType)  → fetches entities for scope+type,
                                    exposes CRUD mutations, selection state
```

### Rules During Consolidation

- Consolidate API and hooks **during layout rewrite** (Phase 5.3 of the UX review workflow), not as a standalone refactor. The layout change naturally reveals which data flows need to merge.
- Keep the unified client type-safe — scope-specific operations should be statically known, not runtime-optional
- If two scopes have genuinely different response shapes, keep the mapping in the API client (not in components)
- Test that all scopes still work after consolidation — scope-specific edge cases are the most common regression
