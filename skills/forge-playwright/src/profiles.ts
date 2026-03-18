/**
 * Profiles — load, validate, and render mock profiles as MCP tool calls.
 *
 * Profiles live in .playwright-mcp/profiles/*.json.
 * The renderer outputs tool calls in LIFO-aware order (catch-all first, specific last).
 */

import * as fs from "node:fs";
import * as path from "node:path";
import { ProfileSchema, type Profile, type Route } from "./types.js";

const PROFILES_DIR = "profiles";

/**
 * List all profiles in the project directory.
 */
export function listProfiles(projectDir: string): string[] {
  const dir = path.join(projectDir, PROFILES_DIR);
  if (!fs.existsSync(dir)) return [];

  return fs
    .readdirSync(dir)
    .filter((f) => f.endsWith(".json"))
    .map((f) => f.replace(/\.json$/, ""))
    .sort();
}

/**
 * Load and validate a profile by name.
 */
export function loadProfile(
  projectDir: string,
  name: string,
): { profile: Profile | null; error?: string } {
  const filePath = path.join(projectDir, PROFILES_DIR, `${name}.json`);

  if (!fs.existsSync(filePath)) {
    return { profile: null, error: `Profile not found: ${filePath}` };
  }

  try {
    const raw = JSON.parse(fs.readFileSync(filePath, "utf-8"));
    const profile = ProfileSchema.parse(raw);
    return { profile };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { profile: null, error: `Invalid profile "${name}": ${message}` };
  }
}

/**
 * Render a profile as a sequence of MCP tool calls.
 *
 * Routes are output in LIFO-aware order: catch-all patterns first,
 * specific patterns last. This ensures correct priority because
 * Playwright MCP's browser_route uses LIFO (last registered wins).
 */
export function renderProfileToolCalls(
  profile: Profile,
  baseUrl?: string,
): string {
  const lines: string[] = [];
  lines.push(`# Profile: ${profile.name}`);
  if (profile.description) {
    lines.push(`# ${profile.description}`);
  }
  lines.push("");

  // Sort routes: catch-all patterns first (they should be registered first / lose priority)
  const sorted = sortRoutesForLIFO(profile.routes);

  if (sorted.length > 0) {
    lines.push("# Step 1: Set up API mock routes (LIFO order — catch-all first, specific last)");
    for (const route of sorted) {
      const bodyStr =
        typeof route.body === "string"
          ? route.body
          : JSON.stringify(route.body);

      lines.push(`browser_route(`);
      lines.push(`  pattern="${route.pattern}",`);
      lines.push(`  status=${route.status},`);
      lines.push(`  body='${bodyStr}',`);
      lines.push(`  contentType="${route.contentType}"`);
      lines.push(`)`);
      if (route.description) {
        lines.push(`# ^ ${route.description}`);
      }
      lines.push("");
    }
  }

  if (profile.cookies && profile.cookies.length > 0) {
    lines.push("# Step 2: Set cookies (requires --caps=storage)");
    for (const cookie of profile.cookies) {
      lines.push(`browser_cookie_set(`);
      lines.push(`  name="${cookie.name}",`);
      lines.push(`  value="${cookie.value}",`);
      lines.push(`  domain="${cookie.domain}",`);
      lines.push(`  path="${cookie.path}"`);
      lines.push(`)`);
      lines.push("");
    }
  }

  if (profile.localStorage && Object.keys(profile.localStorage).length > 0) {
    lines.push("# Step 3: Set localStorage (requires --caps=storage)");
    for (const [key, value] of Object.entries(profile.localStorage)) {
      lines.push(`browser_localstorage_set(key="${key}", value="${value}")`);
    }
    lines.push("");
  }

  const url = baseUrl ?? "http://localhost:3000";
  lines.push(`# Step 4: Navigate to the app`);
  lines.push(`browser_navigate(url="${url}")`);

  return lines.join("\n");
}

/**
 * Sort routes for LIFO registration: catch-all patterns first, specific last.
 * Playwright registers routes in LIFO order (last registered wins).
 * So we want specific routes registered LAST so they take priority.
 */
export function sortRoutesForLIFO(routes: Route[]): Route[] {
  return [...routes].sort((a, b) => {
    const aSpecificity = routeSpecificity(a.pattern);
    const bSpecificity = routeSpecificity(b.pattern);
    return aSpecificity - bSpecificity; // less specific first
  });
}

/**
 * Score route specificity: higher = more specific.
 * Catch-all like **​/api/** is least specific.
 * Exact paths like **​/api/me are most specific.
 */
function routeSpecificity(pattern: string): number {
  let score = 0;
  // Count literal path segments
  const segments = pattern.split("/").filter((s) => !s.includes("*"));
  score += segments.length * 10;
  // Penalize wildcards
  const wildcards = (pattern.match(/\*/g) || []).length;
  score -= wildcards * 5;
  // Bonus for exact paths (no wildcard at end)
  if (!pattern.endsWith("*") && !pattern.endsWith("**")) {
    score += 20;
  }
  return score;
}
