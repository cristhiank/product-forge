import { describe, it, expect, beforeEach, afterEach } from "vitest";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { MetricsStore } from "../src/metrics.js";
import { GcScanner } from "../src/gc-scanner.js";
import { ChangelogManager } from "../src/changelog.js";
import { createHarnessAPI, executeCode } from "../src/sandbox.js";
import type { HarnessAPI } from "../src/sandbox.js";

let api: HarnessAPI;
let metrics: MetricsStore;
let gc: GcScanner;
let changelog: ChangelogManager;
let tmpDir: string;

beforeEach(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "forge-harness-sb-test-"));
  const dbPath = path.join(tmpDir, "test.db");
  metrics = new MetricsStore(dbPath);
  gc = new GcScanner(dbPath);
  changelog = new ChangelogManager(dbPath, tmpDir);
  api = createHarnessAPI(metrics, gc, changelog);
});

afterEach(() => {
  metrics.close();
  gc.close();
  changelog.close();
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

describe("Sandbox", () => {
  it("executes simple return", async () => {
    const result = await executeCode(api, { code: "return 42" });
    expect(result.success).toBe(true);
    expect(result.result).toBe(42);
    expect(result.execution_time_ms).toBeGreaterThanOrEqual(0);
  });

  it("accesses harness.metrics", async () => {
    const result = await executeCode(api, {
      code: 'return harness.metrics.log({ runId: "r1", metric: "test", value: "ok", mode: "test" })',
    });
    expect(result.success).toBe(true);
    const entry = result.result as Record<string, unknown>;
    expect(entry.run_id).toBe("r1");
  });

  it("accesses harness.health", async () => {
    const result = await executeCode(api, {
      code: "return harness.health()",
    });
    expect(result.success).toBe(true);
    const health = result.result as Record<string, unknown>;
    expect(health).toHaveProperty("metricsCount");
    expect(health).toHaveProperty("suggestGc");
  });

  it("supports compositional workflows", async () => {
    const result = await executeCode(api, {
      code: `
        harness.metrics.log({ runId: "r1", metric: "dispatch", value: "explore", mode: "explore" });
        harness.metrics.log({ runId: "r1", metric: "verify_result", value: "pass", mode: "verify" });
        const summary = harness.metrics.summary({ runId: "r1" });
        return { passRate: summary.passRate, total: summary.totalEntries };
      `,
    });
    expect(result.success).toBe(true);
    const data = result.result as Record<string, unknown>;
    expect(data.passRate).toBe(1);
    expect(data.total).toBe(2);
  });

  it("catches errors gracefully", async () => {
    const result = await executeCode(api, {
      code: 'throw new Error("boom")',
    });
    expect(result.success).toBe(false);
    expect(result.error).toContain("boom");
  });

  it("respects timeout", async () => {
    const result = await executeCode(api, {
      code: "while(true) {}",
      timeout: 100,
    });
    expect(result.success).toBe(false);
    expect(result.error).toContain("timed out");
  });

  it("blocks require access", async () => {
    const result = await executeCode(api, {
      code: 'const fs = require("fs"); return fs;',
    });
    expect(result.success).toBe(false);
    expect(result.error).toBeDefined();
  });

  it("blocks process access", async () => {
    const result = await executeCode(api, {
      code: "return process.env",
    });
    expect(result.success).toBe(false);
  });

  it("provides standard globals", async () => {
    const result = await executeCode(api, {
      code: `
        const now = new Date();
        const parsed = parseInt("42", 10);
        const arr = Array.from([1,2,3]);
        return { date: now instanceof Date, parsed, arr };
      `,
    });
    expect(result.success).toBe(true);
    const data = result.result as Record<string, unknown>;
    expect(data.date).toBe(true);
    expect(data.parsed).toBe(42);
  });
});
