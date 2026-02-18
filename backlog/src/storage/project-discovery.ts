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
 * Searches up to `maxDepth` levels deep (default: 2) to find nested projects
 * like `pet_boarding_services/app/.backlog/`.
 * Returns one ProjectEntry per discovered project, sorted by name.
 */
export async function discoverProjects(scanDir: string, maxDepth = 2): Promise<ProjectEntry[]> {
  const absDir = path.resolve(scanDir);
  const projects: ProjectEntry[] = [];

  async function scan(dir: string, depth: number, namePath: string[]): Promise<void> {
    if (depth > maxDepth) return;
    let entries: Array<{ name: string; isDirectory(): boolean }>;
    try {
      entries = await fs.readdir(dir, { withFileTypes: true });
    } catch {
      return;
    }

    for (const entry of entries) {
      if (!entry.isDirectory()) continue;
      if (entry.name.startsWith(".")) continue;

      const childDir = path.join(dir, entry.name);
      const backlogDir = path.join(childDir, ".backlog");
      try {
        const stat = await fs.stat(backlogDir);
        if (stat.isDirectory()) {
          // Use the deepest directory name as project name, or join path segments
          const projectName = namePath.length > 0
            ? [...namePath, entry.name].join("-")
            : entry.name;
          projects.push({ name: projectName, root: backlogDir });
          continue; // Don't recurse into projects that already have a .backlog
        }
      } catch {
        // No .backlog here — recurse deeper
      }

      await scan(childDir, depth + 1, [...namePath, entry.name]);
    }
  }

  await scan(absDir, 1, []);
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
