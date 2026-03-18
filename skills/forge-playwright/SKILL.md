---
name: forge-playwright
description: >-
  ALWAYS use when the user asks to verify, test, screenshot, or visually inspect
  a web page using Playwright MCP browser tools. Manages mock profiles, auth
  bypass, and project-specific Playwright configurations via .playwright-mcp/
  directories. Use when you see: playwright, browser test, screenshot, visual
  verify, e2e, mock API, auth bypass, browser_route, browser_snapshot.
---

# forge-playwright

Project-agnostic toolkit for using Playwright MCP browser tools effectively.
Manages `.playwright-mcp/` project configs, mock profiles, auth bypass patterns,
and provides a CLI for scaffolding and applying configurations.

> ⚠️ **This skill is for Playwright MCP (interactive browser control via tools),
> NOT the Playwright test runner.** For CI E2E tests, use `npx playwright test`.

---

## First Actions

When this skill loads, do these immediately:

1. **Check for project config** — `$FORGE_PLAYWRIGHT project show`
   - If `.playwright-mcp/` exists → load config, proceed to step 3
   - If NOT found → follow [Local Project Setup](#local-project-setup) below
2. **Create project config** (only if step 1 found nothing):
   - Read the codebase to gather project info (framework, ports, auth)
   - Run `$FORGE_PLAYWRIGHT project init` to scaffold
   - Populate profiles with real API response shapes
   - Commit `.playwright-mcp/` to the repo
3. **Verify MCP capabilities** — check that `--caps=network,storage` are enabled
   - If missing `network` → ⚠️ `browser_route` and route-based mocking are unavailable
   - If missing `storage` → ⚠️ `browser_cookie_set` and storage tools are unavailable
4. **Determine workflow** — use the [Decision Tree](#decision-tree) to pick the right approach
5. **Load the default profile** — `$FORGE_PLAYWRIGHT profile show` to understand the mock data shape

---

## Local Project Setup

When `.playwright-mcp/` doesn't exist, **create it yourself** — don't ask the user to do it.

### Step-by-Step

1. **Gather project info** by reading the codebase:
   - Frontend framework (React, Next, Vue, Angular, Flutter web, Astro, etc.)
   - Dev server port (e.g., 3000, 5173, 4200)
   - API server port (e.g., 5000, 8080, 3001)
   - Auth pattern: how does the frontend check "am I logged in?"
   - Auth endpoint: what URL returns the current user (e.g., `/api/me`, `/auth/session`)

2. **Scaffold the directory**:
   ```bash
   $FORGE_PLAYWRIGHT project init
   ```

3. **Read the frontend auth guard** to understand the response shape:
   ```bash
   # Find the auth check in the frontend code
   grep -r "api/me\|/auth/session\|currentUser\|useAuth" src/ --include="*.ts" --include="*.tsx" -l
   ```

4. **Populate the admin profile** with real API response shapes from your codebase

5. **Commit** `.playwright-mcp/` to the repo

### config.json Schema

```json
{
  "ports": {
    "frontend": 3000,
    "api": 5000,
    "auth": 8080
  },
  "frontendFramework": "react-vite|next|flutter-web|angular|vue|astro|other",
  "authPattern": "api-mock|cookie|token|oidc|none",
  "authEndpoint": "/api/me",
  "defaultProfile": "admin",
  "baseUrl": "http://localhost:3000",
  "notes": "any project-specific notes"
}
```

| Field | Required | Description |
|---|---|---|
| `ports.frontend` | ✅ | Dev server port |
| `ports.api` | ✅ | Backend API port |
| `ports.auth` | ❌ | Separate auth service port (if applicable) |
| `frontendFramework` | ✅ | Determines routing and build patterns |
| `authPattern` | ✅ | Which auth bypass strategy to use |
| `authEndpoint` | ✅ | URL the frontend calls to check auth status |
| `defaultProfile` | ✅ | Profile name to apply by default |
| `baseUrl` | ✅ | Full URL for browser navigation |
| `notes` | ❌ | Free-text project notes |

### Profile JSON Schema

Profiles live in `.playwright-mcp/profiles/<name>.json`:

```json
{
  "name": "admin",
  "description": "Fully authenticated admin user",
  "routes": [
    {
      "url": "**/api/me",
      "method": "GET",
      "status": 200,
      "body": {
        "id": "usr_001",
        "email": "admin@example.com",
        "name": "Admin User",
        "role": "admin",
        "permissions": ["read", "write", "admin"]
      }
    }
  ],
  "cookies": [],
  "localStorage": {},
  "sessionStorage": {}
}
```

**Profile examples by auth pattern:**

**api-mock** (most common — SPA checks `/api/me`):
```json
{
  "routes": [
    { "url": "**/api/me", "method": "GET", "status": 200, "body": { "id": 1, "role": "admin" } }
  ]
}
```

**cookie** (server sets session cookie):
```json
{
  "cookies": [
    { "name": "session_id", "value": "mock-session-abc", "domain": "localhost", "path": "/" }
  ],
  "routes": [
    { "url": "**/api/me", "method": "GET", "status": 200, "body": { "id": 1, "role": "admin" } }
  ]
}
```

**token** (JWT in localStorage):
```json
{
  "localStorage": {
    "auth_token": "eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxIiwicm9sZSI6ImFkbWluIn0.mock"
  },
  "routes": [
    { "url": "**/api/me", "method": "GET", "status": 200, "body": { "id": 1, "role": "admin" } }
  ]
}
```

**none** (no auth needed):
```json
{
  "routes": []
}
```

---

## Decision Tree

```
Q: Does the user want to browse with REAL data using THEIR browser?
├─ YES → Recommend --extension mode or --cdp-endpoint (no mocking needed)
│        Use: $FORGE_PLAYWRIGHT config recommend
└─ NO

Q: Does the user want to verify a page with mocked/test data?
├─ YES → Apply a mock profile:
│        $FORGE_PLAYWRIGHT profile apply <name>
│        Execute the browser_route calls from the output, then navigate
└─ NO

Q: Full-page screenshot audit of multiple pages?
├─ YES → Use init-page for batch mocking:
│        $FORGE_PLAYWRIGHT init-page generate <profile>
│        Launch with --init-page=.playwright-mcp/init-pages/mocked.ts
│        Navigate each page → browser_take_screenshot(fullPage=true)
└─ NO

Q: Debug a JavaScript error or broken UI?
├─ YES → Diagnostic-first workflow:
│        1. browser_console_messages(level="error") BEFORE attempting fixes
│        2. Navigate → trigger action → read console
│        3. THEN fix the code
└─ NO

Q: Run CI end-to-end tests?
└─ YES → Use Playwright test runner (NOT MCP):
         npx playwright test --project=chromium
         Use storageState for auth bypass in test config
```

---

## Pitfall Prevention Rules

> ⛔ **These are real issues discovered across many sessions. Read before using Playwright MCP.**

### 1. `browser_route` requires `--caps=network`

Verify capabilities FIRST before attempting API mocking. Without `--caps=network`,
`browser_route` calls will silently fail or error.

```bash
# Check current MCP config
$FORGE_PLAYWRIGHT config validate
```

### 2. LIFO Route Ordering

`browser_route` uses **LIFO** (last-in, first-out) matching. Register routes in this order:

1. **Catch-all routes FIRST** (e.g., `**/api/**` → 404)
2. **Specific routes LAST** (e.g., `**/api/me` → user object)

Use `browser_route_list` to debug route ordering issues.

```
❌ Wrong order:
  browser_route("**/api/me", ...)     ← registered first, matched last
  browser_route("**/api/**", ...)     ← registered last, catches everything

✅ Correct order:
  browser_route("**/api/**", ...)     ← catch-all first (lowest priority)
  browser_route("**/api/me", ...)     ← specific last (highest priority)
```

### 3. Use `browser_route`, NOT `browser_run_code` for Mocking

`browser_route` is a dedicated MCP tool — cleaner, less error-prone, and properly
tracked by the MCP server. Avoid `browser_run_code` with `page.route()` calls.

### 4. Capture Console BEFORE Fixing

Always run `browser_console_messages(level="error")` **before** attempting any fix.
This captures the actual error state. Fixing blindly wastes cycles.

### 5. `browser_cookie_set` Requires `--caps=storage`

Without `--caps=storage`, cookie and localStorage tools are unavailable.
The agent must verify this before using cookie-based auth patterns.

### 6. Block Service Workers

Use `--block-service-workers` to prevent service workers from intercepting
`browser_route` mocks. SWs cache responses and can serve stale data that
bypasses your route handlers entirely.

### 7. Ignore HTTPS Errors

Use `--ignore-https-errors` for:
- Local dev servers with self-signed certificates
- Dev tunnels (ngrok, Cloudflare Tunnel, VS Code tunnels)
- Any non-production HTTPS endpoint

### 8. Chrome SingletonLock

If the browser fails to launch with a lock error, another Chrome instance is using
the same profile directory. Solutions:

- **Preferred**: Use `--cdp-endpoint` to connect to the existing Chrome
- **Alternative**: Close the other Chrome instance
- **Do NOT**: Delete the lock file — this can corrupt the profile

### 9. Localhost Unreachable

If `browser_navigate` to `localhost` fails but `curl localhost` works:

- Try `127.0.0.1` instead of `localhost` (DNS resolution issue)
- Use `--cdp-endpoint` to reuse the user's existing Chrome (bypasses network isolation)
- Check if the dev server is bound to `127.0.0.1` vs `0.0.0.0`

---

## MCP Config Reference

### Recommended Configuration

```json
{
  "playwright": {
    "command": "npx",
    "args": [
      "@playwright/mcp@latest",
      "--caps=network,storage",
      "--viewport-size=1280x720",
      "--console-level=info",
      "--block-service-workers",
      "--ignore-https-errors"
    ]
  }
}
```

### Capability Flags

| Flag | Unlocks | When Needed |
|---|---|---|
| `--caps=network` | `browser_route`, `browser_route_list`, `browser_unroute`, `browser_network_state_set` | API mocking, request interception |
| `--caps=storage` | `browser_cookie_set/get/list/delete`, `browser_localstorage_set/get/list`, `browser_sessionstorage_*` | Cookie/token auth injection |

### Key Launch Options

| Option | Description |
|---|---|
| `--viewport-size=WxH` | Browser viewport dimensions (default: 1280x720) |
| `--console-level=<level>` | Capture console messages at this level and above |
| `--block-service-workers` | Prevent SW interference with route mocking |
| `--ignore-https-errors` | Accept self-signed certs and dev tunnels |
| `--init-page=<path>` | TypeScript file evaluated on Playwright page object before any navigation |
| `--storage-state=<path>` | JSON file with cookies/localStorage from a saved session |
| `--cdp-endpoint=<url>` | Connect to existing Chrome via CDP (avoids SingletonLock, reuses auth) |
| `--extension` | Connect to user's real Chrome/Edge tabs via browser extension |

### When to Use Each Mode

| Mode | Use Case |
|---|---|
| Default (headless) | Automated verification, screenshots, CI |
| `--cdp-endpoint` | Reuse existing Chrome session, OIDC auth, debug live pages |
| `--extension` | Browse with user's real data, cookies, and extensions |
| `--storage-state` | Replay a saved auth session without re-login |
| `--init-page` | Batch mock setup before navigation (screenshot audits) |

---

## CLI Commands

### Project Management

```bash
# Scaffold .playwright-mcp/ directory with config.json and sample profiles
$FORGE_PLAYWRIGHT project init [--target <dir>] [--force]

# Show current project config and status
$FORGE_PLAYWRIGHT project show [--project-dir <dir>]
```

### Profile Management

```bash
# List all available profiles
$FORGE_PLAYWRIGHT profile list

# Show a profile's full configuration
$FORGE_PLAYWRIGHT profile show [name]

# Apply a profile — outputs browser_route/cookie/storage calls to execute
$FORGE_PLAYWRIGHT profile apply [name]
```

### Init Pages

```bash
# List available init-page scripts
$FORGE_PLAYWRIGHT init-page list

# Show an init-page script's content
$FORGE_PLAYWRIGHT init-page show [name]

# Generate an init-page from a profile (for batch screenshot workflows)
$FORGE_PLAYWRIGHT init-page generate [profile-name]
```

### Config Tools

```bash
# Recommend MCP config based on project setup
$FORGE_PLAYWRIGHT config recommend

# Validate MCP args and warn about missing capabilities
$FORGE_PLAYWRIGHT config validate [args...]
```

### Direct Execution

```bash
# Execute arbitrary code against the Playwright skill API
$FORGE_PLAYWRIGHT exec --code 'return pw.profiles.list()'
```

---

## Common Auth Patterns

### SPA + API Mock (Most Common)

The frontend calls an endpoint like `/api/me` to check auth status. Mock it:

```bash
$FORGE_PLAYWRIGHT profile apply admin
# Outputs browser_route calls like:
#   browser_route("**/api/me", "GET", 200, {"id":1,"role":"admin"})
```

Then navigate to the page — the frontend sees the mocked response and renders
the authenticated view.

### Cookie Injection

For apps that check a session cookie server-side:

```bash
# Apply profile with cookies defined
$FORGE_PLAYWRIGHT profile apply admin
# Outputs browser_cookie_set calls like:
#   browser_cookie_set("session_id", "mock-session-abc", "localhost", "/")
```

> ⚠️ Requires `--caps=storage`. Also mock the API endpoint that validates the cookie.

### Token Injection (JWT/Bearer)

For apps that store a JWT in localStorage:

```bash
# Apply profile with localStorage defined
$FORGE_PLAYWRIGHT profile apply admin
# Outputs browser_localstorage_set calls like:
#   browser_localstorage_set("auth_token", "eyJ...")
```

> ⚠️ Requires `--caps=storage`. Set the token BEFORE navigating so the app reads it on load.

### OIDC Bypass

OIDC flows involve external identity providers that can't be easily mocked:

- **Preferred**: Use `--cdp-endpoint` to connect to a Chrome where the user already logged in
- **Alternative**: Use `--extension` to access the user's real browser tabs
- **Fallback**: Use `--storage-state` with a previously saved session

### Flutter Web / Hash Routing

Flutter web apps use hash-based routing (`/#/dashboard`) and may have a Dart-to-JS
bridge. Special considerations:

- Navigate to the base URL first, then use `browser_evaluate` to change routes
- Hash routes may not trigger `browser_route` — mock the underlying API calls instead
- Flutter's service worker aggressively caches — always use `--block-service-workers`

---

## Workflow Examples

### Verify a Page After Code Changes

```
1. $FORGE_PLAYWRIGHT profile apply admin
2. Execute the browser_route calls from step 1
3. browser_navigate("http://localhost:3000/dashboard")
4. browser_snapshot()                          ← accessibility tree
5. browser_take_screenshot(fullPage=true)      ← visual capture
6. browser_console_messages(level="error")     ← check for JS errors
```

### Screenshot Audit (Multiple Pages)

```
1. $FORGE_PLAYWRIGHT init-page generate admin
2. Launch Playwright MCP with --init-page=.playwright-mcp/init-pages/admin.ts
3. For each page URL:
   a. browser_navigate(url)
   b. browser_take_screenshot(fullPage=true, filename="audit-<page>.png")
4. Compare screenshots or present to user
```

### Debug a Broken Page

```
1. browser_navigate("http://localhost:3000/broken-page")
2. browser_console_messages(level="error")     ← FIRST! capture errors
3. browser_snapshot()                          ← check DOM state
4. Analyze errors → fix code → reload → verify
```

### Connect to User's Existing Browser

```
1. Ask user for CDP endpoint: chrome://inspect → copy ws:// URL
2. Launch Playwright MCP with --cdp-endpoint=ws://127.0.0.1:9222/...
3. browser_navigate to the target page (already authenticated)
4. No mocking needed — using real session
```
