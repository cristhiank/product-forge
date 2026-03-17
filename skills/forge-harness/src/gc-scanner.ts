import fs from "node:fs";
import path from "node:path";
import Database from "better-sqlite3";
import type {
  GcScanOpts,
  GcFinding,
  GcFindingQueryOpts,
  GcClearOpts,
  GcScanType,
} from "./types.js";

const GC_SCHEMA = `
CREATE TABLE IF NOT EXISTS gc_findings (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  scan_type TEXT NOT NULL,
  file_path TEXT,
  line INTEGER,
  finding TEXT NOT NULL,
  severity TEXT NOT NULL,
  created_at TEXT DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_gc_type ON gc_findings(scan_type);
CREATE INDEX IF NOT EXISTS idx_gc_severity ON gc_findings(severity);
`;

const DEBT_PATTERNS = [
  { pattern: /\bTODO\b/i, tag: "TODO" },
  { pattern: /\bFIXME\b/i, tag: "FIXME" },
  { pattern: /\bHACK\b/i, tag: "HACK" },
  { pattern: /\bXXX\b/i, tag: "XXX" },
  { pattern: /\bWORKAROUND\b/i, tag: "WORKAROUND" },
  { pattern: /\bTEMP\b/, tag: "TEMP" },
];

const SKIP_DIRS = new Set([
  "node_modules", ".git", "dist", "build", "scripts",
  ".next", ".nuxt", "coverage", "__pycache__", ".venv",
  "vendor", "target",
]);

const CODE_EXTENSIONS = new Set([
  ".ts", ".tsx", ".js", ".jsx", ".py", ".go", ".rs",
  ".java", ".cs", ".rb", ".php", ".swift", ".kt",
  ".c", ".cpp", ".h", ".hpp", ".md",
]);

export class GcScanner {
  private db: Database.Database;

  constructor(dbPath: string) {
    const dir = path.dirname(dbPath);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    this.db = new Database(dbPath);
    this.db.pragma("journal_mode = WAL");
    this.db.exec(GC_SCHEMA);
  }

  scan(opts: GcScanOpts): GcFinding[] {
    const basePath = opts.path ?? process.cwd();
    const types: GcScanType[] =
      opts.type === "all" ? ["debt", "stale-docs", "dead-exports"] : [opts.type];

    const findings: GcFinding[] = [];
    for (const type of types) {
      switch (type) {
        case "debt":
          findings.push(...this.scanDebt(basePath));
          break;
        case "stale-docs":
          findings.push(...this.scanStaleDocs(basePath));
          break;
        case "dead-exports":
          findings.push(...this.scanDeadExports(basePath));
          break;
      }
    }

    // Persist findings
    const stmt = this.db.prepare(`
      INSERT INTO gc_findings (scan_type, file_path, line, finding, severity)
      VALUES (?, ?, ?, ?, ?)
    `);
    const insertMany = this.db.transaction((items: GcFinding[]) => {
      for (const f of items) {
        stmt.run(f.scan_type, f.file_path, f.line ?? null, f.finding, f.severity);
      }
    });
    insertMany(findings);

    return findings;
  }

  getFindings(opts?: GcFindingQueryOpts): GcFinding[] {
    const conditions: string[] = [];
    const params: unknown[] = [];

    if (opts?.severity) {
      conditions.push("severity = ?");
      params.push(opts.severity);
    }
    if (opts?.type) {
      conditions.push("scan_type = ?");
      params.push(opts.type);
    }

    const where =
      conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";
    const limit = opts?.limit ? `LIMIT ${opts.limit}` : "";

    return this.db
      .prepare(
        `SELECT * FROM gc_findings ${where} ORDER BY created_at DESC ${limit}`,
      )
      .all(...params) as GcFinding[];
  }

  clearFindings(opts?: GcClearOpts): { cleared: number } {
    if (opts?.olderThan) {
      const info = this.db
        .prepare("DELETE FROM gc_findings WHERE created_at < ?")
        .run(opts.olderThan);
      return { cleared: info.changes };
    }
    const info = this.db.prepare("DELETE FROM gc_findings").run();
    return { cleared: info.changes };
  }

  close(): void {
    this.db.close();
  }

  // ── Debt scan ──────────────────────────────────────

  private scanDebt(basePath: string): GcFinding[] {
    const findings: GcFinding[] = [];
    this.walkFiles(basePath, (filePath) => {
      const ext = path.extname(filePath);
      if (!CODE_EXTENSIONS.has(ext)) return;

      let content: string;
      try {
        content = fs.readFileSync(filePath, "utf-8");
      } catch {
        return;
      }

      const lines = content.split("\n");
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        for (const { pattern, tag } of DEBT_PATTERNS) {
          if (pattern.test(line)) {
            const relPath = path.relative(basePath, filePath);
            findings.push({
              scan_type: "debt",
              file_path: relPath,
              line: i + 1,
              finding: `${tag}: ${line.trim().substring(0, 120)}`,
              severity: tag === "FIXME" || tag === "HACK" ? "warning" : "info",
            });
            break; // one finding per line
          }
        }
      }
    });
    return findings;
  }

  // ── Stale docs scan ────────────────────────────────

  private scanStaleDocs(basePath: string): GcFinding[] {
    const findings: GcFinding[] = [];
    const readmePath = path.join(basePath, "README.md");

    if (!fs.existsSync(readmePath)) {
      findings.push({
        scan_type: "stale-docs",
        file_path: "README.md",
        finding: "No README.md found in project root",
        severity: "warning",
      });
      return findings;
    }

    let readme: string;
    try {
      readme = fs.readFileSync(readmePath, "utf-8");
    } catch {
      return findings;
    }

    // Check for references to files/dirs that don't exist
    const fileRefs = readme.match(/`([a-zA-Z0-9_/.-]+\.\w+)`/g) ?? [];
    for (const ref of fileRefs) {
      const cleaned = ref.replace(/`/g, "");
      if (cleaned.startsWith("http")) continue;
      if (cleaned.includes("*")) continue;
      const fullPath = path.join(basePath, cleaned);
      if (!fs.existsSync(fullPath)) {
        findings.push({
          scan_type: "stale-docs",
          file_path: "README.md",
          finding: `References non-existent file: ${cleaned}`,
          severity: "warning",
        });
      }
    }

    // Check for broken relative links
    const mdLinks = readme.match(/\[([^\]]+)\]\(([^)]+)\)/g) ?? [];
    for (const link of mdLinks) {
      const urlMatch = link.match(/\]\(([^)]+)\)/);
      if (!urlMatch) continue;
      const url = urlMatch[1];
      if (url.startsWith("http") || url.startsWith("#") || url.startsWith("mailto:")) continue;
      const target = path.join(basePath, url.split("#")[0]);
      if (!fs.existsSync(target)) {
        findings.push({
          scan_type: "stale-docs",
          file_path: "README.md",
          finding: `Broken link: ${url}`,
          severity: "warning",
        });
      }
    }

    return findings;
  }

  // ── Dead exports scan ──────────────────────────────

  private scanDeadExports(basePath: string): GcFinding[] {
    const findings: GcFinding[] = [];
    const exports: { name: string; file: string; line: number }[] = [];
    const allContent: string[] = [];

    // Phase 1: collect all named exports
    this.walkFiles(basePath, (filePath) => {
      const ext = path.extname(filePath);
      if (![".ts", ".tsx", ".js", ".jsx"].includes(ext)) return;

      let content: string;
      try {
        content = fs.readFileSync(filePath, "utf-8");
      } catch {
        return;
      }

      allContent.push(content);
      const relPath = path.relative(basePath, filePath);
      const lines = content.split("\n");

      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        // Match: export function name, export const name, export class name, export interface name, export type name
        const exportMatch = line.match(
          /^export\s+(?:async\s+)?(?:function|const|let|var|class|interface|type|enum)\s+(\w+)/,
        );
        if (exportMatch) {
          exports.push({ name: exportMatch[1], file: relPath, line: i + 1 });
        }
      }
    });

    // Phase 2: check if each export is imported/used elsewhere
    const fullText = allContent.join("\n");
    for (const exp of exports) {
      // Skip if name is too common or is the main entry point
      if (exp.name.length < 3) continue;
      if (exp.file.includes("index.")) continue;

      // Count occurrences — must appear at least twice (definition + usage)
      const regex = new RegExp(`\\b${exp.name}\\b`, "g");
      const matches = fullText.match(regex);
      if (matches && matches.length <= 1) {
        findings.push({
          scan_type: "dead-exports",
          file_path: exp.file,
          line: exp.line,
          finding: `Potentially unused export: ${exp.name}`,
          severity: "info",
        });
      }
    }

    return findings;
  }

  // ── File walker ────────────────────────────────────

  private walkFiles(dir: string, callback: (filePath: string) => void): void {
    let entries: fs.Dirent[];
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch {
      return;
    }

    for (const entry of entries) {
      if (entry.name.startsWith(".")) continue;
      if (SKIP_DIRS.has(entry.name)) continue;

      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        this.walkFiles(fullPath, callback);
      } else if (entry.isFile()) {
        callback(fullPath);
      }
    }
  }
}
