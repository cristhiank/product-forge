import { describe, it, expect, beforeEach, afterEach } from "vitest";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { MetricsStore } from "../src/metrics.js";

let store: MetricsStore;
let tmpDir: string;
let dbPath: string;

beforeEach(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "forge-harness-test-"));
  dbPath = path.join(tmpDir, "test.db");
  store = new MetricsStore(dbPath);
});

afterEach(() => {
  store.close();
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

describe("MetricsStore", () => {
  describe("log", () => {
    it("inserts a metric and returns it with id", () => {
      const result = store.log({
        runId: "run-1",
        metric: "dispatch",
        value: "explore",
        mode: "explore",
        tier: "T3",
      });
      expect(result.id).toBe(1);
      expect(result.run_id).toBe("run-1");
      expect(result.metric).toBe("dispatch");
      expect(result.value).toBe("explore");
      expect(result.mode).toBe("explore");
      expect(result.tier).toBe("T3");
      expect(result.created_at).toBeTruthy();
    });

    it("handles optional fields as null", () => {
      const result = store.log({
        runId: "run-1",
        metric: "dispatch",
        value: "explore",
      });
      expect(result.session_id).toBeNull();
      expect(result.tier).toBeNull();
      expect(result.mode).toBe("unknown");
    });
  });

  describe("query", () => {
    it("returns all entries when no filters", () => {
      store.log({ runId: "r1", metric: "dispatch", value: "explore", mode: "explore" });
      store.log({ runId: "r2", metric: "dispatch", value: "execute", mode: "execute" });
      const results = store.query();
      expect(results).toHaveLength(2);
    });

    it("filters by runId", () => {
      store.log({ runId: "r1", metric: "dispatch", value: "explore", mode: "explore" });
      store.log({ runId: "r2", metric: "dispatch", value: "execute", mode: "execute" });
      const results = store.query({ runId: "r1" });
      expect(results).toHaveLength(1);
      expect(results[0].run_id).toBe("r1");
    });

    it("filters by mode", () => {
      store.log({ runId: "r1", metric: "dispatch", value: "explore", mode: "explore" });
      store.log({ runId: "r1", metric: "verify_result", value: "pass", mode: "verify" });
      const results = store.query({ mode: "verify" });
      expect(results).toHaveLength(1);
      expect(results[0].mode).toBe("verify");
    });

    it("filters by metric name", () => {
      store.log({ runId: "r1", metric: "dispatch", value: "explore", mode: "explore" });
      store.log({ runId: "r1", metric: "verify_result", value: "pass", mode: "verify" });
      const results = store.query({ metric: "verify_result" });
      expect(results).toHaveLength(1);
    });

    it("respects limit", () => {
      for (let i = 0; i < 10; i++) {
        store.log({ runId: `r${i}`, metric: "dispatch", value: "explore", mode: "explore" });
      }
      const results = store.query({ limit: 3 });
      expect(results).toHaveLength(3);
    });
  });

  describe("summary", () => {
    it("computes pass rate correctly", () => {
      store.log({ runId: "r1", metric: "verify_result", value: "pass", mode: "verify" });
      store.log({ runId: "r2", metric: "verify_result", value: "fail", mode: "verify" });
      store.log({ runId: "r3", metric: "verify_result", value: "pass", mode: "verify" });

      const summary = store.summary();
      expect(summary.totalRuns).toBe(3);
      expect(summary.passRate).toBeCloseTo(2 / 3);
    });

    it("computes average retries", () => {
      store.log({ runId: "r1", metric: "retry_count", value: "2", mode: "execute" });
      store.log({ runId: "r2", metric: "retry_count", value: "0", mode: "execute" });

      const summary = store.summary();
      expect(summary.avgRetries).toBe(1);
    });

    it("scopes to runId when provided", () => {
      store.log({ runId: "r1", metric: "verify_result", value: "pass", mode: "verify" });
      store.log({ runId: "r2", metric: "verify_result", value: "fail", mode: "verify" });

      const summary = store.summary({ runId: "r1" });
      expect(summary.totalRuns).toBe(1);
      expect(summary.passRate).toBe(1);
    });
  });

  describe("aggregateByMode", () => {
    it("groups metrics by mode", () => {
      store.log({ runId: "r1", metric: "verify_result", value: "pass", mode: "verify" });
      store.log({ runId: "r1", metric: "dispatch", value: "explore", mode: "explore" });
      store.log({ runId: "r2", metric: "verify_result", value: "fail", mode: "verify" });

      const agg = store.aggregateByMode();
      expect(agg["verify"]).toBeDefined();
      expect(agg["verify"].runs).toBe(2);
      expect(agg["explore"]).toBeDefined();
      expect(agg["explore"].runs).toBe(1);
    });
  });
});
