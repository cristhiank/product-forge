# CLI Coding Agents — One-Shot Usage Guide

Reference for invoking `codex` (OpenAI Codex CLI) and `claude` (Anthropic Claude Code) as **non-interactive, scriptable tools** from the command line. Designed for orchestration by other agents, shell scripts, and CI pipelines.

> **Versions tested:** codex-cli 0.111.0 · Claude Code 2.1.71

---

## Quick Reference

| Capability | Codex CLI | Claude Code |
|---|---|---|
| One-shot command | `codex exec "prompt"` | `claude -p "prompt"` |
| Stdin prompt | `echo "prompt" \| codex exec -` | `echo "prompt" \| claude -p` |
| Model selection | `-m gpt-5.3-codex` | `--model sonnet` |
| Working directory | `-C /path/to/dir` | `cd /path && claude -p ...` |
| JSON output | `--json` (JSONL events) | `--output-format json` |
| Structured output | `--output-schema schema.json` | `--json-schema '{...}'` |
| Session resume | `codex exec resume <thread_id> "prompt"` | `claude -p --resume <session_id> "prompt"` |
| File output | `-o result.txt` (last message) | pipe stdout to file |
| Sandbox policy | `-s read-only \| workspace-write \| danger-full-access` | `--permission-mode bypassPermissions \| plan \| auto` |
| Approval bypass | `--full-auto` or `--dangerously-bypass-approvals-and-sandbox` | `--dangerously-skip-permissions` |
| Cost limit | _(not available)_ | `--max-budget-usd 0.50` |
| Ephemeral (no persist) | `--ephemeral` | `--no-session-persistence` |
| Custom system prompt | _(via AGENTS.md / config)_ | `--system-prompt "..."` or `--append-system-prompt "..."` |
| Tool restrictions | _(via sandbox mode)_ | `--allowed-tools "Read Grep Glob Bash"` |
| Additional dirs | `--add-dir /other/path` | `--add-dir /other/path` |
| Web search | `--search` | _(via MCP servers)_ |
| Image input | `-i image.png` | _(not available in print mode)_ |

---

## 1. Codex CLI (`codex exec`)

### Core Pattern

```bash
codex exec [FLAGS] "Your prompt here"
```

The `exec` subcommand runs Codex non-interactively. It processes the prompt, executes any tool calls autonomously, and exits when done.

### Sandbox Modes (required for exec)

| Mode | Behavior |
|---|---|
| `read-only` | Can read the entire filesystem. Cannot write, create, or delete anything. Best for analysis/review tasks. |
| `workspace-write` | Can read everything. Can write only within the git repo root (and `--add-dir` paths). **Recommended for code tasks.** |
| `danger-full-access` | Full filesystem and network. No restrictions. Use only in already-sandboxed environments. |

### Approval Policies

For non-interactive use, always pair sandbox with an approval bypass:

```bash
# Recommended: sandboxed auto-execution
codex exec --full-auto "Fix the failing test in src/auth.ts"

# Equivalent to:
codex exec -s workspace-write -a on-request "Fix the failing test in src/auth.ts"

# For read-only analysis:
codex exec -s read-only "Explain what src/auth.ts does"
```

### JSONL Event Stream (`--json`)

When `--json` is passed, codex emits structured JSONL events to stdout:

```bash
codex exec --json --full-auto "Add input validation to the signup form" 2>&1
```

Event types:
```jsonl
{"type":"thread.started","thread_id":"019ccf06-4b80-..."}
{"type":"turn.started"}
{"type":"item.completed","item":{"id":"item_0","type":"agent_message","text":"Done. I added..."}}
{"type":"turn.completed","usage":{"input_tokens":10937,"output_tokens":27}}
```

Extract the final message:
```bash
codex exec --json --full-auto "task" 2>&1 | \
  python3 -c "
import sys, json
for line in sys.stdin:
    d = json.loads(line)
    if d.get('type') == 'item.completed':
        print(d['item']['text'])
"
```

Or use `--output-last-message` / `-o`:
```bash
codex exec --full-auto -o result.txt "Explain the auth module"
cat result.txt
```

### Structured Output (`--output-schema`)

Force the final response into a JSON shape:

```bash
cat > /tmp/schema.json << 'EOF'
{
  "type": "object",
  "properties": {
    "summary": { "type": "string" },
    "files_changed": { "type": "array", "items": { "type": "string" } },
    "confidence": { "type": "number" }
  },
  "required": ["summary", "files_changed", "confidence"],
  "additionalProperties": false
}
EOF

codex exec --full-auto --json --output-schema /tmp/schema.json \
  "Refactor the auth middleware and describe what you did"
```

> **Important:** The schema must include `"additionalProperties": false` at every object level (OpenAI API requirement).

### Session Continuation

Codex persists sessions by thread ID (visible in the `thread.started` JSONL event). Resume with follow-up prompts:

```bash
# First call — capture the thread_id
THREAD_ID=$(codex exec --json --full-auto "Set up the database schema" 2>&1 | \
  python3 -c "import sys,json; [print(json.loads(l)['thread_id']) for l in sys.stdin if json.loads(l).get('type')=='thread.started']")

# Follow-up call — resume the same session
codex exec resume "$THREAD_ID" "Now add seed data for the test tenant"
```

Use `--ephemeral` on throwaway tasks to skip persisting:
```bash
codex exec --ephemeral -s read-only "What does this file do?"
```

### Model Selection

```bash
codex exec -m o3 --full-auto "Complex refactoring task"
codex exec -m gpt-5.3-codex --full-auto "Standard coding task"
codex exec -m codex-mini --full-auto "Quick formatting fix"
```

### Code Review (Specialized)

```bash
# Review uncommitted changes
codex review --uncommitted

# Review against a base branch
codex review --base main

# Review a specific commit
codex review --commit abc1234

# Custom review instructions
codex review --base main "Focus on security issues and SQL injection"
```

### Instruction Files

Codex automatically loads instruction context from these files (all optional):

| File | Scope |
|---|---|
| `~/.codex/instructions.md` | Global — all repos |
| `AGENTS.md` (repo root) | Project — entire repo |
| `AGENTS.md` (subdirectory) | Directory-scoped — that subtree only |
| `~/.codex/config.toml` | Global config (model, sandbox defaults, features) |

### Stdin Piping

```bash
# Pipe prompt from stdin (use - as prompt argument)
cat task-description.md | codex exec --full-auto -

# Pipe file content as context
echo "Review this code:\n$(cat src/auth.ts)" | codex exec -s read-only -
```

### Full One-Shot Template

```bash
codex exec \
  -m gpt-5.3-codex \
  -s workspace-write \
  --full-auto \
  --json \
  -o /tmp/result.txt \
  -C /path/to/repo \
  "Implement the feature described in issue #42. \
   Write tests. Run them to verify."
```

---

## 2. Claude Code (`claude -p`)

### Core Pattern

```bash
claude -p [FLAGS] "Your prompt here"
```

The `-p` / `--print` flag runs Claude Code non-interactively: it processes the prompt, uses tools as needed, prints the result, and exits.

### Permission Modes

| Mode | Behavior |
|---|---|
| `default` | Asks for permission on writes (blocks in non-interactive — avoid) |
| `plan` | Read-only planning mode. Cannot edit files. |
| `acceptEdits` | Auto-accepts file edits, still asks for shell commands |
| `auto` | Agent decides when to ask. Safe default for automation. |
| `bypassPermissions` | Skips all permission checks. **Recommended for trusted one-shot use.** |

```bash
# Recommended for one-shot code tasks in trusted directories
claude -p --permission-mode bypassPermissions "Fix the auth bug in src/middleware.ts"

# Alternative: dangerous flag (equivalent + stronger)
claude -p --dangerously-skip-permissions "Fix the auth bug"

# Read-only analysis
claude -p --permission-mode plan "Explain the auth flow in this codebase"
```

### Output Formats

```bash
# Plain text (default) — just the response text
claude -p "What does src/auth.ts do?"

# JSON envelope — includes metadata, cost, session_id
claude -p --output-format json "What does src/auth.ts do?"
# → {"type":"result","result":"...","session_id":"...","total_cost_usd":0.039,...}

# Stream JSON — real-time events (requires --verbose)
claude -p --output-format stream-json --verbose "Refactor auth"
```

Extract result from JSON:
```bash
RESULT=$(claude -p --output-format json --permission-mode bypassPermissions "task" | \
  python3 -c "import sys,json; print(json.load(sys.stdin)['result'])")
```

### Structured Output (`--json-schema`)

```bash
claude -p --permission-mode bypassPermissions \
  --json-schema '{"type":"object","properties":{"summary":{"type":"string"},"risk":{"type":"string","enum":["low","medium","high"]}},"required":["summary","risk"]}' \
  "Analyze the security of the auth module"
```

> Note: `--json-schema` constrains the model's text output shape. Combine with `--output-format json` if you also want the metadata envelope.

### Session Continuation

Claude Code persists sessions by UUID. Resume with `--resume`:

```bash
# First call — capture session_id from JSON output
SESSION_ID=$(claude -p --output-format json --permission-mode bypassPermissions \
  "Set up the database schema" | \
  python3 -c "import sys,json; print(json.load(sys.stdin)['session_id'])")

# Follow-up — resume the same conversation
claude -p --resume "$SESSION_ID" --permission-mode bypassPermissions \
  "Now add seed data for the test tenant"
```

Pre-assign a session ID for cleaner scripting:
```bash
SESSION_ID=$(python3 -c "import uuid; print(uuid.uuid4())")

claude -p --session-id "$SESSION_ID" --permission-mode bypassPermissions "Step 1: create models"
claude -p --resume "$SESSION_ID" --permission-mode bypassPermissions "Step 2: add endpoints"
claude -p --resume "$SESSION_ID" --permission-mode bypassPermissions "Step 3: write tests"
```

Skip persistence for throwaway tasks:
```bash
claude -p --no-session-persistence "Quick question about Python decorators"
```

### Model Selection

```bash
claude -p --model sonnet "Standard task"          # claude-sonnet-4-6
claude -p --model opus "Complex architecture"      # claude-opus-4-6
claude -p --model haiku "Quick classification"     # claude-haiku-4-5

# Full model names also work
claude -p --model claude-sonnet-4-6 "task"

# Fallback model for overload resilience
claude -p --model opus --fallback-model sonnet "Important task"
```

### Tool Restrictions

```bash
# Only allow specific tools
claude -p --allowed-tools "Read Grep Glob Bash" --permission-mode bypassPermissions \
  "Analyze the codebase architecture"

# Block specific tools
claude -p --disallowed-tools "Edit Write Bash" \
  "Explain what this code does (read-only)"

# Disable all tools (pure chat)
claude -p --tools "" "Explain the visitor pattern"

# Use default tool set
claude -p --tools "default" "Fix the bug"
```

Available built-in tools: `Read`, `Write`, `Edit`, `MultiEdit`, `Glob`, `Grep`, `LS`, `Bash`, `Agent`, `Task`, `GitDiff`, `GitLog`, `BrowserAction`, `MemoryRead`, `MemoryWrite`.

### Cost Control

```bash
# Cap spending at $2 for this invocation
claude -p --max-budget-usd 2.00 --permission-mode bypassPermissions \
  "Refactor the entire auth module"
```

### System Prompt Injection

```bash
# Override system prompt entirely
claude -p --system-prompt "You are a security auditor. Only report vulnerabilities." \
  "Review src/auth.ts"

# Append to the default system prompt (preserves built-in context)
claude -p --append-system-prompt "Always write tests for any code changes." \
  --permission-mode bypassPermissions "Add input validation"
```

### Custom Agents

Define inline agents with `--agents` and select with `--agent`:

```bash
claude -p \
  --agents '{"reviewer":{"model":"opus","description":"Security reviewer","prompt":"You are a senior security engineer. Focus only on security vulnerabilities, injection risks, and auth bypasses. Do not comment on style."}}' \
  --agent reviewer \
  --permission-mode plan \
  "Review this codebase for security issues"
```

### MCP Servers

```bash
# Load MCP servers from a config file
claude -p --mcp-config .mcp.json --permission-mode bypassPermissions "Search docs for auth patterns"

# Inline MCP config
claude -p --mcp-config '{"mcpServers":{"tavily":{"command":"npx","args":["-y","tavily-mcp"],"env":{"TAVILY_API_KEY":"..."}}}}' \
  "Search the web for best practices"
```

### Instruction Files

Claude Code automatically loads project instructions from these files:

| File | Scope |
|---|---|
| `~/CLAUDE.md` or `~/.claude/CLAUDE.md` | Global — all projects |
| `CLAUDE.md` (repo root) | Project — entire repo |
| `.claude/CLAUDE.md` | Alternative project-level |
| `CLAUDE.md` (subdirectory) | Directory-scoped |
| `.claude/settings.json` | Project settings (permissions, env) |
| `.claude/settings.local.json` | Local overrides (gitignored) |
| `.mcp.json` | Project MCP server definitions |

### Stdin Piping

```bash
# Pipe prompt from stdin
cat task.md | claude -p --permission-mode bypassPermissions

# Pipe context + prompt
echo "Fix this code:\n$(cat src/broken.ts)" | claude -p --permission-mode bypassPermissions
```

### Full One-Shot Template

```bash
claude -p \
  --model sonnet \
  --permission-mode bypassPermissions \
  --output-format json \
  --max-budget-usd 1.00 \
  --allowed-tools "Read Edit Write Bash Grep Glob" \
  --append-system-prompt "Follow existing code conventions. Write tests." \
  "Implement the feature described in issue #42. Write tests. Run them to verify."
```

---

## 3. Session Continuation Patterns

Both tools support multi-turn workflows via one-shot invocations with session resume.

### Pattern: Multi-Step Pipeline

```bash
#!/bin/bash
set -euo pipefail

# Step 1: Analysis (read-only)
ANALYSIS=$(claude -p --output-format json --permission-mode plan \
  "Analyze the auth module. What are the top 3 issues?" | \
  python3 -c "import sys,json; d=json.load(sys.stdin); print(d['session_id'])")

# Step 2: Fix (resume with write permissions)
claude -p --resume "$ANALYSIS" --permission-mode bypassPermissions \
  "Fix all three issues you identified. Write tests."

# Step 3: Review the changes
codex review --uncommitted "Focus on the auth changes"
```

### Pattern: Parallel Workers with Codex

```bash
#!/bin/bash
# Run multiple independent tasks in parallel
codex exec --full-auto --json -o /tmp/task1.txt "Fix bug in src/auth.ts" &
codex exec --full-auto --json -o /tmp/task2.txt "Add tests for src/utils.ts" &
codex exec --full-auto --json -o /tmp/task3.txt "Update docs for the API" &
wait
echo "All tasks complete"
cat /tmp/task{1,2,3}.txt
```

### Pattern: Codex for Code, Claude for Review

```bash
# Codex writes the code (OpenAI model)
codex exec --full-auto -o /tmp/impl.txt \
  "Implement rate limiting middleware in src/middleware/"

# Claude reviews it (Anthropic model)
claude -p --permission-mode plan --model opus \
  "Review the uncommitted changes for security issues and correctness. Be thorough."
```

### Pattern: Pre-assigned Session ID for Continuation

```bash
SESSION=$(python3 -c "import uuid; print(uuid.uuid4())")

# Can be called from different scripts, cron jobs, etc.
claude -p --session-id "$SESSION" --permission-mode bypassPermissions \
  "Create the user model in src/models/user.ts"

# Hours later...
claude -p --resume "$SESSION" --permission-mode bypassPermissions \
  "Add validation to the user model you created earlier"
```

---

## 4. Output Parsing Recipes

### Extract Codex Final Text

```bash
codex exec --json -s read-only "Explain the auth flow" 2>&1 | \
  python3 -c "
import sys, json
for line in sys.stdin:
    d = json.loads(line)
    if d.get('type') == 'item.completed':
        print(d['item']['text'])
"
```

### Extract Codex Thread ID

```bash
codex exec --json --full-auto "task" 2>&1 | \
  python3 -c "
import sys, json
for line in sys.stdin:
    d = json.loads(line)
    if d.get('type') == 'thread.started':
        print(d['thread_id'])
        break
"
```

### Extract Claude Result + Session ID

```bash
claude -p --output-format json --permission-mode bypassPermissions "task" | \
  python3 -c "
import sys, json
d = json.load(sys.stdin)
print(f\"Session: {d['session_id']}\")
print(f\"Cost: \${d['total_cost_usd']:.4f}\")
print(f\"Result: {d['result']}\")
"
```

---

## 5. Configuration Files

### Codex: `~/.codex/config.toml`

```toml
model = "gpt-5.3-codex"
model_reasoning_effort = "high"

[projects."/path/to/repo"]
trust_level = "trusted"
```

### Claude: `~/.claude/settings.json`

```json
{
  "model": "opus",
  "skipDangerousModePermissionPrompt": true
}
```

### Claude: `.claude/settings.json` (project-level)

```json
{
  "permissions": {
    "allow": ["Bash(npm:*)", "Bash(dotnet:*)", "Read", "Edit", "Write"],
    "deny": ["Bash(rm:*)"]
  }
}
```

---

## 6. Safety Notes

| Concern | Codex | Claude |
|---|---|---|
| Sandbox | macOS Seatbelt / Linux Landlock. **Default is sandboxed.** | No OS-level sandbox. Relies on permission modes. |
| File writes | Controlled by `-s` sandbox mode | Controlled by `--permission-mode` |
| Network | Restricted in sandbox modes | Not restricted by default |
| Approval | `--full-auto` is safe (sandboxed) | `--permission-mode auto` is reasonable |
| Dangerous | `--dangerously-bypass-approvals-and-sandbox` | `--dangerously-skip-permissions` |

**For automation in trusted repos:** Use `codex exec --full-auto` or `claude -p --permission-mode bypassPermissions`.

**For CI/untrusted contexts:** Use `codex exec -s read-only` or `claude -p --permission-mode plan`.

---

## 7. Environment & Auth

Both tools require authentication before use:

```bash
codex login         # OAuth flow for OpenAI
claude auth         # OAuth flow for Anthropic
```

Codex requires a **git repository** by default. Override with `--skip-git-repo-check` for non-repo directories.

Claude Code reads `CLAUDE.md` from the working directory hierarchy for project context. Codex reads `AGENTS.md`.
