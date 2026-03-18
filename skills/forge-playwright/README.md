# forge-playwright

Forge Playwright Skill — CLI for managing Playwright MCP profiles, mock data, and project configs.

## Architecture

**Two-layer design:**

1. **Global skill** (`skills/forge-playwright/`) — Universal Playwright MCP knowledge, CLI, config management
2. **Local per-project** (`.playwright-mcp/` in each repo) — Project-specific mock profiles, init-page scripts, port conventions

## Quick Start

```bash
# Install dependencies
cd skills/forge-playwright && npm install

# Run tests (24 tests)
npm test

# Build CLI bundle
npm run build

# Publish to ~/.copilot/skills/forge-playwright/
npm run publish:skill
```

## CLI Commands

```bash
# Scaffold .playwright-mcp/ in a project
$FORGE_PLAYWRIGHT project init

# Show discovered project config
$FORGE_PLAYWRIGHT project show

# List/show/apply mock profiles
$FORGE_PLAYWRIGHT profile list
$FORGE_PLAYWRIGHT profile show admin
$FORGE_PLAYWRIGHT profile apply admin

# List/show/generate init-page scripts
$FORGE_PLAYWRIGHT init-page list
$FORGE_PLAYWRIGHT init-page show mocked
$FORGE_PLAYWRIGHT init-page generate admin

# MCP config recommendations
$FORGE_PLAYWRIGHT config recommend
$FORGE_PLAYWRIGHT config validate @playwright/mcp@latest --caps=network

# Sandbox exec
$FORGE_PLAYWRIGHT exec --code 'return pw.profiles.list()'
```

## Project Directory Structure

When you run `$FORGE_PLAYWRIGHT project init`, it creates:

```
.playwright-mcp/
├── config.json           # Ports, framework, auth pattern
├── profiles/
│   └── admin.json        # Default admin profile
├── init-pages/
│   └── mocked.ts         # Auto-mock init-page script
└── .gitignore            # Ignore storage-state files
```

## Recommended MCP Config

```json
{
  "mcpServers": {
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
}
```

## Development

```bash
npm install          # Install deps
npm test             # Run 24 tests
npm run build        # Bundle CLI with ncc
npm run publish:skill # Publish to ~/.copilot/skills/
```
