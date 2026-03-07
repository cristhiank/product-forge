# Copilot CLI Flags Reference

Key flags for autonomous workers, validated against `copilot --help` (CLI `0.0.415`).

## Core Autonomous Flags

### `--allow-all-tools`
Default baseline for non-interactive workers. Auto-approves tool prompts.

```bash
copilot --allow-all-tools -p "implement feature X"
```

### `--allow-all` / `--yolo`
Shortcut for full permission mode:

```bash
--allow-all-tools --allow-all-paths --allow-all-urls
```

```bash
copilot --allow-all -p "run end-to-end migration"
```

### `--no-ask-user`
Disables `ask_user` tool so autonomous workers do not block awaiting human input.

```bash
copilot --allow-all-tools --no-ask-user -p "finish the refactor autonomously"
```

## Tool Visibility + Permission Controls

### `--available-tools` / `--excluded-tools`
Control which tools are visible to the model.

```bash
copilot --available-tools bash view rg -p "inspect and patch"
copilot --excluded-tools ask_user -p "autonomous run"
```

### `--allow-tool` / `--deny-tool`
Control approval policy for allowed tools. Deny rules take precedence.

```bash
copilot \
  --allow-all-tools \
  --allow-tool 'shell(git:*)' \
  --deny-tool 'shell(git push)' \
  -p "prepare commit but do not push"
```

## URL + Path Controls

### URLs

```bash
copilot --allow-url github.com --deny-url https://malicious-site.com -p "research issue"
copilot --allow-all-urls -p "web research task"
```

### Paths

```bash
copilot --add-dir ./src --add-dir ./tests --allow-all-tools -p "update tests"
copilot --allow-all-paths --allow-all-tools -p "repo-wide refactor"
copilot --disallow-temp-dir --allow-all-tools -p "work without temp dir"
```

## Autopilot + Execution Behavior

### `--autopilot` + `--max-autopilot-continues`

```bash
copilot --autopilot --max-autopilot-continues 20 --allow-all-tools -p "fix flaky tests"
```

### `--disable-parallel-tools-execution`
For serialized execution when parallel tool execution causes instability.

```bash
copilot --disable-parallel-tools-execution --allow-all-tools -p "run deterministic workflow"
```

### `--stream on|off`
Control streaming output behavior.

```bash
copilot --stream off --allow-all-tools -p "quiet non-streaming run"
```

## Agent + Model Selection

```bash
copilot --agent Scout --model gpt-5.4 --allow-all-tools -p "explore auth architecture"
```

## Combined Example (Modern Worker)

```bash
copilot \
  --agent Orchestrator \
  --model claude-sonnet-4.6 \
  --add-dir ./src/auth \
  --add-dir ./tests/auth \
  --allow-tool write \
  --deny-tool 'shell(git push)' \
  --no-ask-user \
  --autopilot \
  --max-autopilot-continues 25 \
  -p "implement magic link auth per plan.md"
```

## Mapping to `copilot-cli-skill` Spawn Options

- `allowAll` → `--allow-all`
- `allowAllPaths` / `addDirs` / `allowAllUrls`
- `allowTools` / `denyTools`
- `availableTools` / `excludedTools`
- `allowUrls` / `denyUrls`
- `disallowTempDir`
- `noAskUser`
- `autopilot` / `maxAutopilotContinues`
- `disableParallelToolsExecution`
- `stream`
