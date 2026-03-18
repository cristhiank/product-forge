# Playwright MCP Tools Reference

## Capabilities & Activation

Tools are grouped by capability. Enable with `--caps=<cap1>,<cap2>`:

| Capability | Flag | Tools Unlocked |
|---|---|---|
| **core** | (always on) | browser_navigate, browser_click, browser_snapshot, browser_take_screenshot, browser_evaluate, browser_fill_form, browser_type, browser_select_option, browser_hover, browser_drag, browser_press_key, browser_file_upload, browser_handle_dialog, browser_wait_for, browser_resize, browser_close, browser_navigate_back, browser_tabs, browser_console_messages, browser_network_requests, browser_run_code |
| **network** | `--caps=network` | browser_route, browser_route_list, browser_unroute, browser_network_state_set |
| **storage** | `--caps=storage` | browser_cookie_set/get/list/delete/clear, browser_localstorage_set/get/list/delete/clear, browser_sessionstorage_set/get/list/delete/clear |
| **vision** | `--caps=vision` | Coordinate-based interactions (for visual element targeting) |
| **pdf** | `--caps=pdf` | PDF generation and manipulation |
| **devtools** | `--caps=devtools` | Developer tools features |

## Network Tools (--caps=network)

### browser_route — Mock network requests
Set up a route to intercept and mock requests matching a URL pattern.

**Parameters:**
- `pattern` (string, required): URL glob pattern, e.g. `"**/api/users"`, `"**/*.{png,jpg}"`
- `status` (number, optional): HTTP status code (default: 200)
- `body` (string, optional): Response body (text or JSON string)
- `contentType` (string, optional): Content-Type header, e.g. `"application/json"`
- `headers` (array, optional): Headers in `"Name: Value"` format
- `removeHeaders` (string, optional): Comma-separated header names to remove

**Example:**
```
browser_route(pattern="**/api/me", status=200, body='{"id":"1","name":"Admin"}', contentType="application/json")
```

**⚠️ LIFO ordering:** Routes are matched last-in, first-out. Register catch-all patterns FIRST, specific patterns LAST.

### browser_route_list — List active routes
Shows all currently registered routes. Use for debugging route priority issues.

### browser_unroute — Remove routes
Remove routes matching a pattern (or all routes if no pattern specified).

### browser_network_state_set — Simulate offline
Set browser to `"offline"` or `"online"` mode.

## Storage Tools (--caps=storage)

### Cookies
- `browser_cookie_set(name, value, domain?, path?, expires?, httpOnly?, secure?, sameSite?)`
- `browser_cookie_get(name)` — Get a cookie by name
- `browser_cookie_list(domain?, path?)` — List all cookies
- `browser_cookie_delete(name)` — Delete a cookie
- `browser_cookie_clear()` — Clear all cookies

### localStorage
- `browser_localstorage_set(key, value)`
- `browser_localstorage_get(key)`
- `browser_localstorage_list()` — List all key-value pairs
- `browser_localstorage_delete(key)`
- `browser_localstorage_clear()`

### sessionStorage
Same API as localStorage with `browser_sessionstorage_*` prefix.

## Configuration Flags Reference

| Flag | Description |
|---|---|
| `--caps=network,storage` | Enable network mocking + storage tools |
| `--viewport-size=1280x720` | Consistent viewport for screenshots |
| `--console-level=info` | Capture console messages (error/warning/info/debug) |
| `--block-service-workers` | Prevent SW interference with route mocking |
| `--ignore-https-errors` | Skip TLS validation (dev tunnels, self-signed certs) |
| `--init-page=<path.ts>` | TypeScript file to run on page object before navigation |
| `--init-script=<path.js>` | JS file evaluated in every page before page scripts |
| `--storage-state=<path.json>` | Load cookies/localStorage from saved session |
| `--cdp-endpoint=<url>` | Connect to existing Chrome via CDP |
| `--extension` | Connect to real Chrome/Edge via browser extension |
| `--isolated` | Clean profile per session (no disk persistence) |
| `--user-data-dir=<path>` | Persistent browser profile directory |
| `--save-session` | Save session logs to output directory |
| `--output-dir=<path>` | Directory for screenshots and output files |
| `--headless` | Run browser without visible window |
| `--browser=<name>` | Browser to use: chrome, firefox, webkit, msedge |
| `--device=<name>` | Device emulation, e.g. "iPhone 15" |
