# Copilot CLI Flags Reference

> **Internal implementation detail:** The flags listed here were previously passed directly to the `copilot` CLI process. With the SDK migration, these options map to `CopilotClient` configuration and lifecycle hooks instead of CLI arguments. The mapping table below is retained for reference but the flags are no longer passed via shell.

## Core Autonomous Flags

### `allowAll` / `--allow-all`
Shortcut for full permission mode (tools + paths + URLs).

```js
sdk.spawnWorker("run end-to-end migration", { allowAll: true })
```

### `noAskUser` / `--no-ask-user`
Disables `ask_user` tool so autonomous workers do not block awaiting human input.

```js
sdk.spawnWorker("finish the refactor autonomously", { allowAll: true, noAskUser: true })
```

## Tool Visibility + Permission Controls

### `availableTools` / `excludedTools`
Control which tools are visible to the model.

```js
sdk.spawnWorker("inspect and patch", { availableTools: ["bash", "view", "rg"] })
sdk.spawnWorker("autonomous run", { excludedTools: ["ask_user"] })
```

### `allowTools` / `denyTools`
Control approval policy. Deny rules take precedence. In the SDK, these are enforced via the `onPreToolUse` hook internally.

```js
sdk.spawnWorker("prepare commit but do not push", {
  allowAll: true,
  allowTools: ["shell(git:*)"],
  denyTools: ["shell(git push)"]
})
```

For more precise control, use `hooks.onPreToolUse` directly:

```js
sdk.spawnWorker("commit but no push", {
  hooks: {
    onPreToolUse: ({ toolName, toolArgs }) => {
      if (toolName === "shell" && String(toolArgs.command).startsWith("git push"))
        return { permissionDecision: "deny" };
      return { permissionDecision: "allow" };
    }
  }
})
```

## URL + Path Controls

```js
// URL allow/deny
sdk.spawnWorker("research issue", { allowUrls: ["github.com"], denyUrls: ["malicious-site.com"] })
sdk.spawnWorker("web research task", { allowAllUrls: true })

// Path controls
sdk.spawnWorker("update tests", { addDirs: ["./src", "./tests"], allowAll: true })
sdk.spawnWorker("repo-wide refactor", { allowAllPaths: true, allowAll: true })
sdk.spawnWorker("work without temp dir", { disallowTempDir: true, allowAll: true })
```

## Autopilot + Execution Behavior

```js
sdk.spawnWorker("fix flaky tests", { autopilot: true, maxAutopilotContinues: 20, allowAll: true })
sdk.spawnWorker("deterministic workflow", { disableParallelToolsExecution: true, allowAll: true })
sdk.spawnWorker("quiet non-streaming run", { stream: "off", allowAll: true })
```

## Agent + Model Selection

```js
sdk.spawnWorker("explore auth architecture", { agent: "Scout", model: "gpt-5.4", allowAll: true })
```

## Mapping to `copilot-cli-skill` SpawnOptions

> These options are now mapped to SDK session configuration internally, not CLI flags.

| SpawnOption | Former CLI flag |
|-------------|----------------|
| `allowAll` | `--allow-all` |
| `allowAllPaths` / `addDirs` / `allowAllUrls` | `--allow-all-paths` / `--add-dir` / `--allow-all-urls` |
| `allowTools` / `denyTools` | `--allow-tool` / `--deny-tool` |
| `availableTools` / `excludedTools` | `--available-tools` / `--excluded-tools` |
| `allowUrls` / `denyUrls` | `--allow-url` / `--deny-url` |
| `disallowTempDir` | `--disallow-temp-dir` |
| `noAskUser` | `--no-ask-user` |
| `autopilot` / `maxAutopilotContinues` | `--autopilot` / `--max-autopilot-continues` |
| `disableParallelToolsExecution` | `--disable-parallel-tools-execution` |
| `stream` | `--stream on\|off` |
| `hooks` | (SDK-only — no CLI equivalent) |
| `tools` | (SDK-only — no CLI equivalent) |
| `errorPolicy` | (SDK-only — no CLI equivalent) |
