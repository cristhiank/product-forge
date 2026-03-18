/**
 * Discovery — find .playwright-mcp/ project directory
 *
 * Walks up from cwd (or explicit path) looking for .playwright-mcp/ directory.
 * Same pattern as backlog's project-discovery.ts.
 */

import * as fs from "node:fs";
import * as path from "node:path";
import { ProjectConfigSchema, type ProjectConfig } from "./types.js";

export const PROJECT_DIR_NAME = ".playwright-mcp";
export const CONFIG_FILE = "config.json";

export interface DiscoveryResult {
  found: boolean;
  projectDir: string | null;
  config: ProjectConfig | null;
  error?: string;
}

/**
 * Discover .playwright-mcp/ directory by walking up from startDir.
 * If explicitDir is provided, use it directly.
 */
export function discoverProject(
  startDir: string = process.cwd(),
  explicitDir?: string,
): DiscoveryResult {
  const dir = explicitDir ?? findProjectDir(startDir);

  if (!dir) {
    return { found: false, projectDir: null, config: null };
  }

  const configPath = path.join(dir, CONFIG_FILE);
  if (!fs.existsSync(configPath)) {
    return {
      found: true,
      projectDir: dir,
      config: ProjectConfigSchema.parse({}),
    };
  }

  try {
    const raw = JSON.parse(fs.readFileSync(configPath, "utf-8"));
    const config = ProjectConfigSchema.parse(raw);
    return { found: true, projectDir: dir, config };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return {
      found: true,
      projectDir: dir,
      config: null,
      error: `Invalid ${CONFIG_FILE}: ${message}`,
    };
  }
}

/**
 * Walk up from startDir looking for .playwright-mcp/ directory.
 */
function findProjectDir(startDir: string): string | null {
  let current = path.resolve(startDir);
  const root = path.parse(current).root;

  while (current !== root) {
    const candidate = path.join(current, PROJECT_DIR_NAME);
    if (fs.existsSync(candidate) && fs.statSync(candidate).isDirectory()) {
      return candidate;
    }
    current = path.dirname(current);
  }

  return null;
}

/**
 * Check if a .playwright-mcp/ directory exists in the given dir.
 */
export function hasProjectDir(dir: string): boolean {
  const candidate = path.join(dir, PROJECT_DIR_NAME);
  return fs.existsSync(candidate) && fs.statSync(candidate).isDirectory();
}
