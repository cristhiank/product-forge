import { describe, it, expect, beforeEach, afterEach } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";
import * as os from "node:os";
import { recommendConfig, validateConfig, formatConfigJSON } from "../src/config.js";
import { scaffoldProject } from "../src/project-scaffold.js";

describe("config", () => {
  it("recommends network and storage caps", () => {
    const rec = recommendConfig();
    expect(rec.args.join(" ")).toContain("network");
    expect(rec.args.join(" ")).toContain("storage");
    expect(rec.reasons.length).toBeGreaterThan(0);
  });

  it("includes project-specific warnings for OIDC", () => {
    const rec = recommendConfig({
      ports: { frontend: 3000, api: 5000 },
      frontendFramework: "react-vite",
      authPattern: "oidc",
      authEndpoint: "/api/me",
      defaultProfile: "admin",
    });
    expect(rec.warnings.some((w) => w.includes("OIDC"))).toBe(true);
  });

  it("formats config as JSON", () => {
    const rec = recommendConfig();
    const json = formatConfigJSON(rec);
    const parsed = JSON.parse(json);
    expect(parsed.mcpServers.playwright.command).toBe("npx");
    expect(parsed.mcpServers.playwright.args).toContain("@playwright/mcp@latest");
  });
});

describe("validateConfig", () => {
  it("identifies missing caps", () => {
    const result = validateConfig(["@playwright/mcp@latest"]);
    expect(result.missing.length).toBeGreaterThan(0);
    expect(result.missing.some((m) => m.includes("network"))).toBe(true);
  });

  it("recognizes present caps", () => {
    const result = validateConfig([
      "@playwright/mcp@latest",
      "--caps=network,storage",
      "--block-service-workers",
      "--ignore-https-errors",
      "--viewport-size=1280x720",
      "--console-level=info",
    ]);
    expect(result.ok.length).toBeGreaterThan(0);
    expect(result.ok.some((o) => o.includes("network"))).toBe(true);
    expect(result.ok.some((o) => o.includes("storage"))).toBe(true);
  });
});

describe("scaffoldProject", () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "pw-scaffold-"));
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it("creates .playwright-mcp/ directory with all files", () => {
    const result = scaffoldProject(tmpDir);
    expect(result.created).toContain("config.json");
    expect(result.created).toContain("profiles/admin.json");
    expect(result.created).toContain("init-pages/mocked.ts");
    expect(result.created).toContain(".gitignore");
    expect(fs.existsSync(result.projectDir)).toBe(true);
  });

  it("skips existing files without --force", () => {
    scaffoldProject(tmpDir);
    const result2 = scaffoldProject(tmpDir);
    expect(result2.skipped.length).toBe(4);
    expect(result2.created.length).toBe(0);
  });

  it("overwrites with --force", () => {
    scaffoldProject(tmpDir);
    const result2 = scaffoldProject(tmpDir, { force: true });
    expect(result2.created.length).toBe(4);
    expect(result2.skipped.length).toBe(0);
  });

  it("creates valid JSON files", () => {
    scaffoldProject(tmpDir);
    const config = JSON.parse(
      fs.readFileSync(path.join(tmpDir, ".playwright-mcp", "config.json"), "utf-8"),
    );
    expect(config.ports.frontend).toBe(3000);
    expect(config.authPattern).toBe("api-mock");

    const profile = JSON.parse(
      fs.readFileSync(path.join(tmpDir, ".playwright-mcp", "profiles", "admin.json"), "utf-8"),
    );
    expect(profile.name).toBe("admin");
    expect(profile.routes.length).toBeGreaterThan(0);
  });
});
