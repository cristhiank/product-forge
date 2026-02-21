# Copilot CLI Flags Reference

This document lists the key Copilot CLI flags relevant for spawning autonomous worker processes.

## Non-Interactive Execution Flags

### `--allow-all-tools`
**Required for autonomous workers.** Auto-approves all tool usage without prompting. Without this flag, the CLI will wait for user confirmation on tool calls, blocking non-interactive execution.

```bash
copilot --allow-all-tools "implement feature X"
```

### `--allow-all-paths`
Disables path verification prompts. Allows the worker to access any file within the worktree without user approval.

```bash
copilot --allow-all-paths --allow-all-tools "refactor auth module"
```

### `--allow-all-urls`
Allows unrestricted URL access for external searches and API calls without prompting.

```bash
copilot --allow-all-urls --allow-all-tools "research latest Next.js patterns"
```

## Directory Access Control

### `--add-dir <directory>`
**Repeatable.** Grants file access to specific directories. Use this to restrict worker access to relevant portions of the codebase.

```bash
copilot --add-dir ./src --add-dir ./tests --allow-all-tools "add tests for auth"
```

Multiple `--add-dir` flags can be combined to grant granular access.

## Agent and Model Selection

### `--agent <agent>`
Specifies a custom agent for the worker. Useful for routing work to specialized agents (e.g., Scout, Executor, Creative).

```bash
copilot --agent Scout --allow-all-tools "explore authentication patterns"
```

### `--model <model>`
Overrides the default model. Available models include:
- `claude-sonnet-4.6` (default for most tasks)
- `claude-opus-4.6` (premium, complex reasoning)
- `claude-haiku-4.5` (fast, cost-effective)
- `gpt-5.3-codex` (code-focused)
- `gemini-3-pro-preview` (multi-modal)

```bash
copilot --model claude-opus-4.6 --allow-all-tools "design authentication architecture"
```

## Session Management

### `--resume <session-id>`
Resumes a specific previously-started session by ID.

```bash
copilot --resume 20260221-143000-abc
```

### `--continue`
Resumes the most recent session in the current directory.

```bash
copilot --continue
```

## Autonomous Continuation

### `--autopilot`
Enables autopilot mode, allowing the agent to continue working autonomously across multiple turns until completion.

```bash
copilot --autopilot --allow-all-tools "implement feature X from start to finish"
```

## Combined Example: Autonomous Worker

```bash
copilot \
  --agent Executor \
  --model claude-sonnet-4.6 \
  --add-dir ./src/auth \
  --add-dir ./tests/auth \
  --allow-all-tools \
  --allow-all-paths \
  --autopilot \
  "implement magic link authentication per plan.md"
```

This spawns a fully autonomous worker that:
- Uses the Executor agent
- Has access to auth-related directories
- Auto-approves all tool usage
- Continues autonomously until completion
- Requires no user interaction

## Safety Considerations

When spawning autonomous workers:
- **Always** use `--allow-all-tools` (required for non-interactive execution)
- **Consider** limiting scope with `--add-dir` instead of `--allow-all-paths`
- **Review** the prompt carefully — workers execute autonomously
- **Monitor** output logs for errors or unexpected behavior
- **Set** appropriate model based on task complexity and budget
