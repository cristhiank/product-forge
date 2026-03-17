import type { GcScanOpts, GcFinding, GcFindingQueryOpts, GcClearOpts } from "./types.js";
export declare class GcScanner {
    private db;
    constructor(dbPath: string);
    scan(opts: GcScanOpts): GcFinding[];
    getFindings(opts?: GcFindingQueryOpts): GcFinding[];
    clearFindings(opts?: GcClearOpts): {
        cleared: number;
    };
    close(): void;
    private scanDebt;
    private scanStaleDocs;
    private scanDeadExports;
    private walkFiles;
}
