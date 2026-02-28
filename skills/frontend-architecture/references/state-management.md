# State Management and Data Flow

## Three Layers of State

### 1. Server State

- Loaded via the router's data-loading mechanism (loaders or equivalent)
- Invalidated and refreshed via navigation or revalidation

### 2. Mutation State

- Performed via the router's mutation mechanism (actions or equivalent)
- Use redirects and route revalidation after mutations
- Show optimistic UI when simple and safe

### 3. Local UI State

- Managed via the framework's local state primitives inside components
- Lifted into feature-level hooks when reused across components within the same feature

## Guidelines

- Do not fetch server data inside side effects in regular components. Prefer the router's data-loading mechanism.
- If a flow becomes complex, consider a local state machine or reducer inside the feature, not a global store.
- Cross-feature state is limited to a small set of truly global concerns: current user, current tenant/account, locale, and high-level feature flags or plan info.

## Real-Time and Streaming State

When a feature consumes real-time data (streaming APIs, WebSocket events, SSE):

- The streaming transport is scoped to the feature that owns it
- Streaming events are the source of truth for that feature's live state
- Global app state must not depend on feature-specific streaming events
