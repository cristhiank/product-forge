# Local Project Setup Guide

## What is `.playwright-mcp/`?

A per-project directory that stores Playwright MCP configuration, mock profiles, and init-page scripts. When agents load the forge-playwright skill, they auto-discover this directory and use it to set up auth mocking, navigate to the right URLs, and avoid common pitfalls.

## Directory Structure

```
.playwright-mcp/
├── config.json             # Project settings (ports, framework, auth pattern)
├── profiles/               # Mock profiles (one per user role)
│   ├── admin.json          # Full-access admin user
│   ├── staff.json          # Limited-permission staff
│   └── unauthenticated.json # No auth (test login flow)
├── init-pages/             # --init-page scripts for auto-mocking
│   ├── mocked.ts           # Full auth + API mock
│   └── passthrough.ts      # Auth only, real API pass-through
└── .gitignore              # Ignore storage-state files
```

## config.json Schema

```json
{
  "ports": {
    "frontend": 3000,          // Dev server port
    "api": 5000,               // Backend API port
    "auth": 8080               // Auth server port (optional)
  },
  "frontendFramework": "react-vite",  // react-vite | next | flutter-web | angular | vue | astro | other
  "authPattern": "api-mock",          // api-mock | cookie | token | oidc | none
  "authEndpoint": "/api/me",          // Endpoint the frontend calls to check auth
  "defaultProfile": "admin",          // Default profile for `profile apply`
  "baseUrl": "http://localhost:3000", // Optional explicit base URL
  "notes": ""                         // Any project-specific notes for agents
}
```

### Field Guide

| Field | Required | Description |
|---|---|---|
| `ports.frontend` | Yes | Port where the frontend dev server runs |
| `ports.api` | Yes | Port where the backend API runs |
| `ports.auth` | No | Port for auth server (Keycloak, Auth0, etc.) |
| `frontendFramework` | Yes | Framework type — affects how auth bypass works |
| `authPattern` | Yes | How the app authenticates — determines which mock pattern to use |
| `authEndpoint` | Yes | The API endpoint the frontend calls to check auth state |
| `defaultProfile` | Yes | Which profile to use when none is specified |
| `baseUrl` | No | Override base URL (useful when not localhost) |
| `notes` | No | Free-form notes for agents (project quirks, special setup) |

## Profile JSON Schema

```json
{
  "name": "admin",
  "description": "Authenticated admin user with full access",
  "routes": [
    {
      "pattern": "**/api/me",
      "status": 200,
      "contentType": "application/json",
      "body": {
        "id": "e2e-admin-id",
        "email": "admin@test.com",
        "name": "E2E Admin",
        "role": "admin"
      },
      "description": "Auth endpoint — return authenticated admin user"
    },
    {
      "pattern": "**/api/**",
      "status": 200,
      "contentType": "application/json",
      "body": {},
      "description": "Catch-all — prevents 401/404 for unmocked endpoints"
    }
  ],
  "cookies": [
    {
      "name": "session",
      "value": "e2e-session-token",
      "domain": "localhost",
      "path": "/"
    }
  ],
  "localStorage": {
    "theme": "light",
    "locale": "en"
  }
}
```

### Route Ordering Rule (CRITICAL)

Playwright MCP uses **LIFO** (last-in, first-out) for route matching. When you define routes in a profile:

- **Catch-all routes** (`**/api/**`) should be listed LAST in the `routes` array
- **Specific routes** (`**/api/me`) should be listed FIRST
- The CLI automatically reverses the order when rendering tool calls

This is handled for you by `$FORGE_PLAYWRIGHT profile apply`, but keep it in mind when writing init-page scripts manually.

## Creating a Profile for Your Project (5-Minute Guide)

### Step 1: Identify the auth endpoint
Look at the frontend auth guard. Common patterns:
- React: `useEffect(() => fetch('/api/me'))` in an auth context/provider
- Next.js: `getServerSession()` or middleware checking cookies
- Flutter: `http.get('/api/me')` in an auth service
- Vue: Pinia store calling `/api/auth/session`

### Step 2: Capture the expected response shape
Options:
- Read the frontend code that parses the auth response
- Check existing test fixtures
- Run the app with real auth and use `browser_network_requests` to capture actual responses
- Ask the developer what the auth endpoint returns

### Step 3: Create the profile
```bash
$FORGE_PLAYWRIGHT project init        # Creates scaffold if needed
# Then edit .playwright-mcp/profiles/admin.json with the real response shape
```

### Step 4: Test it
```bash
$FORGE_PLAYWRIGHT profile apply admin  # Outputs browser_route calls
# Execute the calls, then navigate — verify the dashboard loads
```

### Step 5: Commit
```bash
git add .playwright-mcp/
git commit -m "chore: add Playwright MCP project config"
```

## Common Auth Patterns by Framework

### React + Vite
- Auth guard: `useAuth()` hook calling `/api/me`
- Pattern: `api-mock`
- Profile needs: `/api/me` route with user object containing roles/memberships

### Next.js
- Auth guard: Middleware checking session cookie
- Pattern: `cookie`
- Profile needs: `cookies` array with session cookie, `/api/auth/session` route

### Flutter Web
- Auth guard: Service calling `/api/me`
- Pattern: `api-mock` (same as React, but may use hash routing)
- Special: May need `#/` prefix in URLs for hash-based routing

### Angular
- Auth guard: HTTP interceptor adding Bearer token
- Pattern: `token`
- Profile needs: `localStorage` with JWT token

### OIDC / Keycloak / Auth0
- Auth guard: Redirect to auth server
- Pattern: `oidc`
- Recommended: Use `--cdp-endpoint` or `--extension` mode instead of mocking
- Alternative: Mock the OIDC callback with a pre-built token response
