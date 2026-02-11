// ─── Filesystem Budget Store ──────────────────────────────────────────────

import * as fs from "node:fs/promises";
import * as path from "node:path";

import { parseCSVHeaders, readCSVFile, writeCSVFile } from "../csv/csv-parser.js";
import { ALL_SCHEMAS, type CSVSchema } from "../csv/schemas.js";
import type { BudgetStore } from "./budget-store.js";

/**
 * Maps logical table names to their relative filesystem paths.
 * Year-scoped tables use "{year}" placeholder.
 */
const PATH_MAP: Record<string, string> = {
  // Config (global)
  family_profile:            "config/family_profile.csv",
  settings:                  "config/settings.csv",
  expense_categories:        "config/expense_categories.csv",

  // Year-scoped
  income_sources:            "{year}/income/income_sources.csv",
  paystub_breakdown:         "{year}/income/paystub_breakdown_01.csv",
  budget_annual:             "{year}/budget/budget_annual.csv",
  budget_monthly:            "{year}/budget/budget_monthly.csv",
  debts:                     "{year}/debt/debts.csv",
  payoff_plan:               "{year}/debt/payoff_plan.csv",
  recurring_expenses:        "{year}/expenses/recurring_expenses.csv",
  savings_goals:             "{year}/goals/savings_goals.csv",
  financial_health:          "{year}/analysis/financial_health.csv",
  snapshot:                  "{year}/snapshot_{year}.csv",
  goal_allocation_strategy:  "{year}/analysis/goal_allocation_strategy.csv",
  car_affordability:         "{year}/analysis/car_affordability.csv",
  us_house_affordability:    "{year}/analysis/us_house_affordability.csv",
  ledger:                    "{year}/actuals/ledger_01.csv",
  planner_log:               "{year}/logs/planner_log.csv",
};

export class FileSystemBudgetStore implements BudgetStore {
  private readonly rootAbs: string;
  private readonly year: string;

  constructor(opts: { root: string; year: string }) {
    this.rootAbs = path.resolve(opts.root);
    this.year = opts.year;
  }

  getRoot(): string {
    return this.rootAbs;
  }

  getYear(): string {
    return this.year;
  }

  // ── Path resolution ───────────────────────────────────────────────────

  private resolvePath(name: string): string {
    const template = PATH_MAP[name];
    if (!template) throw new Error(`Unknown table: ${name}. Available: ${Object.keys(PATH_MAP).join(", ")}`);
    const relPath = template.replace(/\{year\}/g, this.year);
    const abs = path.resolve(this.rootAbs, relPath);

    // Path traversal guard
    const rootWithSep = this.rootAbs.endsWith(path.sep) ? this.rootAbs : this.rootAbs + path.sep;
    if (abs !== this.rootAbs && !abs.startsWith(rootWithSep)) {
      throw new Error("Path traversal detected");
    }
    return abs;
  }

  getPath(name: string): string {
    return this.resolvePath(name);
  }

  getSchema(name: string): CSVSchema {
    const schema = ALL_SCHEMAS[name];
    if (!schema) throw new Error(`No schema for table: ${name}`);
    return schema;
  }

  async exists(name: string): Promise<boolean> {
    try {
      await fs.access(this.resolvePath(name));
      return true;
    } catch {
      return false;
    }
  }

  // ── Generic CSV operations ────────────────────────────────────────────

  async readTable(name: string): Promise<Record<string, string>[]> {
    const filePath = this.resolvePath(name);
    return readCSVFile(filePath);
  }

  async writeTable(name: string, rows: Record<string, string>[]): Promise<void> {
    const filePath = this.resolvePath(name);
    const schema = this.getSchema(name);
    await writeCSVFile(filePath, rows, schema.columns);
  }

  async appendRows(name: string, rows: Record<string, string>[]): Promise<void> {
    const filePath = this.resolvePath(name);
    const schema = this.getSchema(name);

    let existing: string;
    try {
      existing = await fs.readFile(filePath, "utf8");
    } catch {
      // File doesn't exist — write with headers
      await writeCSVFile(filePath, rows, schema.columns);
      return;
    }

    // Append without re-writing headers
    const appendText = rows.map((row) =>
      schema.columns.map((col) => {
        const val = row[col] ?? "";
        return val.includes(",") || val.includes('"') || val.includes("\n")
          ? `"${val.replace(/"/g, '""')}"`
          : val;
      }).join(",")
    ).join("\n");

    const needsNewline = existing.length > 0 && !existing.endsWith("\n");
    await fs.appendFile(filePath, (needsNewline ? "\n" : "") + appendText + "\n", "utf8");
  }

  async transformTable(
    name: string,
    transform: (rows: Record<string, string>[]) => Record<string, string>[]
  ): Promise<Record<string, string>[]> {
    const rows = await this.readTable(name);
    const transformed = transform(rows);
    const schema = this.getSchema(name);

    // Prefer actual file columns (may have extra columns not in schema)
    let columns: string[];
    try {
      const text = await fs.readFile(this.resolvePath(name), "utf8");
      columns = parseCSVHeaders(text);
    } catch {
      columns = schema.columns;
    }

    await writeCSVFile(this.resolvePath(name), transformed, columns);
    return transformed;
  }

  // ── Row-level helpers ─────────────────────────────────────────────────

  async getRow(name: string, key: Record<string, string>): Promise<Record<string, string> | undefined> {
    const rows = await this.readTable(name);
    return rows.find((row) =>
      Object.entries(key).every(([k, v]) => row[k] === v)
    );
  }

  async updateRow(
    name: string,
    key: Record<string, string>,
    updates: Record<string, string>
  ): Promise<boolean> {
    let found = false;
    await this.transformTable(name, (rows) =>
      rows.map((row) => {
        const matches = Object.entries(key).every(([k, v]) => row[k] === v);
        if (matches) {
          found = true;
          return { ...row, ...updates };
        }
        return row;
      })
    );
    return found;
  }

  async deleteRows(name: string, key: Record<string, string>): Promise<number> {
    const before = await this.readTable(name);
    const after = before.filter((row) =>
      !Object.entries(key).every(([k, v]) => row[k] === v)
    );
    const deleted = before.length - after.length;
    if (deleted > 0) {
      await this.writeTable(name, after);
    }
    return deleted;
  }
}
