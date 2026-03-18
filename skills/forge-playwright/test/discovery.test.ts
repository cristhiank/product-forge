import { describe, it, expect, beforeEach, afterEach } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";
import * as os from "node:os";
import { discoverProject, hasProjectDir, PROJECT_DIR_NAME } from "../src/discovery.js";

describe("discovery", () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "pw-test-"));
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it("returns not found when no .playwright-mcp/ exists", () => {
    const result = discoverProject(tmpDir);
    expect(result.found).toBe(false);
    expect(result.projectDir).toBeNull();
    expect(result.config).toBeNull();
  });

  it("discovers .playwright-mcp/ in current directory", () => {
    const dir = path.join(tmpDir, PROJECT_DIR_NAME);
    fs.mkdirSync(dir, { recursive: true });
    const result = discoverProject(tmpDir);
    expect(result.found).toBe(true);
    expect(result.projectDir).toBe(dir);
    // Default config when no config.json exists
    expect(result.config).not.toBeNull();
    expect(result.config!.authPattern).toBe("api-mock");
  });

  it("discovers .playwright-mcp/ in parent directory", () => {
    const projectDir = path.join(tmpDir, PROJECT_DIR_NAME);
    fs.mkdirSync(projectDir, { recursive: true });
    const childDir = path.join(tmpDir, "src", "components");
    fs.mkdirSync(childDir, { recursive: true });

    const result = discoverProject(childDir);
    expect(result.found).toBe(true);
    expect(result.projectDir).toBe(projectDir);
  });

  it("loads config.json when present", () => {
    const dir = path.join(tmpDir, PROJECT_DIR_NAME);
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(
      path.join(dir, "config.json"),
      JSON.stringify({
        ports: { frontend: 4000, api: 8080 },
        frontendFramework: "next",
        authPattern: "cookie",
      }),
    );

    const result = discoverProject(tmpDir);
    expect(result.config!.ports.frontend).toBe(4000);
    expect(result.config!.frontendFramework).toBe("next");
    expect(result.config!.authPattern).toBe("cookie");
  });

  it("reports error for invalid config.json", () => {
    const dir = path.join(tmpDir, PROJECT_DIR_NAME);
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, "config.json"), "not json");

    const result = discoverProject(tmpDir);
    expect(result.found).toBe(true);
    expect(result.config).toBeNull();
    expect(result.error).toBeDefined();
  });

  it("uses explicit dir when provided", () => {
    const explicit = path.join(tmpDir, "custom-dir");
    fs.mkdirSync(explicit, { recursive: true });

    const result = discoverProject("/nonexistent", explicit);
    expect(result.found).toBe(true);
    expect(result.projectDir).toBe(explicit);
  });

  it("hasProjectDir returns correct boolean", () => {
    expect(hasProjectDir(tmpDir)).toBe(false);
    fs.mkdirSync(path.join(tmpDir, PROJECT_DIR_NAME));
    expect(hasProjectDir(tmpDir)).toBe(true);
  });
});
