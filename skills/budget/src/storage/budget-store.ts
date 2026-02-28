// ─── Budget Store Interface ───────────────────────────────────────────────
// Abstract storage contract. The filesystem implementation lives in fs-store.ts.

import type { CSVSchema } from "../csv/schemas.js";

export interface BudgetStore {
  /** Root of the finance/ directory */
  getRoot(): string;

  /** Active year (e.g. "2026") */
  getYear(): string;

  // ── Generic CSV access ────────────────────────────────────────────────

  /** Read all rows from a CSV file by logical name (resolves path automatically). */
  readTable(name: string): Promise<Record<string, string>[]>;

  /** Write full content to a CSV file by logical name. */
  writeTable(name: string, rows: Record<string, string>[]): Promise<void>;

  /** Append rows to a CSV file (for logs/ledger). */
  appendRows(name: string, rows: Record<string, string>[]): Promise<void>;

  /** Read + transform + write back in one step. Returns transformed rows. */
  transformTable(
    name: string,
    transform: (rows: Record<string, string>[]) => Record<string, string>[]
  ): Promise<Record<string, string>[]>;

  // ── Typed helpers ─────────────────────────────────────────────────────

  /** Get a single row by primary key value(s). */
  getRow(name: string, key: Record<string, string>): Promise<Record<string, string> | undefined>;

  /** Update a single row matching primary key. Returns true if found and updated. */
  updateRow(
    name: string,
    key: Record<string, string>,
    updates: Record<string, string>
  ): Promise<boolean>;

  /** Delete rows matching primary key. Returns count deleted. */
  deleteRows(name: string, key: Record<string, string>): Promise<number>;

  // ── Schema info ───────────────────────────────────────────────────────

  /** Get the schema for a logical table name. */
  getSchema(name: string): CSVSchema;

  /** Get the resolved filesystem path for a logical table name. */
  getPath(name: string): string;

  /** Check if a logical table's file exists on disk. */
  exists(name: string): Promise<boolean>;
}
