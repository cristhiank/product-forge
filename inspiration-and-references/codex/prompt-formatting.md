# Codex CLI — Prompt Formatting & Literal Syntax

> Reverse-engineered from codex-cli 0.111.0 (GPT-5.4).
> Documents the exact formatting patterns, message architecture, and text conventions used in Codex's system prompt.

---

## 1. Message Architecture

Codex uses the OpenAI Responses/Chat API with **multiple role-typed messages**:

```
┌─────────────────────────────────────────────────┐
│ [1] system       │ Global AI behavior, browsing │
│                  │ rules, citation rules, tool   │
│                  │ schemas, formatting rules      │
│                  │ ~3,500–4,500 tokens            │
├─────────────────────────────────────────────────┤
│ [2] developer    │ Date/location, tool namespace │
│                  │ definitions, planning tools    │
│                  │ ~1,500–2,500 tokens            │
├─────────────────────────────────────────────────┤
│ [3] developer    │ Codex agent identity, coding  │
│                  │ behavior, editing rules,       │
│                  │ review style, personality      │
│                  │ ~2,500–3,500 tokens            │
├─────────────────────────────────────────────────┤
│ [4] developer    │ Sandbox/permissions block     │
│                  │ (XML-tagged, very short)       │
│                  │ ~50–150 tokens                 │
├─────────────────────────────────────────────────┤
│ [5] user         │ AGENTS.md content + env       │
│                  │ context (XML-wrapped)          │
│                  │ ~6,000–9,000 tokens            │
├─────────────────────────────────────────────────┤
│ [6] user         │ Actual user prompt            │
└─────────────────────────────────────────────────┘
```

**Key design choices:**
- System message is a **single block** (not split across multiples).
- Developer instructions are split into **3 separate developer messages** with distinct responsibilities.
- Project instructions (AGENTS.md) are injected as a **user role** message, not developer.
- Total pre-conversation context: **~14,000–20,000 tokens**.

---

## 2. Opening Lines

Each message has a distinctive opening pattern:

| Message | Opening Line |
|---------|--------------|
| `system` | `You are an AI assistant accessed via an API.` |
| `developer` #1 | `# Instructions\n\nVery important: The user is in an estimated location of United States. ...` |
| `developer` #2 | `You are Codex, a coding agent based on GPT-5. You and the user share the same workspace and collaborate to achieve the user's goals.` |
| `developer` #3 | `<permissions instructions>\nFilesystem sandboxing defines which files can be read or written. ...` |
| `user` (injected) | `# AGENTS.md instructions for /path/to/workspace\n\n<INSTRUCTIONS>` |

**Pattern:** The system message uses generic "You are an AI assistant" framing. The developer message adds the specific Codex identity. This is a two-layer identity pattern.

---

## 3. Section Organization

### System Message Structure
Uses a **mix of markdown headers and XML-like tagged blocks**:

```
You are an AI assistant accessed via an API.

# Desired oververbosity for the final answer (not analysis):
[configuration text]

<situations_where_you_must_browse_the_internet>
- [rule]
- [rule]
</situations_where_you_must_browse_the_internet>

<situations_where_you_must_not_browse_the_internet>
- [rule]
- [rule]
</situations_where_you_must_not_browse_the_internet>

<special_cases>
- [rule]
</special_cases>

# Valid channels: analysis, commentary, final, summary.
```

### Developer Message Structure
Uses **markdown headers + bullet lists**:

```
You are Codex, a coding agent based on GPT-5.

# Personality
[prose description]

## Section Title
- Rule as imperative sentence.
- Another rule.
- Prefer `tool_x` over `tool_y`.
```

### Sandbox Message
Uses **XML-like tags**:

```
<permissions instructions>
Filesystem sandboxing defines which files can be read or written.
Approval policy is currently never.
</permissions instructions>
```

### AGENTS.md Injection
Uses **XML wrappers around markdown content**:

```
# AGENTS.md instructions for /path/to/workspace

<INSTRUCTIONS>
[full AGENTS.md markdown content]
</INSTRUCTIONS>

<environment_context>
  <current_date>2026-03-08</current_date>
  <timezone>America/Los_Angeles</timezone>
</environment_context>
```

---

## 4. XML Tag Inventory

Codex uses **short, descriptive XML tags** — but sparingly, only where semantic grouping matters:

| Tag | Location | Purpose |
|-----|----------|---------|
| `<situations_where_you_must_browse_the_internet>` | system | Browsing rules (must) |
| `<situations_where_you_must_not_browse_the_internet>` | system | Browsing rules (must not) |
| `<special_cases>` | system | Edge case rules |
| `<permissions instructions>` | developer #3 | Sandbox constraints |
| `<INSTRUCTIONS>` | user (injected) | AGENTS.md content wrapper |
| `<environment_context>` | user (injected) | Runtime context |
| `<current_date>` | nested in env | Date value |
| `<timezone>` | nested in env | Timezone value |

**Pattern:** XML tags are used for **semantically bounded blocks** where the model needs to clearly identify the boundary of a rule category. Regular sections use markdown headers instead.

---

## 5. Rule Expression Patterns

### Imperative Style (Primary)
Most rules are direct imperative sentences in dash-bullet lists:

```md
- Always use `apply_patch` when [condition].
- Do not [action] unless [exception].
- Prefer `rg` over `grep` for searching.
- Never [forbidden action] without explicit user request.
```

### Emphasis Keywords
| Pattern | Usage |
|---------|-------|
| `Always ...` | Positive requirements |
| `Never ...` | Hard prohibitions |
| `Do not ...` | Prohibitions |
| `Prefer ...` | Soft preferences |
| `Must ...` / `Must not ...` | Hard requirements |
| `ALWAYS` / `NEVER` | ALL CAPS for strongest emphasis |
| `IMPORTANT` | Used but less prominent than in Claude |
| `Very important:` | Sentence-level emphasis (developer #1 opening) |

### Conditional Rules
Natural language if/then patterns:

```
- If X, do Y.
- When X, use Y.
- Unless X, assume Y.
- Before X, do Y.
- If these conflict, X takes precedence.
```

---

## 6. Tool Name Formatting

Tool names are consistently referenced in **backticks**:

```md
- Use `apply_patch` for manual edits.
- Prefer `rg` for searching files.
- Use `exec_command` for shell commands.
```

The namespaced format `functions.tool_name` is used in tool schemas but not in prose rules.

---

## 7. Structural Patterns Summary

| Element | Codex Pattern |
|---------|---------------|
| **Identity opener** | `You are an AI assistant...` (system) + `You are Codex...` (developer) |
| **Section delimiters** | Mix of `#`/`##` markdown headers + XML tags for special blocks |
| **Rule format** | Dash-bullet imperative sentences |
| **Emphasis** | `Always`/`Never`/`IMPORTANT`/`Very important:` |
| **Tool references** | `` `backtick` `` style |
| **Code examples** | Fenced code blocks with language tags |
| **Conditional rules** | Natural language if/when/unless |
| **Structured data** | JSON-like schemas in tool definitions |
| **Runtime injection** | XML `<environment_context>` block with child elements |
| **Project instructions** | XML `<INSTRUCTIONS>` wrapper around markdown |

---

## 8. Design Philosophy

Codex's prompt formatting follows a **minimal, functional style**:

1. **Few XML tags** — only used for semantic boundaries (browsing rules, permissions, injected content). Most organization uses markdown headers.
2. **No heavy emphasis system** — no `**BOLD CAPS**` patterns, no `MANDATORY PREREQUISITE` headers. Emphasis is lighter: `Always`, `Never`, `Very important:`.
3. **Compact messages** — each developer message is focused on one concern (tools, behavior, permissions).
4. **Two-layer identity** — generic system identity + specific developer persona, split across messages.
5. **User-role injection** — AGENTS.md goes in user role (not developer), preserving the developer layer for harness control.
6. **Descriptive XML tag names** — `<situations_where_you_must_browse_the_internet>` is self-documenting, almost sentence-like.
