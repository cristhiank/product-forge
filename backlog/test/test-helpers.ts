import * as fs from "node:fs/promises";
import * as os from "node:os";
import * as path from "node:path";

export async function makeTempBacklogRootFromFixture(): Promise<{ root: string; cleanup: () => Promise<void> }> {
  const src = path.resolve("test/fixtures/backlog-root");
  const tmp = await fs.mkdtemp(path.join(os.tmpdir(), "backlog-mcp-"));
  const dest = path.join(tmp, "backlog-root");
  await copyDir(src, dest);
  return {
    root: dest,
    cleanup: async () => {
      await fs.rm(tmp, { recursive: true, force: true });
    },
  };
}

export async function makeTempMultiProjectFixture(): Promise<{ scanDir: string; cleanup: () => Promise<void> }> {
  const src = path.resolve("test/fixtures/multi-project");
  const tmp = await fs.mkdtemp(path.join(os.tmpdir(), "backlog-mcp-multi-"));
  const dest = path.join(tmp, "workspace");
  await copyDir(src, dest);
  return {
    scanDir: dest,
    cleanup: async () => {
      await fs.rm(tmp, { recursive: true, force: true });
    },
  };
}

async function copyDir(src: string, dest: string): Promise<void> {
  await fs.mkdir(dest, { recursive: true });
  const entries = await fs.readdir(src, { withFileTypes: true });
  for (const e of entries) {
    const s = path.join(src, e.name);
    const d = path.join(dest, e.name);
    if (e.isDirectory()) {
      await copyDir(s, d);
    } else if (e.isFile()) {
      await fs.copyFile(s, d);
    }
  }
}
