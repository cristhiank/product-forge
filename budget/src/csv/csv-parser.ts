// ─── CSV Parser ───────────────────────────────────────────────────────────
// Hand-rolled CSV read/write. Our CSVs are simple (no embedded newlines,
// quotes only when fields contain commas). No external deps needed.

import * as fs from "node:fs/promises";
import * as path from "node:path";

// ── Parse ─────────────────────────────────────────────────────────────────

/**
 * Parse a CSV field that may be quoted.
 * Handles: bare values, "quoted values", "escaped ""quotes""".
 */
function parseFields(line: string): string[] {
  const fields: string[] = [];
  let i = 0;

  while (i <= line.length) {
    if (i === line.length) {
      fields.push("");
      break;
    }

    if (line[i] === '"') {
      // Quoted field
      let value = "";
      i++; // skip opening quote
      while (i < line.length) {
        if (line[i] === '"') {
          if (i + 1 < line.length && line[i + 1] === '"') {
            value += '"';
            i += 2;
          } else {
            i++; // skip closing quote
            break;
          }
        } else {
          value += line[i];
          i++;
        }
      }
      fields.push(value);
      if (i < line.length && line[i] === ",") i++; // skip comma
    } else {
      // Unquoted field
      const nextComma = line.indexOf(",", i);
      if (nextComma === -1) {
        fields.push(line.substring(i));
        break;
      } else {
        fields.push(line.substring(i, nextComma));
        i = nextComma + 1;
      }
    }
  }

  return fields;
}

/**
 * Parse CSV text into an array of objects keyed by header columns.
 */
export function parseCSV(text: string): Record<string, string>[] {
  const lines = text.split(/\r?\n/).filter((l) => l.trim().length > 0);
  if (lines.length === 0) return [];

  const headers = parseFields(lines[0]);
  const rows: Record<string, string>[] = [];

  for (let i = 1; i < lines.length; i++) {
    const fields = parseFields(lines[i]);
    const row: Record<string, string> = {};
    for (let j = 0; j < headers.length; j++) {
      row[headers[j]] = fields[j] ?? "";
    }
    rows.push(row);
  }

  return rows;
}

/**
 * Extract just the header columns from CSV text.
 */
export function parseCSVHeaders(text: string): string[] {
  const firstLine = text.split(/\r?\n/)[0] ?? "";
  return parseFields(firstLine);
}

// ── Serialize ─────────────────────────────────────────────────────────────

/**
 * Quote a field if it contains commas, quotes, or newlines.
 */
function quoteField(value: string): string {
  if (value.includes(",") || value.includes('"') || value.includes("\n")) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

/**
 * Serialize an array of objects to CSV text.
 * Column order follows the `columns` param, or the keys of the first row.
 */
export function serializeCSV(rows: Record<string, string>[], columns?: string[]): string {
  if (rows.length === 0) return "";

  const cols = columns ?? Object.keys(rows[0]);
  const lines: string[] = [];

  lines.push(cols.map(quoteField).join(","));

  for (const row of rows) {
    const fields = cols.map((col) => quoteField(row[col] ?? ""));
    lines.push(fields.join(","));
  }

  return lines.join("\n") + "\n";
}

// ── File I/O ──────────────────────────────────────────────────────────────

export async function readCSVFile(filePath: string): Promise<Record<string, string>[]> {
  const text = await fs.readFile(filePath, "utf8");
  return parseCSV(text);
}

export async function writeCSVFile(
  filePath: string,
  rows: Record<string, string>[],
  columns?: string[]
): Promise<void> {
  const text = serializeCSV(rows, columns);
  // Ensure directory exists
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  // Atomic write via tmp file
  const tmp = filePath + ".tmp";
  await fs.writeFile(tmp, text, "utf8");
  await fs.rename(tmp, filePath);
}

/**
 * Read a CSV, apply a transform to rows, write back.
 * Returns the transformed rows.
 */
export async function transformCSVFile(
  filePath: string,
  transform: (rows: Record<string, string>[]) => Record<string, string>[],
  columns?: string[]
): Promise<Record<string, string>[]> {
  const rows = await readCSVFile(filePath);
  const transformed = transform(rows);

  // Preserve original column order if not specified
  if (!columns) {
    const text = await fs.readFile(filePath, "utf8");
    columns = parseCSVHeaders(text);
  }

  await writeCSVFile(filePath, transformed, columns);
  return transformed;
}
