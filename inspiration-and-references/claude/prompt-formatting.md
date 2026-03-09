# Claude Code — Prompt Formatting & Literal Syntax

> Reverse-engineered from Claude Code 2.1.71 (claude-sonnet-4-6).
> Documents the exact formatting patterns, message architecture, and text conventions used in Claude Code's system prompt.

---

## 1. Message Architecture

Claude Code uses the Anthropic Messages API with a **single system prompt + system-reminders injected in the user turn**:

```
┌─────────────────────────────────────────────────┐
│ [1] system       │ Tool definitions (JSON        │
│                  │ schemas), behavioral sections, │
│                  │ memory, environment, MCP,      │
│                  │ gitStatus, fast_mode_info       │
│                  │ ~8,000–12,000 tokens           │
├─────────────────────────────────────────────────┤
│ [2] human        │ User prompt + injected         │
│                  │ <system-reminder> blocks        │
│                  │ (skills, plan mode, date)       │
└─────────────────────────────────────────────────┘
```

**Key design choices:**
- Everything lives in a **single system block** — no separate developer messages.
- Dynamic context (`<system-reminder>` blocks) is injected into the **human message**, not the system prompt.
- Tool definitions include full **JSON Schema** blocks for each tool's parameters.
- Total pre-conversation context: **~8,000–12,000 tokens** (system) + reminders.

---

## 2. Opening Lines

The system prompt opens directly with behavioral rules, **not an identity statement**:

```
# System
 - All text you output outside of tool use is displayed to the user.
```

This is followed by security-critical rules in IMPORTANT: format:

```
IMPORTANT: Assist with authorized security testing, defensive security, CTF challenges...
IMPORTANT: You must NEVER generate or guess URLs for the user...
```

**Pattern:** No "You are Claude" opener. Identity is implicit through behavioral rules. The tool definitions section may appear before or interleaved with instruction sections. Security rules use `IMPORTANT:` prefix immediately after the opening section.

---

## 3. Section Organization

### Top-Level Structure
Uses **`#` markdown headers** for major sections — flat hierarchy with `##`/`###` for subsections only within memory and MCP:

```
# System
 - [rules as dash-bullet lists]

IMPORTANT: [critical rule]
IMPORTANT: [critical rule]

# Doing tasks
 - [rules]

# Executing actions with care
 - [rules]

# Using your tools
 - [rules]

# Tone and style
 - [rules]

# Output efficiency
 - [rules]

# auto memory
## How to save memories
## What to save
## What NOT to save
## Explicit user requests

# Environment
 - Key: value pairs

# MCP Server Instructions
## MSDOCS
### microsoft_docs_search
### microsoft_code_sample_search
### microsoft_docs_fetch
## Workflow

gitStatus: [raw git output block]

<fast_mode_info>
[prose]
</fast_mode_info>
```

### system-reminder Blocks (Injected in User Turn)

```xml
<system-reminder>
The following skills are available for use with the Skill tool:
- keybindings-help: ...
- simplify: ...
</system-reminder>

<system-reminder>
Plan mode is active. The user indicated that they do not want you to execute yet...
## Plan File Info:
...
## Plan Workflow
### Phase 1: Initial Understanding
...
</system-reminder>

<system-reminder>
# currentDate
Today's date is 2026-03-08.
...
</system-reminder>
```

---

## 4. XML Tag Inventory

Claude Code uses **fewer XML tags than Codex** in the base system prompt, but uses them for specific structural purposes:

### In System Prompt

| Tag | Purpose |
|-----|---------|
| `<example_agent_descriptions>` | Agent tool usage examples |
| `<example>` | Examples within tool descriptions (multiple) |
| `<code>` | Code blocks inside `<example>` |
| `<commentary>` | Explanatory notes inside `<example>` |
| `<bad-example>` | Anti-pattern examples (ToolSearch) |
| `<fast_mode_info>` | Fast mode clarification block |

### In User Turn (Injected)

| Tag | Purpose |
|-----|---------|
| `<system-reminder>` | Dynamic context injection (skills, plan mode, date) — multiple instances |
| `<available-deferred-tools>` | List of tools that need ToolSearch loading |

### Comparison: No `<INSTRUCTIONS>` or `<environment_context>` wrappers — those are Codex patterns. Claude Code uses flat key-value for environment and raw blocks for git status.

---

## 5. Rule Expression Patterns

### Dash-Bullet Imperative (Primary)
Most rules are dash-bullet lists with leading space:

```
 - Do not create files unless they're absolutely necessary...
 - Avoid giving time estimates...
 - Only make changes that are directly requested or clearly necessary.
```

Note the **leading space before the dash** — this is a consistent formatting pattern in Claude Code's prompt (` - rule text`).

### Numbered Lists (For Sequential Steps Only)
Used only when order matters:

```
1. Push the branch using -u flag if needed
2. Then create the PR with gh pr create
3. Return the PR URL to the user
```

### Nested Sub-Rules
Indented dash bullets under a parent rule:

```
 - Avoid over-engineering. Only make changes directly requested or clearly necessary.
   - Don't add features, refactor code, or make 'improvements' beyond what was asked.
   - Don't add docstrings, comments, or type annotations to code you didn't change.
   - Don't create helpers, utilities, or abstractions for one-time operations.
```

---

## 6. Emphasis System

Claude Code has a **heavy, multi-level emphasis system** — significantly more aggressive than Codex:

### Hierarchy (Strongest → Weakest)

| Level | Pattern | Example | Count |
|-------|---------|---------|-------|
| 1 (strongest) | `**BOLD ALL CAPS**` | `**MANDATORY PREREQUISITE - THIS IS A HARD REQUIREMENT**` | Rare, for hard blockers |
| 2 | `IMPORTANT:` prefix | `IMPORTANT: You must NEVER generate or guess URLs` | 15+ occurrences |
| 3 | `NEVER` (all caps) | `NEVER run destructive git commands`, `NEVER commit changes unless...` | 10+ occurrences |
| 4 | `MUST` / `MUST NOT` | `you MUST wait for previous calls to finish`, `you MUST NOT make any edits` | Moderate |
| 5 | `**bold**` | `**Phase 1: Initial Understanding**`, `**CORRECT Usage Patterns:**` | Structural labels |
| 6 | `` `backtick` `` | `` `Read`, `Edit`, `git add -A` `` | Code/tool references |
| 7 | `"quoted"` | `"select:NotebookEdit"`, `"/commit"` | Illustrative examples |

### Anti-Pattern Labels
Claude Code uses bold labels to explicitly mark correct vs incorrect patterns:

```
**CORRECT Usage Patterns:**
- [example]

**INCORRECT Usage Patterns - NEVER DO THESE:**
- [example]
```

### Why This Matters
The heavy emphasis system reflects Claude models' tendency to need stronger signals for prohibition. Codex (GPT models) responds to lighter emphasis like `Never` and `Always` without needing ALL CAPS + bold combinations.

---

## 7. Tool Name Formatting

Tool names use **backticks** consistently in prose:

```
 - Read files → use `Read`, not `cat`/`head`/`tail`/`sed`
 - Edit files → use `Edit`, not `sed`/`awk`
```

In tool definitions, names appear as plain text in the JSON schema's `name` field.

---

## 8. Environment Section Format

Uses **indented key-value dash bullets** (not a table, not XML):

```
# Environment
 - Primary working directory: /Users/crilopez/dev/haruk_agent/temp/inspiration
   - Is a git repository: true
 - Platform: darwin
 - Shell: zsh
 - OS Version: Darwin 25.3.0
 - You are powered by the model named Sonnet 4.6
 - The exact model ID is claude-sonnet-4-6
```

Nested facts indent under their parent. This is a distinctive Claude Code pattern.

---

## 9. gitStatus Section Format

Uses a **plain labeled block** — no XML, no markdown header. The label is lowerCamelCase:

```
gitStatus: This is the git status at the start of the conversation.
Current branch: main
Main branch (what PRs typically merge into): main
Status:
 D B-009.1_register_kania_as_meta_tech_provider.md
 M app/frontend/src/routeTree.gen.ts
?? screenshots/onboarding-welcome.png
Recent commits:
a5334a84 feat: platform config UI for Meta/WhatsApp credentials (B-061)
dd2578a0 fix: DemoTenant validation crash + admin E2E tests
```

Raw terminal output is pasted verbatim after a prose intro. No fencing or table formatting.

---

## 10. Tool Definition Format

Each tool has a full JSON Schema definition:

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "additionalProperties": false,
  "properties": {
    "file_path": { "type": "string", "description": "..." },
    "old_string": { "type": "string", "description": "..." },
    "new_string": { "type": "string", "description": "..." }
  },
  "required": ["file_path", "old_string", "new_string"],
  "type": "object"
}
```

Tool descriptions are prose blocks above the schema, with embedded `<example>` tags showing usage patterns.

---

## 11. Example Embedding Pattern

Examples within tool descriptions use XML tags:

```
<example>
<code>
Agent prompt: "Find all files that import the auth module"
</code>
<commentary>
Good: specific, actionable query for Explore agent
</commentary>
</example>

<bad-example>
<code>
Agent prompt: "Look at the code"
</code>
<commentary>
Bad: vague, will waste subagent context
</commentary>
</bad-example>
```

This XML-in-markdown pattern is characteristic of Claude prompts — using XML for structured examples within prose sections.

---

## 12. Structural Patterns Summary

| Element | Claude Code Pattern |
|---------|-------------------|
| **Identity opener** | No "You are..." — starts with `# System` behavioral rules |
| **Section delimiters** | `#` markdown headers (flat, rarely `##`/`###`) |
| **Rule format** | ` - ` dash-bullets with leading space; nested indented sub-bullets |
| **Emphasis** | Heavy 7-level system: `**BOLD CAPS**` → `IMPORTANT:` → `NEVER` → `MUST` → `**bold**` → `` `backtick` `` → `"quoted"` |
| **Tool references** | `` `backtick` `` style |
| **Code examples** | `<example>`/`<bad-example>` XML tags with `<code>` + `<commentary>` children |
| **Conditional rules** | Prose if/when/unless (same as Codex) |
| **Structured data** | JSON Schema for tool definitions |
| **Runtime injection** | `<system-reminder>` blocks in user turn; key-value for Environment |
| **Project instructions** | CLAUDE.md loaded directly into system context (no XML wrapper) |
| **Git context** | `gitStatus:` lowerCamelCase label + raw terminal output |

---

## 13. Design Philosophy

Claude Code's prompt formatting follows a **heavy, explicit, defense-in-depth style**:

1. **Single system message** — everything in one block (unlike Codex's split developer messages). Simpler message architecture, more complex internal structure.
2. **Heavy emphasis system** — 7 levels of emphasis from `**BOLD CAPS**` to `"quoted"`. This compensates for Claude models needing stronger signals for prohibitions.
3. **XML for examples, markdown for rules** — XML tags are used for structured examples within tool descriptions; markdown headers organize the behavioral sections. This is a characteristic Claude prompt engineering pattern.
4. **No identity statement** — behavioral rules implicitly define identity. The model's persona emerges from what it's told to do, not what it's told it is.
5. **system-reminder injection** — dynamic context (skills, plan mode, date) goes in the user turn via `<system-reminder>` tags, keeping the system prompt stable across modes.
6. **Explicit anti-patterns** — `**INCORRECT Usage Patterns - NEVER DO THESE:**` sections are unique to Claude Code. Codex relies on positive instructions only.
7. **Verbatim output templates** — expected outputs (commit messages, PR templates) are shown as literal strings, not described in prose.
