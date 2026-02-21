#!/usr/bin/env node

// dist/cli.js
import { Command } from "commander";
import { resolve as resolve2 } from "node:path";

// dist/workers.js
import { execSync, spawn } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync, rmSync, readdirSync, statSync, createWriteStream } from "node:fs";
import { join, resolve } from "node:path";
import { randomUUID } from "node:crypto";
var WorkerManager = class {
  repoRoot;
  workersDir;
  constructor(repoRoot) {
    this.repoRoot = repoRoot;
    this.workersDir = join(repoRoot, ".copilot-workers");
  }
  /** Spawn a new Copilot CLI worker in an isolated worktree */
  spawn(opts) {
    if (!opts.prompt)
      throw new Error("prompt is required");
    const workerId = randomUUID();
    const worktreeBase = opts.worktreeBase ?? "../worktrees";
    const branchPrefix = opts.branchPrefix ?? "worker";
    const worktreeBaseAbs = resolve(this.repoRoot, worktreeBase);
    mkdirSync(worktreeBaseAbs, { recursive: true });
    const worktreePath = join(worktreeBaseAbs, workerId);
    const branchName = `${branchPrefix}/${workerId}`;
    const stateDir = join(this.workersDir, workerId);
    mkdirSync(stateDir, { recursive: true });
    try {
      execSync(`git worktree add -b "${branchName}" "${worktreePath}" HEAD`, {
        cwd: this.repoRoot,
        stdio: "pipe"
      });
    } catch {
      rmSync(stateDir, { recursive: true, force: true });
      throw new Error("Failed to create git worktree");
    }
    const args = ["--allow-all-tools"];
    if (opts.agent)
      args.push("--agent", opts.agent);
    if (opts.model)
      args.push("--model", opts.model);
    if (opts.allowAllPaths) {
      args.push("--allow-all-paths");
    } else if (opts.addDirs) {
      for (const dir of opts.addDirs) {
        args.push("--add-dir", dir);
      }
    }
    if (opts.allowAllUrls)
      args.push("--allow-all-urls");
    if (opts.autopilot)
      args.push("--autopilot");
    args.push("-p", opts.prompt);
    const outputLog = join(stateDir, "output.log");
    const child = spawn("copilot", args, {
      cwd: worktreePath,
      detached: true,
      stdio: ["ignore", "pipe", "pipe"]
    });
    const logStream = createWriteStream(outputLog);
    child.stdout?.pipe(logStream);
    child.stderr?.pipe(logStream);
    child.unref();
    const pid = child.pid;
    writeFileSync(join(stateDir, "worker.pid"), String(pid));
    const meta = {
      worker_id: workerId,
      pid,
      worktree_path: worktreePath,
      branch_name: branchName,
      prompt: opts.prompt,
      agent: opts.agent ?? "",
      model: opts.model ?? "",
      started_at: (/* @__PURE__ */ new Date()).toISOString(),
      status: "running"
    };
    writeFileSync(join(stateDir, "meta.json"), JSON.stringify(meta, null, 2));
    return {
      workerId,
      pid,
      worktreePath,
      branchName,
      stateDir,
      outputLog,
      status: "running"
    };
  }
  /** Get detailed status of a specific worker */
  getStatus(workerId) {
    const stateDir = join(this.workersDir, workerId);
    if (!existsSync(stateDir)) {
      throw new Error(`Worker not found: ${workerId}`);
    }
    const metaPath = join(stateDir, "meta.json");
    if (!existsSync(metaPath)) {
      throw new Error(`Worker metadata not found: ${workerId}`);
    }
    const meta = JSON.parse(readFileSync(metaPath, "utf-8"));
    let pid = 0;
    let status = "unknown";
    const pidPath = join(stateDir, "worker.pid");
    if (existsSync(pidPath)) {
      pid = parseInt(readFileSync(pidPath, "utf-8").trim(), 10);
      status = isProcessRunning(pid) ? "running" : "stopped";
    }
    const worktreeExists = existsSync(meta.worktree_path);
    const logPath = join(stateDir, "output.log");
    let logSizeBytes = 0;
    let logLines = 0;
    if (existsSync(logPath)) {
      const logStat = statSync(logPath);
      logSizeBytes = logStat.size;
      logLines = readFileSync(logPath, "utf-8").split("\n").length;
    }
    return {
      workerId,
      pid,
      worktreePath: meta.worktree_path,
      branchName: meta.branch_name,
      stateDir,
      outputLog: logPath,
      status,
      prompt: meta.prompt,
      agent: meta.agent || null,
      model: meta.model || null,
      startedAt: meta.started_at,
      worktreeExists,
      logSizeBytes,
      logLines
    };
  }
  /** List all workers with basic info */
  listWorkers() {
    if (!existsSync(this.workersDir))
      return [];
    const entries = readdirSync(this.workersDir, { withFileTypes: true });
    const workers = [];
    for (const entry of entries) {
      if (!entry.isDirectory())
        continue;
      const workerId = entry.name;
      const pidPath = join(this.workersDir, workerId, "worker.pid");
      let pid = 0;
      let status = "unknown";
      if (existsSync(pidPath)) {
        pid = parseInt(readFileSync(pidPath, "utf-8").trim(), 10);
        status = isProcessRunning(pid) ? "running" : "stopped";
      }
      workers.push({ workerId, pid, status });
    }
    return workers;
  }
  /** Clean up a worker: kill process, remove worktree, delete state */
  cleanup(workerId, force = false) {
    const stateDir = join(this.workersDir, workerId);
    if (!existsSync(stateDir)) {
      throw new Error(`Worker not found: ${workerId}`);
    }
    const metaPath = join(stateDir, "meta.json");
    if (!existsSync(metaPath)) {
      throw new Error(`Worker metadata not found: ${workerId}`);
    }
    const meta = JSON.parse(readFileSync(metaPath, "utf-8"));
    const pidPath = join(stateDir, "worker.pid");
    if (existsSync(pidPath)) {
      const pid = parseInt(readFileSync(pidPath, "utf-8").trim(), 10);
      if (isProcessRunning(pid)) {
        try {
          process.kill(pid, "SIGTERM");
        } catch {
        }
        const deadline = Date.now() + 5e3;
        while (Date.now() < deadline && isProcessRunning(pid)) {
          execSync("sleep 0.5", { stdio: "pipe" });
        }
        if (isProcessRunning(pid)) {
          if (!force) {
            throw new Error(`Process ${pid} still running. Use force=true to kill.`);
          }
          try {
            process.kill(pid, "SIGKILL");
          } catch {
          }
        }
      }
    }
    let worktreeRemoved = false;
    if (meta.worktree_path && existsSync(meta.worktree_path)) {
      try {
        execSync(`git worktree remove "${meta.worktree_path}" --force`, {
          cwd: this.repoRoot,
          stdio: "pipe"
        });
        worktreeRemoved = true;
      } catch {
        worktreeRemoved = false;
      }
    } else {
      worktreeRemoved = true;
    }
    let branchDeleted = false;
    if (meta.branch_name) {
      try {
        execSync(`git branch -D "${meta.branch_name}"`, {
          cwd: this.repoRoot,
          stdio: "pipe"
        });
        branchDeleted = true;
      } catch {
        branchDeleted = false;
      }
    }
    rmSync(stateDir, { recursive: true, force: true });
    try {
      execSync("git worktree prune", { cwd: this.repoRoot, stdio: "pipe" });
    } catch {
    }
    return {
      workerId,
      status: "cleaned",
      worktreeRemoved,
      branchDeleted,
      stateRemoved: true
    };
  }
};
function isProcessRunning(pid) {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

// dist/sdk.js
var WorkerSDK = class {
  manager;
  defaults;
  constructor(manager, defaults = {}) {
    this.manager = manager;
    this.defaults = defaults;
  }
  /** Spawn a new worker with sensible defaults */
  spawnWorker(prompt, opts = {}) {
    return this.manager.spawn({
      prompt,
      agent: opts.agent ?? this.defaults.agent,
      model: opts.model ?? this.defaults.model,
      autopilot: opts.autopilot ?? this.defaults.autopilot,
      worktreeBase: opts.worktreeBase,
      branchPrefix: opts.branchPrefix,
      addDirs: opts.addDirs,
      allowAllPaths: opts.allowAllPaths,
      allowAllUrls: opts.allowAllUrls
    });
  }
  /** Get detailed status of a worker */
  checkWorker(workerId) {
    return this.manager.getStatus(workerId);
  }
  /** List all workers */
  listAll() {
    return this.manager.listWorkers();
  }
  /** Clean up a single worker */
  cleanupWorker(workerId, force = false) {
    return this.manager.cleanup(workerId, force);
  }
  /** Clean up all stopped workers */
  cleanupAll(force = false) {
    const workers = this.manager.listWorkers();
    const results = [];
    for (const w of workers) {
      if (w.status === "stopped" || force) {
        try {
          results.push(this.manager.cleanup(w.workerId, force));
        } catch {
        }
      }
    }
    return results;
  }
};

// dist/cli.js
function output(data, pretty) {
  console.log(JSON.stringify(data, null, pretty ? 2 : void 0));
}
function handleError(err) {
  const message = err instanceof Error ? err.message : String(err);
  console.log(JSON.stringify({ error: message }));
  process.exit(1);
}
function runCli() {
  const program = new Command();
  program.name("worker").description("Copilot CLI Worker Management - Spawn, monitor, and cleanup workers").version("0.1.0").option("--repo-root <path>", "Repository root path", ".").option("--pretty", "Pretty-print JSON output", false);
  program.command("spawn").description("Spawn a new Copilot CLI worker in an isolated worktree").requiredOption("--prompt <text>", "Prompt for the worker").option("--agent <agent>", "Custom agent (e.g., Scout, Executor)").option("--model <model>", "Model override (e.g., claude-opus-4.6)").option("--worktree-base <path>", "Base directory for worktrees").option("--branch-prefix <prefix>", "Branch name prefix").option("--add-dir <dir...>", "Allow access to directories").option("--allow-all-paths", "Allow access to all paths").option("--allow-all-urls", "Allow all URL access").option("--autopilot", "Enable autopilot mode").action((opts) => {
    try {
      const repoRoot = resolve2(program.opts().repoRoot);
      const manager = new WorkerManager(repoRoot);
      const result = manager.spawn({
        prompt: opts.prompt,
        agent: opts.agent,
        model: opts.model,
        worktreeBase: opts.worktreeBase,
        branchPrefix: opts.branchPrefix,
        addDirs: opts.addDir,
        allowAllPaths: opts.allowAllPaths,
        allowAllUrls: opts.allowAllUrls,
        autopilot: opts.autopilot
      });
      output(result, program.opts().pretty);
    } catch (err) {
      handleError(err);
    }
  });
  program.command("status").description("Check status of a worker or list all workers").argument("[worker-id]", "Worker ID (omit to list all)").option("--list", "List all workers").action((workerId, opts) => {
    try {
      const repoRoot = resolve2(program.opts().repoRoot);
      const manager = new WorkerManager(repoRoot);
      if (!workerId || opts.list) {
        const workers = manager.listWorkers();
        output({ workers }, program.opts().pretty);
      } else {
        const status = manager.getStatus(workerId);
        output(status, program.opts().pretty);
      }
    } catch (err) {
      handleError(err);
    }
  });
  program.command("cleanup").description("Clean up a worker and its worktree").argument("<worker-id>", "Worker ID to clean up").option("--force", "Force kill process if graceful shutdown fails").action((workerId, opts) => {
    try {
      const repoRoot = resolve2(program.opts().repoRoot);
      const manager = new WorkerManager(repoRoot);
      const result = manager.cleanup(workerId, opts.force);
      output(result, program.opts().pretty);
    } catch (err) {
      handleError(err);
    }
  });
  program.command("cleanup-all").description("Clean up all stopped workers").option("--force", "Force cleanup of running workers too").action((opts) => {
    try {
      const repoRoot = resolve2(program.opts().repoRoot);
      const manager = new WorkerManager(repoRoot);
      const sdk = new WorkerSDK(manager);
      const results = sdk.cleanupAll(opts.force);
      output({ cleaned: results, total: results.length }, program.opts().pretty);
    } catch (err) {
      handleError(err);
    }
  });
  program.command("exec").description("Execute JavaScript code with WorkerManager and SDK pre-loaded").argument("<code>", "JavaScript code to evaluate (manager and sdk are in scope)").option("--agent <agent>", "Default agent for SDK operations").option("--model <model>", "Default model for SDK operations").option("--autopilot", "Default autopilot for SDK operations").action(async (code, opts) => {
    try {
      const repoRoot = resolve2(program.opts().repoRoot);
      const manager = new WorkerManager(repoRoot);
      const sdk = new WorkerSDK(manager, {
        agent: opts.agent,
        model: opts.model,
        autopilot: opts.autopilot
      });
      const fn = new Function("manager", "sdk", `return (async () => { ${code} })();`);
      const result = await fn(manager, sdk);
      if (result !== void 0) {
        output(result, program.opts().pretty);
      }
    } catch (err) {
      handleError(err);
    }
  });
  program.parse();
}

// dist/skill-cli.js
runCli();
