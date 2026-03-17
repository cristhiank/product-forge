#!/usr/bin/env node

import path from "node:path";
import fs from "node:fs";
import { parseArgs } from "node:util";
import { MetricsStore } from "./metrics.js";
import { GcScanner } from "./gc-scanner.js";
import { ChangelogManager } from "./changelog.js";
import { createHarnessAPI, executeCode } from "./sandbox.js";

function findGitRoot(startDir: string): string {
  let dir = startDir;
  while (dir !== path.dirname(dir)) {
    const gitDir = path.join(dir, ".git");
    try {
      const stat = fs.statSync(gitDir);
      if (stat.isDirectory()) return dir;
    } catch {
      // not found, keep going
    }
    dir = path.dirname(dir);
  }
  return startDir;
}

function getDbPath(repoRoot: string): string {
  return path.join(repoRoot, ".git", "forge", "harness.db");
}

function output(data: unknown, pretty: boolean): void {
  const json = pretty
    ? JSON.stringify(data, null, 2)
    : JSON.stringify(data);
  process.stdout.write(json + "\n");
}

async function main(): Promise<void> {
  const { values, positionals } = parseArgs({
    allowPositionals: true,
    options: {
      code: { type: "string", short: "c" },
      timeout: { type: "string", short: "t" },
      pretty: { type: "boolean", short: "p", default: false },
      help: { type: "boolean", short: "h", default: false },
    },
  });

  if (values.help || positionals.length === 0) {
    process.stdout.write(HELP_TEXT);
    process.exit(0);
  }

  const command = positionals[0];

  if (command !== "exec") {
    process.stderr.write(`Unknown command: ${command}\nRun with --help for usage.\n`);
    process.exit(1);
  }

  // Get code from --code flag or remaining positional
  const code = values.code ?? positionals[1];
  if (!code) {
    process.stderr.write("Missing code. Use: forge-harness exec --code '...' or forge-harness exec '...'\n");
    process.exit(1);
  }

  const repoRoot = findGitRoot(process.cwd());
  const dbPath = getDbPath(repoRoot);
  const timeout = values.timeout ? parseInt(values.timeout, 10) : undefined;
  const pretty = values.pretty ?? false;

  let metrics: MetricsStore | undefined;
  let gc: GcScanner | undefined;
  let changelog: ChangelogManager | undefined;

  try {
    metrics = new MetricsStore(dbPath);
    gc = new GcScanner(dbPath);
    changelog = new ChangelogManager(dbPath, repoRoot);

    const api = createHarnessAPI(metrics, gc, changelog);
    const result = await executeCode(api, { code, timeout });

    output(result, pretty);
    process.exit(result.success ? 0 : 1);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    output({ success: false, error: message, execution_time_ms: 0 }, pretty);
    process.exit(1);
  } finally {
    metrics?.close();
    gc?.close();
    changelog?.close();
  }
}

const HELP_TEXT = `forge-harness — Forge Agentic Flywheel Toolkit

Usage:
  forge-harness exec --code '<javascript>'   Execute code with harness API
  forge-harness exec '<javascript>'          Same, positional argument

Options:
  --code, -c     JavaScript code to execute (harness object is in scope)
  --timeout, -t  Execution timeout in ms (default: 10000)
  --pretty, -p   Pretty-print JSON output
  --help, -h     Show this help

API Reference (available as 'harness' in exec context):

  harness.metrics.log({ runId, metric, value, mode?, tier?, sessionId? })
  harness.metrics.query({ runId?, since?, mode?, metric?, limit? })
  harness.metrics.summary({ runId? })
  harness.metrics.aggregateByMode()

  harness.gc.scan({ type: "debt"|"stale-docs"|"dead-exports"|"all", path? })
  harness.gc.getFindings({ severity?, type?, limit? })
  harness.gc.clearFindings({ olderThan? })

  harness.changelog.add({ modeFile, entry })
  harness.changelog.show({ modeFile? })
  harness.changelog.recent({ limit? })
  harness.changelog.init()

  harness.health()
  harness.health.suggestGc()

Examples:
  forge-harness exec --code 'return harness.metrics.log({ runId: "r1", metric: "dispatch", value: "explore", mode: "explore" })'
  forge-harness exec --code 'return harness.metrics.summary()'
  forge-harness exec --code 'return harness.gc.scan({ type: "debt" })'
  forge-harness exec --code 'return harness.health()'
`;

main().catch((err) => {
  process.stderr.write(`Fatal: ${err.message}\n`);
  process.exit(1);
});
