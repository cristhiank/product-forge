/**
 * Init Pages — load and list init-page scripts from .playwright-mcp/init-pages/
 */

import * as fs from "node:fs";
import * as path from "node:path";
import type { InitPageInfo, Profile } from "./types.js";

const INIT_PAGES_DIR = "init-pages";

/**
 * List all init-page scripts in the project directory.
 */
export function listInitPages(projectDir: string): string[] {
  const dir = path.join(projectDir, INIT_PAGES_DIR);
  if (!fs.existsSync(dir)) return [];

  return fs
    .readdirSync(dir)
    .filter((f) => f.endsWith(".ts") || f.endsWith(".js"))
    .map((f) => f.replace(/\.(ts|js)$/, ""))
    .sort();
}

/**
 * Load an init-page script by name.
 */
export function loadInitPage(
  projectDir: string,
  name: string,
): InitPageInfo | null {
  const dir = path.join(projectDir, INIT_PAGES_DIR);

  for (const ext of [".ts", ".js"]) {
    const filePath = path.join(dir, `${name}${ext}`);
    if (fs.existsSync(filePath)) {
      return {
        name,
        path: filePath,
        content: fs.readFileSync(filePath, "utf-8"),
      };
    }
  }

  return null;
}

/**
 * Generate an init-page script from a profile.
 * Converts profile routes to page.route() calls in LIFO-aware order.
 */
export function generateInitPageFromProfile(profile: Profile): string {
  const lines: string[] = [];
  lines.push(`/**`);
  lines.push(` * Auto-generated init-page from profile: ${profile.name}`);
  if (profile.description) {
    lines.push(` * ${profile.description}`);
  }
  lines.push(` *`);
  lines.push(
    ` * Usage: npx @playwright/mcp@latest --init-page=<this-file> --caps=network`,
  );
  lines.push(` */`);
  lines.push(`export default async ({ page }) => {`);

  // Sort by specificity ascending (catch-all first for LIFO)
  const sorted = [...profile.routes].sort((a, b) => {
    const aWild = (a.pattern.match(/\*/g) || []).length;
    const bWild = (b.pattern.match(/\*/g) || []).length;
    return bWild - aWild; // more wildcards first (less specific)
  });

  for (const route of sorted) {
    const bodyStr =
      typeof route.body === "string"
        ? route.body
        : JSON.stringify(route.body);

    if (route.description) {
      lines.push(`  // ${route.description}`);
    }
    lines.push(`  await page.route('${route.pattern}', route => route.fulfill({`);
    lines.push(`    status: ${route.status},`);
    lines.push(`    contentType: '${route.contentType}',`);
    lines.push(`    body: JSON.stringify(${bodyStr})`);
    lines.push(`  }));`);
    lines.push(``);
  }

  lines.push(`};`);
  return lines.join("\n");
}
