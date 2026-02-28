# Backlog Agent Skill

A self-contained CLI-based Agent Skill for managing Kanban-lite backlogs across projects.

## What This Is

This skill provides agents with the ability to:
- Create, read, update, and manage backlog items
- Track work across multiple projects
- Maintain backlog health with hygiene checks
- Handle dependencies and cross-references
- Execute multi-step queries via sandboxed JavaScript (`exec`)
- Version history for items

## Structure

```
backlog/
├── SKILL.md              # Agent instructions (read this to learn the skill)
├── README.md             # This file
├── publish-skill.mjs     # Cross-platform publish to ~/.copilot/skills/backlog/
├── scripts/
│   └── backlog.js        # Bundled CLI (single self-contained script)
├── references/           # Detailed docs (CLI reference, workflows, integration)
├── src/                  # TypeScript source
│   ├── skill-cli.ts      # CLI entry point (commands + exec)
│   ├── index.ts          # Library exports
│   ├── backlog-api.ts    # Core API
│   ├── sandbox/          # VM sandbox for exec
│   ├── storage/          # File system storage layer
│   ├── markdown/         # Markdown parsing & templates
│   └── history/          # Version history
├── test/                 # Test suite
├── package.json          # Build configuration
└── tsconfig.json         # TypeScript configuration
```

## Usage

The skill teaches agents to use the CLI:

```bash
node scripts/backlog.js list --folder next
node scripts/backlog.js create --kind task --title "..."
node scripts/backlog.js exec --code 'return await backlog.list({ folder: "next" })'
node scripts/backlog.js stats
```

## Building

```bash
npm install
npm run build    # TypeScript → dist/
npm run bundle   # dist/ → scripts/backlog.js
npm test         # Run tests
```

## Publishing

```bash
npm run publish:skill   # Build, bundle, and deploy to ~/.copilot/skills/backlog/
```

## Auto-Discovery

The CLI automatically discovers `.backlog/` directories in your workspace:

```
workspace/
├── frontend/.backlog/
│   ├── next/
│   ├── working/
│   ├── done/
│   └── archive/
└── api/.backlog/
    ├── next/
    ├── working/
    ├── done/
    └── archive/
```

Run from `workspace/` to operate on both projects, or from a specific project folder for single-project mode.
