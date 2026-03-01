---
type: brand
version: 1.1.0
status: active
created: '2026-03-01'
updated: '2026-03-01'
updated_by: forge-product
tags:
  - brand
  - ux
  - design
---
# Brand & Design Guide

## Identity

- **Name**: Forge Mission Control
- **CLI command**: `forge-ui`
- **Tagline**: "One tab to rule them all"
- **Personality**: Utilitarian, fast, information-dense — a control room, not a marketing page

## Visual Language

### Theme: Dark Control Room

Inspired by aerospace mission control and terminal aesthetics. Dark backgrounds, high contrast text, status-colored accents.

### Color Palette

| Role | Color | Hex | Usage |
|------|-------|-----|-------|
| Background | Near Black | `#0d1117` | Page background |
| Surface | Dark Gray | `#161b22` | Cards, panels |
| Border | Subtle Gray | `#30363d` | Dividers, borders |
| Text Primary | White | `#e6edf3` | Headings, body |
| Text Secondary | Muted Gray | `#8b949e` | Labels, metadata |
| Accent Blue | Blue | `#58a6ff` | Links, active nav |
| Success | Green | `#3fb950` | Active, healthy, done |
| Warning | Orange | `#d29922` | Stale, working, experiments |
| Danger | Red | `#f85149` | Failed, errors, incidents |
| Info | Purple | `#bc8cff` | Features, experiments |

### Typography

- **Font**: System font stack (`-apple-system, BlinkMacSystemFont, "Segoe UI", ...`)
- **Monospace**: `"SF Mono", "Fira Code", "Cascadia Code", monospace` for IDs, code, logs
- **Size scale**: 12px (small), 14px (body), 16px (headings), 20px (page titles)

### Component Patterns

**Status badges**: Rounded pills with status color background
```
[● Active]  [● Failed]  [● Stale]  [◌ Done]
```

**Cards**: Surface-colored with subtle border, hover highlight
**Tables**: Alternating row shading, sortable headers
**Navigation**: Left sidebar, icon + label, active indicator bar
**Breadcrumbs**: Mode → Section → Item
**Markdown rendering**: GitHub-style with syntax highlighting for code blocks

### Mode Icons

| Mode | Icon | Description |
|------|------|-------------|
| Product | 📋 | Clipboard/docs |
| Backlog | 📦 | Package/tasks |
| Agents | 🤖 | Robot/AI |
| Home | 🔥 | Forge flame |

## Interaction Patterns

- **Navigation**: Single-page feel via htmx (swap HTML fragments without full reload)
- **Loading**: Skeleton screens for slow data (agent sync)
- **Errors**: Inline error banners, not modals
- **Empty states**: Helpful message + action suggestion
- **Keyboard**: `/` to focus search, `1/2/3` to switch modes
