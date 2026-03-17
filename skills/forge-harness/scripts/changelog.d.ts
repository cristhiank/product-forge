import type { ChangelogEntry, ChangelogAddOpts, ChangelogShowOpts, ChangelogRecentOpts } from "./types.js";
export declare class ChangelogManager {
    private db;
    private repoRoot;
    constructor(dbPath: string, repoRoot?: string);
    add(opts: ChangelogAddOpts): ChangelogEntry;
    show(opts?: ChangelogShowOpts): Record<string, ChangelogEntry[]>;
    recent(opts?: ChangelogRecentOpts): ChangelogEntry[];
    init(): {
        initialized: string[];
    };
    close(): void;
    private appendToModeFile;
}
