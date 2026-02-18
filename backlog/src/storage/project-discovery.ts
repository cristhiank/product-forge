/**
 * Project discovery — finds backlog roots across a workspace.
 *
 * Two modes:
 * 1. Filesystem scan: looks for `<scanDir>/<name>/.backlog/` directories.
 * 2. Config file: reads a `.backlog-projects.json` manifest.
 */

import * as fs from "node:fs/promises";
import * as path from "node:path";

export interface ProjectEntry {
  name: string;
  root: string; // absolute path to the .backlog directory
}

/**
 * Scan a directory for subdirectories containing a `.backlog/` folder.
 * Returns one ProjectEntry per discovered project, sorted by name.
 */
export async function discoverProjects(scanDir: string): Promise<ProjectEntry[]> {
  const absDir = path.resolve(scanDir);
  const entries = await fs.readdir(absDir, { withFileTypes: true });
  const projects: ProjectEntry[] = [];

  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    if (entry.name.startsWith(".")) continue;

    const backlogDir = path.join(absDir, entry.name, ".backlog");
    try {
      const stat = await fs.stat(backlogDir);
      if (stat.isDirectory()) {
        projects.push({ name: entry.name, root: backlogDir });
      }
    } catch {
      // No .backlog dir — skip
    }
  }

  projects.sort((a, b) => a.name.localeCompare(b.name));
  return projects;
}

/**
 * Expected shape of `.backlog-projects.json`:
 *
 * ```json
 * {
 *   "projects": [
 *     { "name": "frontend", "path": "frontend/.backlog" },
 *     { "name": "api", "path": "services/api/.backlog" }
 *   ]
 * }
 * ```
 *
 * Paths are resolved relative to the config file's directory.
 */
export async function parseProjectConfig(configPath: string): Promise<ProjectEntry[]> {
  const absConfig = path.resolve(configPath);
  const baseDir = path.dirname(absConfig);
  const raw = await fs.readFile(absConfig, "utf8");
  const parsed = JSON.parse(raw) as { projects?: Array<{ name: string; path: string }> };

  if (!parsed.projects || !Array.isArray(parsed.projects)) {
    throw new Error(`Invalid config: expected "projects" array in ${configPath}`);
  }

  return parsed.projects.map((p) => ({
    name: p.name,
    root: path.resolve(baseDir, p.path),
  }));
}

/**
 * Parse `--roots` CLI value: "project1=path1,project2=path2"
 * Paths are resolved relative to cwd.
 */
export function parseRootsArg(value: string): ProjectEntry[] {
  return value.split(",").map((pair) => {
    const eq = pair.indexOf("=");
    if (eq < 0) throw new Error(`Invalid --roots entry (expected name=path): ${pair}`);
    const name = pair.substring(0, eq).trim();
    const root = path.resolve(pair.substring(eq + 1).trim());
    if (!name) throw new Error(`Empty project name in --roots: ${pair}`);
    return { name, root };
  });
}
