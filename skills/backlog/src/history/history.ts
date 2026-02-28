import type { Dirent } from "node:fs";
import * as fs from "node:fs/promises";
import * as path from "node:path";

import type { BacklogHistoryEntry } from "../types.js";

function assertValidId(id: string): void {
  if (!/^[A-Z]+-\d+(?:\.\d+)*$/.test(id)) {
    throw new Error(`Invalid backlog id: ${id}`);
  }
}

function isoCompactUtcNow(): string {
  // 20260109T235959Z
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return (
    d.getUTCFullYear() +
    pad(d.getUTCMonth() + 1) +
    pad(d.getUTCDate()) +
    "T" +
    pad(d.getUTCHours()) +
    pad(d.getUTCMinutes()) +
    pad(d.getUTCSeconds()) +
    "Z"
  );
}

function historyDir(root: string, id: string): string {
  assertValidId(id);
  return path.resolve(path.resolve(root), ".history", id);
}

export async function createHistorySnapshot(opts: {
  root: string;
  id: string;
  currentBody: string;
  message?: string;
}): Promise<BacklogHistoryEntry> {
  const dir = historyDir(opts.root, opts.id);
  await fs.mkdir(dir, { recursive: true });

  const existing = await listHistory({ root: opts.root, id: opts.id });
  const nextVersion = (existing.length ? Math.max(...existing.map((e) => e.version)) : 0) + 1;
  const ts = isoCompactUtcNow();
  const filename = `${ts}_v${nextVersion}.md`;
  const metaFilename = `${ts}_v${nextVersion}.json`;

  const snapshotPath = path.join(dir, filename);
  const metaPath = path.join(dir, metaFilename);

  // Use wx to prevent accidental overwrite
  const handle = await fs.open(snapshotPath, "wx");
  try {
    await handle.writeFile(opts.currentBody, "utf8");
  } finally {
    await handle.close();
  }

  await fs.writeFile(
    metaPath,
    JSON.stringify(
      {
        id: opts.id,
        version: nextVersion,
        timestamp: ts,
        message: opts.message,
      },
      null,
      2
    ),
    "utf8"
  );

  return {
    id: opts.id,
    version: nextVersion,
    timestamp: ts,
    path: path.posix.join(".history", opts.id, filename),
    message: opts.message,
  };
}

export async function listHistory(opts: { root: string; id: string }): Promise<BacklogHistoryEntry[]> {
  const dir = historyDir(opts.root, opts.id);
  let entries: Array<Dirent>;
  try {
    entries = await fs.readdir(dir, { withFileTypes: true });
  } catch {
    return [];
  }

  const out: BacklogHistoryEntry[] = [];

  for (const e of entries) {
    if (!e.isFile()) continue;
    const m = e.name.match(/^(\d{8}T\d{6}Z)_v(\d+)\.json$/);
    if (!m) continue;
    const [_, ts, vRaw] = m;
    const v = Number(vRaw);
    const metaPath = path.join(dir, e.name);
    let message: string | undefined;
    try {
      const meta = JSON.parse(await fs.readFile(metaPath, "utf8")) as { message?: string };
      message = meta.message;
    } catch {
      message = undefined;
    }
    out.push({
      id: opts.id,
      version: v,
      timestamp: ts,
      path: path.posix.join(".history", opts.id, `${ts}_v${v}.md`),
      message,
    });
  }

  out.sort((a, b) => b.version - a.version);
  return out;
}
