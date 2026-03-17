import type { MetricEntry, MetricLogOpts, MetricQueryOpts, MetricSummary, ModeAggregate } from "./types.js";
export declare class MetricsStore {
    private db;
    constructor(dbPath: string);
    log(opts: MetricLogOpts): MetricEntry;
    query(opts?: MetricQueryOpts): MetricEntry[];
    summary(opts?: {
        runId?: string;
    }): MetricSummary;
    aggregateByMode(): Record<string, ModeAggregate>;
    close(): void;
    private parseSince;
}
