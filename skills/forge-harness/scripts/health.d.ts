import type { MetricsStore } from "./metrics.js";
import type { GcScanner } from "./gc-scanner.js";
import type { HealthReport, GcSuggestion } from "./types.js";
export declare class HealthChecker {
    private metrics;
    private gc;
    constructor(metrics: MetricsStore, gc: GcScanner);
    check(): HealthReport;
    suggestGc(): GcSuggestion;
}
