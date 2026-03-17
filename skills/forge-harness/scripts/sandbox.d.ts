import type { ExecRequest, ExecResponse } from "./types.js";
import { MetricsStore } from "./metrics.js";
import { GcScanner } from "./gc-scanner.js";
import { ChangelogManager } from "./changelog.js";
export interface HarnessAPI {
    metrics: {
        log: (opts: Record<string, unknown>) => unknown;
        query: (opts?: Record<string, unknown>) => unknown;
        summary: (opts?: Record<string, unknown>) => unknown;
        aggregateByMode: () => unknown;
    };
    gc: {
        scan: (opts: Record<string, unknown>) => unknown;
        getFindings: (opts?: Record<string, unknown>) => unknown;
        clearFindings: (opts?: Record<string, unknown>) => unknown;
    };
    changelog: {
        add: (opts: Record<string, unknown>) => unknown;
        show: (opts?: Record<string, unknown>) => unknown;
        recent: (opts?: Record<string, unknown>) => unknown;
        init: () => unknown;
    };
    health: (() => unknown) & {
        suggestGc: () => unknown;
    };
}
export declare function createHarnessAPI(metrics: MetricsStore, gc: GcScanner, changelog: ChangelogManager): HarnessAPI;
export declare function executeCode(api: HarnessAPI, request: ExecRequest): Promise<ExecResponse>;
