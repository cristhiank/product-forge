# Auth Patterns for Playwright MCP

## Pattern 1: SPA + API Mock (Most Common)

For single-page apps that check auth via an API call (e.g., `/api/me`):

```
# Register catch-all FIRST (LIFO: lowest priority)
browser_route(pattern="**/api/**", status=200, body="{}", contentType="application/json")

# Register auth endpoint LAST (LIFO: highest priority)
browser_route(pattern="**/api/me", status=200, body='{"id":"1","email":"admin@test.com","role":"admin"}', contentType="application/json")

# Navigate
browser_navigate(url="http://localhost:3000")
```

**When to use:** React, Vue, Angular, Svelte SPAs with client-side auth guards.

## Pattern 2: Cookie Injection

For apps that check for a session cookie in middleware:

```
# Set the auth cookie (requires --caps=storage)
browser_cookie_set(name="session", value="e2e-session-token", domain="localhost", path="/")

# Navigate — middleware sees the cookie and grants access
browser_navigate(url="http://localhost:3000/dashboard")
```

**When to use:** Express/Next.js apps with cookie-based sessions, OIDC with session cookies.

## Pattern 3: Token Injection (JWT/Bearer)

For apps that store a JWT in localStorage or sessionStorage:

```
# Set the token (requires --caps=storage)
browser_localstorage_set(key="token", value="eyJhbGciOiJIUzI1NiIs...")

# Navigate — app reads token from localStorage on mount
browser_navigate(url="http://localhost:3000/dashboard")
```

**When to use:** SPAs with JWT-based auth stored client-side.

## Pattern 4: Real Browser Session (Zero Mocking)

Connect to the user's authenticated browser:

**Option A: CDP endpoint** — Chrome must be running with `--remote-debugging-port=9222`
```
# MCP config: --cdp-endpoint=http://localhost:9222
# Then just navigate — you have the user's real auth session
browser_navigate(url="http://localhost:3000/dashboard")
```

**Option B: Browser Extension** — Install Playwright MCP Bridge extension
```
# MCP config: --extension
# Connects to current active tab in Chrome/Edge
browser_snapshot()
```

**When to use:** When you need REAL data, not mocks. For debugging prod issues. When OIDC/SSO makes mocking impractical.

## Pattern 5: Storage State File

Login once, save state, reuse across sessions:

```bash
# One-time: save auth state after login
npx @playwright/mcp@latest --isolated --storage-state=./e2e-auth.json
# ... login manually ... then the state file is saved

# Every subsequent session: load saved state
npx @playwright/mcp@latest --storage-state=./e2e-auth.json
```

**When to use:** When auth tokens are long-lived. For CI pipelines with pre-authenticated state.

## Choosing the Right Pattern

| Situation | Pattern | Caps Needed |
|---|---|---|
| SPA with `/api/me` guard | API Mock | `network` |
| Cookie-based middleware auth | Cookie Injection | `storage` |
| JWT stored in localStorage | Token Injection | `storage` |
| Need real production data | CDP/Extension | none |
| OIDC with complex redirect flow | CDP/Extension | none |
| CI pipeline | Storage State | none |
| Flutter web with hash routing | API Mock + init-page | `network` |
