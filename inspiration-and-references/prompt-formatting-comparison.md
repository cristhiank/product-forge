# Codex vs Claude Code — Prompt Formatting Comparison

> Side-by-side analysis of the literal prompt engineering differences between
> OpenAI Codex CLI (GPT-5.4) and Anthropic Claude Code (claude-sonnet-4-6).

---

## 1. Message Architecture

| Aspect | Codex (GPT) | Claude Code |
|--------|-------------|-------------|
| **API style** | Responses/Chat API (multi-role) | Messages API (system + turns) |
| **System messages** | 1 system + 3 developer + 1 user (injected) | 1 system (monolithic) |
| **Total messages before user** | 5 | 1 system + injected `<system-reminder>` in user turn |
| **Project instructions role** | `user` role (with XML wrapper) | Loaded directly into system context |
| **Dynamic context injection** | `<environment_context>` in user message | `<system-reminder>` blocks in user message |
| **Approx. total tokens** | ~14,000–20,000 | ~8,000–12,000 + reminders |

**Key insight:** Codex separates concerns across multiple messages by role (system vs developer vs user). Claude Code packs everything into one system block + user-turn injections. Codex's approach gives the harness more granular control over priority; Claude's is simpler but relies more on in-prompt emphasis to signal priority.

---

## 2. Identity Framing

| Aspect | Codex | Claude Code |
|--------|-------|-------------|
| **System opener** | `You are an AI assistant accessed via an API.` | `# System` — no identity statement |
| **Agent identity** | `You are Codex, a coding agent based on GPT-5.` (developer msg) | Implicit through behavioral rules |
| **Identity pattern** | Two-layer: generic system + specific developer persona | No persona statement; identity emerges from rules |
| **Company attribution** | OpenAI (implicit in system msg) | Anthropic (not explicitly stated in prompt) |

**Key insight:** GPT models receive an explicit "You are X" identity statement. Claude prompts skip the identity declaration entirely — the model's behavior is shaped purely by rules, not self-concept. This reflects different prompt engineering philosophies: GPT responds well to role-play framing; Claude responds to behavioral constraints.

---

## 3. Section Delimiters

| Pattern | Codex | Claude Code |
|---------|-------|-------------|
| **Primary** | `#`/`##` markdown headers | `#` markdown headers (flatter) |
| **Secondary** | XML tags for semantic blocks | `##`/`###` only in subsections (memory, MCP, plan mode) |
| **Permissions** | `<permissions instructions>` XML block | Inline rules, no special wrapper |
| **Browsing rules** | `<situations_where_you_must_browse_the_internet>` | `IMPORTANT:` prefixed rules |
| **Examples** | Fenced code blocks | `<example>`/`<bad-example>` XML tags |
| **Anti-patterns** | Not explicitly marked | `**INCORRECT Usage Patterns - NEVER DO THESE:**` |

**Key insight:** Codex uses **long, descriptive XML tag names** (`<situations_where_you_must_browse_the_internet>`) as self-documenting semantic boundaries. Claude Code uses **markdown headers + bold labels** for organization and reserves XML tags almost exclusively for structured examples within tool descriptions.

---

## 4. Emphasis System

This is the **most dramatic difference** between the two systems.

### Codex (Light Touch)

```
Emphasis hierarchy (3 levels):
1. ALWAYS / NEVER / IMPORTANT (all caps words)
2. Always / Never / Must / Do not (capitalized imperatives)
3. `backtick` for identifiers
```

Example:
```
- Always use `apply_patch` for manual edits.
- Never revert changes you didn't make.
- Very important: The user is in United States.
```

### Claude Code (Heavy, Multi-Level)

```
Emphasis hierarchy (7 levels):
1. **BOLD ALL CAPS** headers       ("**MANDATORY PREREQUISITE**")
2. IMPORTANT: prefix               (15+ occurrences)
3. NEVER (all caps inline)         (10+ occurrences)  
4. MUST / MUST NOT (all caps)      (moderate use)
5. **bold** labels                 (structural)
6. `backtick` identifiers          (code/tools)
7. "quoted" strings                (examples)
```

Example:
```
IMPORTANT: You must NEVER generate or guess URLs...

**CORRECT Usage Patterns:**
 - Use `ToolSearch` with keywords first

**INCORRECT Usage Patterns - NEVER DO THESE:**
 - Calling a deferred tool without loading it first
```

### Why the Difference?

GPT models are more responsive to lighter emphasis signals. Claude models benefit from stronger, more redundant emphasis for prohibitions — hence the multi-layered `IMPORTANT:` + `NEVER` + `**BOLD**` stacking. This is a core Claude prompt engineering insight: **repeat critical rules with escalating emphasis**.

---

## 5. Rule Expression

| Pattern | Codex | Claude Code |
|---------|-------|-------------|
| **Primary format** | `- Rule text.` (dash-bullet) | ` - Rule text.` (space-dash-bullet) |
| **Leading space** | No | Yes (` - `) |
| **Nested rules** | Rare | Common (indented sub-bullets) |
| **Numbered lists** | For steps + configuration | Only for sequential steps |
| **Conditional format** | `If X, do Y.` (natural language) | Same: `If X, do Y.` |
| **Prohibition format** | `Do not X.` / `Never X.` | `NEVER X.` / `Do not X.` / `you MUST NOT X.` |
| **Correct/incorrect** | Positive rules only | Explicit anti-pattern sections |

**Example comparison:**

Codex:
```md
- Prefer `apply_patch` for manual edits.
- Do not use Python for simple file writes.
```

Claude Code:
```md
 - Do NOT use Bash when a dedicated tool is provided:
   - Read files → use `Read`, not `cat`/`head`/`tail`/`sed`
   - Edit files → use `Edit`, not `sed`/`awk`
```

**Key insight:** Claude Code uses a **"do this, not that"** pattern extensively — pairing the correct tool with the forbidden alternative. Codex states preferences without listing what to avoid.

---

## 6. Tool Schema Presentation

| Aspect | Codex | Claude Code |
|--------|-------|-------------|
| **Schema format** | TypeScript-like function signatures in developer message | Full JSON Schema in system message |
| **Schema size** | Compact | Verbose (each tool has `$schema`, `additionalProperties`, etc.) |
| **Usage examples** | Inline prose | `<example>` / `<bad-example>` XML tags |
| **Tool count** | ~7 tools | ~15+ tools (many deferred) |

---

## 7. Runtime Context Injection

| Context | Codex | Claude Code |
|---------|-------|-------------|
| **Date** | `<current_date>2026-03-08</current_date>` in `<environment_context>` | `<system-reminder># currentDate\nToday's date is 2026-03-08.</system-reminder>` |
| **Environment** | XML child elements in user message | Key-value ` - ` bullets in system prompt `# Environment` section |
| **Git status** | Not injected (must inspect via commands) | `gitStatus:` lowerCamelCase label + raw terminal dump |
| **Skills/modes** | Skills loaded from SKILL.md when triggered | `<system-reminder>` blocks listing available skills |
| **Permissions** | `<permissions instructions>` XML block in developer message | Inline rules within behavioral sections |

**Key insight:** Codex uses **XML exclusively** for runtime data injection. Claude Code uses a **hybrid** — `<system-reminder>` XML for dynamic turn-level data, but markdown key-value for static environment info.

---

## 8. Project Instruction Wrapping

| Aspect | Codex | Claude Code |
|--------|-------|-------------|
| **File name** | `AGENTS.md` | `CLAUDE.md` |
| **Injection role** | `user` message | System context (auto-loaded) |
| **XML wrapper** | `<INSTRUCTIONS>...</INSTRUCTIONS>` | None — raw markdown |
| **Header** | `# AGENTS.md instructions for /path/to/workspace` | (content appears directly) |
| **Hierarchy** | Global → repo root → subdirectory | Global → `~/.claude/` → repo root → `.claude/` → subdirectory |

**Key insight:** Codex wraps project instructions in XML (`<INSTRUCTIONS>`) and injects them as a user message — this clearly delineates them from harness instructions. Claude Code loads CLAUDE.md directly into the system context without wrappers, treating them as part of the system prompt.

---

## 9. Pattern Summary for Prompt Engineers

### If building for GPT models (like Codex):
- Use `You are X` identity framing
- Split instructions across system/developer/user roles for priority control
- Use descriptive XML tags for semantic blocks
- Keep emphasis light: `Always`/`Never`/`Important`
- State positive rules; avoid explicit anti-pattern sections
- Wrap injected content in XML tags

### If building for Claude models (like Claude Code):
- Skip identity framing — define behavior through rules
- Use a single system message with markdown headers
- Use heavy emphasis: `IMPORTANT:` + `NEVER` + `**BOLD**` stacking
- Pair correct patterns with explicit anti-patterns
- Use `<example>`/`<bad-example>` XML for tool usage examples
- Use `<system-reminder>` in user turns for dynamic context
- Add leading space before dash-bullets (` - rule`)
- Redundantly state critical prohibitions

### Universal patterns (both use):
- Markdown headers for section organization
- Backticks for tool names, paths, commands
- Dash-bullet lists for rules
- Natural language conditionals (if/when/unless)
- Fenced code blocks for code examples
- JSON Schema for tool parameter definitions
