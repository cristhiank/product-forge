/**
 * Project Scaffold — create .playwright-mcp/ directory structure.
 */

import * as fs from "node:fs";
import * as path from "node:path";
import { PROJECT_DIR_NAME } from "./discovery.js";

const DEFAULT_CONFIG = {
  ports: { frontend: 3000, api: 5000 },
  frontendFramework: "react-vite",
  authPattern: "api-mock",
  authEndpoint: "/api/me",
  defaultProfile: "admin",
};

const DEFAULT_ADMIN_PROFILE = {
  name: "admin",
  description:
    "Authenticated admin user — customize the routes below with your project's actual API response shapes",
  routes: [
    {
      pattern: "**/api/me",
      status: 200,
      contentType: "application/json",
      body: {
        id: "e2e-admin-id",
        email: "admin@test.com",
        name: "E2E Admin",
        role: "admin",
      },
      description: "Auth endpoint — return authenticated user object",
    },
    {
      pattern: "**/api/**",
      status: 200,
      contentType: "application/json",
      body: {},
      description:
        "Catch-all fallback — prevents 401/404 noise for unmocked endpoints",
    },
  ],
  cookies: [],
  localStorage: {},
};

const DEFAULT_INIT_PAGE = `/**
 * Playwright MCP init-page script — auto-applies mock profile before any page loads.
 *
 * Usage: npx @playwright/mcp@latest --init-page=.playwright-mcp/init-pages/mocked.ts --caps=network
 *
 * IMPORTANT: Edit the mock responses below to match YOUR project's API shapes.
 * This file was scaffolded by forge-playwright — customize it for your project.
 */
export default async ({ page }) => {
  // 1. Catch-all API fallback (register FIRST — LIFO means it has lowest priority)
  await page.route('**/api/**', route => route.fulfill({
    status: 200, contentType: 'application/json', body: JSON.stringify({})
  }));

  // 2. Auth endpoint (register LAST — LIFO means it has highest priority)
  await page.route('**/api/me', route => route.fulfill({
    status: 200, contentType: 'application/json',
    body: JSON.stringify({
      id: 'e2e-admin-id', email: 'admin@test.com', name: 'E2E Admin', role: 'admin'
    })
  }));
};
`;

const GITIGNORE = `# Storage state files contain auth tokens — never commit
storage-state*.json
*.storageState.json
`;

export interface ScaffoldResult {
  created: string[];
  skipped: string[];
  projectDir: string;
}

/**
 * Scaffold a new .playwright-mcp/ directory in the target directory.
 */
export function scaffoldProject(
  targetDir: string,
  options?: { force?: boolean },
): ScaffoldResult {
  const projectDir = path.join(targetDir, PROJECT_DIR_NAME);
  const created: string[] = [];
  const skipped: string[] = [];

  const write = (relPath: string, content: string) => {
    const fullPath = path.join(projectDir, relPath);
    if (fs.existsSync(fullPath) && !options?.force) {
      skipped.push(relPath);
      return;
    }
    fs.mkdirSync(path.dirname(fullPath), { recursive: true });
    fs.writeFileSync(fullPath, content, "utf-8");
    created.push(relPath);
  };

  write("config.json", JSON.stringify(DEFAULT_CONFIG, null, 2) + "\n");
  write(
    "profiles/admin.json",
    JSON.stringify(DEFAULT_ADMIN_PROFILE, null, 2) + "\n",
  );
  write("init-pages/mocked.ts", DEFAULT_INIT_PAGE);
  write(".gitignore", GITIGNORE);

  return { created, skipped, projectDir };
}
