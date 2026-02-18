# Frontend Testing Strategy

## Test Structure

Tests live in a parallel tree or co-located with features, depending on project convention.

### Test Types

- **Unit tests** for components and hooks
- **Integration tests** for route modules and data-loading flows
- **Contract tests** for feature API clients against backend specs

Additional tests for dynamic or external content:
- Streaming event sequences produce correct UI state
- Content updates are applied deterministically
- The policy layer correctly validates, rewrites, and rejects
- Spec compilation produces valid output for the wrapped library

## Testing Pyramid

- Keep most tests at unit/component level for fast feedback
- Use integration tests for feature slices (routing + state + API orchestration)
- Use end-to-end tests for business-critical user journeys only
- Use contract tests between frontend clients and backend contracts to catch schema drift early

## End-to-End Coverage Model

Model E2E coverage as **user journeys**, not page checklists.

Each journey must define:
- **Entry condition** — Authenticated/unauthenticated, initial data state
- **User action sequence** — What the user does, in user language
- **UI oracle** — What must be visible/hidden/enabled/disabled after the action

E2E tests verify UI-visible outcomes only. Backend state verification belongs in integration and contract tests.

## E2E Testing with a Real Backend

E2E tests run against the real backend server and API — no mocking of backend calls at this level. This catches integration issues, contract drift, and full-stack regressions that lower-level tests miss.

### Server Lifecycle

Two approaches, choose based on project needs:

**Approach 1: Test runner manages servers.** Use the test framework's built-in server management (e.g., Playwright's `webServer` config) to start both backend and frontend before tests run. Reuse existing servers locally for speed; always start clean in CI.

**Approach 2: Servers managed externally.** Backend runs via docker-compose, a CI service, or manual start. Tests only start the frontend (or assume it is also running). This is common when the backend has complex dependencies or when the same backend instance is shared across test suites.

Either way:
- Tests must wait for servers to be healthy before running (health endpoint polling or port availability check)
- The command to run E2E tests locally and in CI should be the same surface (e.g., a single npm/make script)
- Server startup timeout must be explicit and generous enough for cold starts

### Test Data Seeding

Seed test data via the backend's public APIs, not through the UI and not by direct database manipulation.

Rules:
- Use `beforeEach` hooks to call backend REST/GraphQL endpoints that create the exact data each test needs
- Use `afterEach` hooks to clean up created data, or design tests to use unique, non-conflicting data so cleanup is optional
- Never seed through the UI — it is slow, brittle, and couples tests to unrelated UI flows
- Never manipulate the database directly — it bypasses business rules and couples tests to schema internals
- Use the test framework's built-in API request context (e.g., Playwright's `APIRequestContext`) for seeding calls
- Keep seed data minimal: create only what the specific test requires

### Authentication

Authenticate once and reuse the authenticated state across tests.

Pattern:
- A setup step (e.g., a Playwright setup project) performs the login flow once and saves browser storage state (cookies, localStorage) to a file
- All test projects declare a dependency on the setup step and load the saved storage state
- Tests start already authenticated — no per-test login overhead
- Store the auth state file in a gitignored directory (e.g., `playwright/.auth/`)
- Re-run the setup step when authentication expires

This pattern works when tests do not modify shared server-side auth state. If tests modify server-side state that affects other tests, use one account per parallel worker instead.

### Parallel Test Isolation

- Each test runs in its own isolated browser context (separate cookies, session, localStorage)
- Tests must not depend on execution order or shared mutable state
- Seed unique data per test (unique usernames, IDs, resource names) to avoid cross-test interference when running in parallel
- Reduce parallel workers in CI if resource-constrained (e.g., `workers: process.env.CI ? 4 : undefined`)

### Selectors and Assertions

- Prefer role-based and user-facing selectors: `getByRole`, `getByLabel`, `getByText`, `getByTestId` — in that priority order
- Use web-first assertions that auto-wait and retry (e.g., `await expect(locator).toBeVisible()`)
- Never use manual synchronous assertions on async UI state
- Avoid CSS class or DOM structure selectors — they break on visual changes

### Failure Diagnostics

- Capture traces on first retry of failed tests in CI (not on every test — too expensive)
- Retain HTML reports, screenshots, and traces as CI artifacts
- Use trace viewer for debugging CI failures instead of videos (trace viewer shows timeline, DOM snapshots, network requests)
- Locally, use the test framework's debug mode and inspector for step-by-step investigation

### E2E Test Organization

```
tests/
  e2e/
    auth/                    # Login, registration, auth flows
    journeys/                # Business-critical user journeys
    setup/                   # Auth setup, global fixtures
  fixtures/                  # Data factories, API helpers, shared utilities
```

- Group tests by user journey, not by page
- Keep page object models or fixture helpers in a shared fixtures directory
- Name test files after the journey they verify, not the page they touch

## Reliability and Determinism

- Use stable, user-facing selectors first (roles, labels, visible text, semantic IDs)
- Avoid fixed sleeps; prefer retryable, condition-based waits and assertions
- Isolate test state per scenario; no hidden inter-test dependencies
- Capture actionable artifacts on failure (trace/log/video/screenshot)
- Retry only for transient CI flake; investigate recurring retries as defects

## Environment and Data Strategy

- Run E2E against a production-like environment shape with deterministic test data
- Keep authentication automation deterministic (test identity bootstrap, shared auth state)
- Seed and clean data through public APIs in beforeEach/afterEach hooks
- Support local and CI execution with the same command surface

## CI Quality Gates

- Run fast tests (unit/component/integration) on every pull request
- Run critical-path E2E on PR, full E2E suites on merge/mainline cadence
- Enforce architecture and contract checks in CI as blockers
- Publish test artifacts and failure diagnostics automatically

## Governance and Maintenance

- Every production bug adds or strengthens at least one automated test at the right layer
- Remove redundant E2E cases when lower-level tests cover the same risk faster
- Track flaky tests as reliability work, not expected noise
- Keep test naming behavior-oriented and business-readable

## Architecture Lint Rules

Enforce via the project's linting toolchain:
- No imports from another feature's internal folders — only from barrel file
- No raw HTTP calls outside the shared API client
- No direct imports of wrapped third-party libraries outside designated wrappers
- No raw HTML injection from external inputs

Start rules as warnings, escalate to errors once compliant.
