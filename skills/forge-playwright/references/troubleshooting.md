# Troubleshooting Playwright MCP

## Chrome SingletonLock Error

**Symptom:** Browser fails to launch with an error about an existing Chrome process.

**Cause:** Another Chrome instance is using the same user-data-dir.

**Fixes:**
1. Close other Chrome instances
2. Delete the SingletonLock file: `rm ~/Library/Caches/ms-playwright/mcp-chrome-profile/SingletonLock`
3. Use `--cdp-endpoint=http://localhost:9222` to connect to the existing Chrome instead
4. Use `--isolated` mode (fresh profile each time)

## Localhost Unreachable (ERR_CONNECTION_REFUSED)

**Symptom:** `browser_navigate("http://localhost:3000")` fails even though `curl localhost:3000` works.

**Cause:** The MCP Playwright browser may be in a different network namespace.

**Fixes:**
1. Try `http://127.0.0.1:3000` instead of `http://localhost:3000`
2. Use `--cdp-endpoint` to connect to your existing Chrome (which IS on localhost)
3. Verify the dev server is actually running with `curl -I http://localhost:3000`

## Dev Tunnel Interstitial Page

**Symptom:** Navigation lands on a Microsoft "trust this site" interstitial instead of your app.

**Cause:** `*.devtunnels.ms` URLs show a trust dialog that Playwright can't click through.

**Fixes:**
1. Use `--cdp-endpoint` to connect to a Chrome session where you've already trusted the tunnel
2. Add `--ignore-https-errors` to skip TLS-related issues
3. Use localhost instead of the tunnel URL when possible

## browser_route Not Working

**Symptom:** `browser_route` tool is not available or doesn't intercept requests.

**Fixes:**
1. Verify `--caps=network` is in your MCP config args
2. Register routes BEFORE navigating (routes only intercept future requests)
3. Check for service workers: add `--block-service-workers`
4. Use `browser_route_list` to verify routes are registered
5. Remember LIFO ordering: catch-all patterns should be registered FIRST

## browser_cookie_set / browser_localstorage_set Not Available

**Symptom:** Storage tools not found in the tool list.

**Fix:** Add `--caps=storage` to your MCP config args.

## Screenshots All Show Login Page

**Symptom:** Every screenshot captures the login/redirect page instead of the actual content.

**Cause:** Auth guard redirects unauthenticated users to login.

**Fix:** Apply a mock profile BEFORE navigating:
```
$FORGE_PLAYWRIGHT profile apply admin
# Execute the browser_route calls from the output
# THEN navigate
```

## Init-Page Script Not Taking Effect

**Symptom:** `--init-page` script doesn't seem to run.

**Fixes:**
1. Verify the file path is correct and the file exists
2. Init-page scripts must export a default async function: `export default async ({ page }) => { ... }`
3. Check for TypeScript errors in the init-page file
4. The script runs once per page creation, not per navigation
