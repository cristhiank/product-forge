import type { MetricsStore } from "./metrics.js";
import type { GcScanner } from "./gc-scanner.js";
import type { HealthReport, GcSuggestion } from "./types.js";

const GC_RUN_THRESHOLD = 10;

export class HealthChecker {
  private metrics: MetricsStore;
  private gc: GcScanner;

  constructor(metrics: MetricsStore, gc: GcScanner) {
    this.metrics = metrics;
    this.gc = gc;
  }

  check(): HealthReport {
    const allMetrics = this.metrics.query();
    const gcFindings = this.gc.getFindings();
    const suggestion = this.suggestGc();

    // Recent = last 30 days
    const recentMetrics = this.metrics.query({ since: "30d" });
    const recentVerifies = recentMetrics.filter(
      (m) => m.metric === "verify_result",
    );
    const recentFails = recentVerifies.filter(
      (m) => m.value === "fail" || m.value === "revision_required",
    );

    // Find the last GC scan timestamp
    const lastGcEntry = this.gc
      .getFindings({ limit: 1 });
    const lastGcScan = lastGcEntry.length > 0
      ? lastGcEntry[0].created_at ?? null
      : null;

    return {
      metricsCount: allMetrics.length,
      lastGcScan,
      suggestGc: suggestion.suggest,
      runsSinceLastGc: suggestion.runsSinceLastGc,
      recentFailRate:
        recentVerifies.length > 0
          ? recentFails.length / recentVerifies.length
          : 0,
      recentEntries: recentMetrics.length,
      gcFindingsCount: gcFindings.length,
    };
  }

  suggestGc(): GcSuggestion {
    const allMetrics = this.metrics.query();
    const gcFindings = this.gc.getFindings({ limit: 1 });

    // Count unique runs since last GC
    const lastGcTime = gcFindings.length > 0
      ? gcFindings[0].created_at ?? "1970-01-01"
      : "1970-01-01";

    const runsSince = new Set(
      allMetrics
        .filter((m) => m.metric === "dispatch" && m.created_at > lastGcTime)
        .map((m) => m.run_id),
    ).size;

    if (runsSince >= GC_RUN_THRESHOLD) {
      return {
        suggest: true,
        reason: `${runsSince} runs since last GC scan (threshold: ${GC_RUN_THRESHOLD})`,
        runsSinceLastGc: runsSince,
      };
    }

    return {
      suggest: false,
      reason: `Only ${runsSince} runs since last GC (threshold: ${GC_RUN_THRESHOLD})`,
      runsSinceLastGc: runsSince,
    };
  }
}
