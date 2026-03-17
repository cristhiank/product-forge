import fs from "node:fs";
import path from "node:path";
import Database from "better-sqlite3";
import type {
  ChangelogEntry,
  ChangelogAddOpts,
  ChangelogShowOpts,
  ChangelogRecentOpts,
} from "./types.js";

const CHANGELOG_SCHEMA = `
CREATE TABLE IF NOT EXISTS changelog_entries (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  mode_file TEXT NOT NULL,
  entry TEXT NOT NULL,
  created_at TEXT DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_changelog_mode ON changelog_entries(mode_file);
`;

// Known mode files in both agents
const FORGE_MODES = [
  "explore.md", "ideate.md", "assess.md", "design.md",
  "plan.md", "execute.md", "verify.md", "memory.md", "product.md",
];
const AGENT_DIRS = ["agents/forge/modes", "agents/forge-gpt/modes"];

export class ChangelogManager {
  private db: Database.Database;
  private repoRoot: string;

  constructor(dbPath: string, repoRoot?: string) {
    const dir = path.dirname(dbPath);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    this.db = new Database(dbPath);
    this.db.pragma("journal_mode = WAL");
    this.db.exec(CHANGELOG_SCHEMA);
    this.repoRoot = repoRoot ?? process.cwd();
  }

  add(opts: ChangelogAddOpts): ChangelogEntry {
    const date = new Date().toISOString().substring(0, 10);
    const fullEntry = `${date}: ${opts.entry}`;

    // Persist to DB
    const stmt = this.db.prepare(
      "INSERT INTO changelog_entries (mode_file, entry) VALUES (?, ?)",
    );
    stmt.run(opts.modeFile, fullEntry);

    // Append to actual mode file if it exists
    this.appendToModeFile(opts.modeFile, fullEntry);

    return {
      mode_file: opts.modeFile,
      entry: fullEntry,
      created_at: new Date().toISOString(),
    };
  }

  show(opts?: ChangelogShowOpts): Record<string, ChangelogEntry[]> {
    if (opts?.modeFile) {
      const entries = this.db
        .prepare(
          "SELECT * FROM changelog_entries WHERE mode_file = ? ORDER BY created_at DESC",
        )
        .all(opts.modeFile) as ChangelogEntry[];
      return { [opts.modeFile]: entries };
    }

    const all = this.db
      .prepare("SELECT * FROM changelog_entries ORDER BY mode_file, created_at DESC")
      .all() as ChangelogEntry[];

    const grouped: Record<string, ChangelogEntry[]> = {};
    for (const entry of all) {
      if (!grouped[entry.mode_file]) grouped[entry.mode_file] = [];
      grouped[entry.mode_file].push(entry);
    }
    return grouped;
  }

  recent(opts?: ChangelogRecentOpts): ChangelogEntry[] {
    const limit = opts?.limit ?? 20;
    return this.db
      .prepare(
        "SELECT * FROM changelog_entries ORDER BY created_at DESC LIMIT ?",
      )
      .all(limit) as ChangelogEntry[];
  }

  init(): { initialized: string[] } {
    const initialized: string[] = [];

    for (const agentDir of AGENT_DIRS) {
      for (const mode of FORGE_MODES) {
        const filePath = path.join(this.repoRoot, agentDir, mode);
        if (!fs.existsSync(filePath)) continue;

        const content = fs.readFileSync(filePath, "utf-8");
        if (content.includes("## Changelog")) continue; // already has one

        const section = `\n\n## Changelog\n\n- ${new Date().toISOString().substring(0, 10)}: Changelog initialized.\n`;
        fs.appendFileSync(filePath, section);
        initialized.push(path.join(agentDir, mode));
      }
    }

    return { initialized };
  }

  close(): void {
    this.db.close();
  }

  private appendToModeFile(modeFile: string, entry: string): void {
    // Try to find the file in known agent directories
    for (const agentDir of AGENT_DIRS) {
      const filePath = path.join(this.repoRoot, agentDir, modeFile);
      if (!fs.existsSync(filePath)) continue;

      const content = fs.readFileSync(filePath, "utf-8");
      const changelogIdx = content.lastIndexOf("## Changelog");
      if (changelogIdx === -1) continue;

      // Append new entry after the last line in the changelog
      const updated = content.trimEnd() + `\n- ${entry}\n`;
      fs.writeFileSync(filePath, updated);
    }

    // Also try as a direct path relative to repo root
    const directPath = path.join(this.repoRoot, modeFile);
    if (fs.existsSync(directPath)) {
      const content = fs.readFileSync(directPath, "utf-8");
      const changelogIdx = content.lastIndexOf("## Changelog");
      if (changelogIdx !== -1) {
        const updated = content.trimEnd() + `\n- ${entry}\n`;
        fs.writeFileSync(directPath, updated);
      }
    }
  }
}
