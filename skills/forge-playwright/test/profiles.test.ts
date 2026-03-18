import { describe, it, expect, beforeEach, afterEach } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";
import * as os from "node:os";
import {
  listProfiles,
  loadProfile,
  renderProfileToolCalls,
  sortRoutesForLIFO,
} from "../src/profiles.js";
import type { Profile, Route } from "../src/types.js";

describe("profiles", () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "pw-test-"));
    fs.mkdirSync(path.join(tmpDir, "profiles"), { recursive: true });
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it("lists profiles from directory", () => {
    fs.writeFileSync(
      path.join(tmpDir, "profiles", "admin.json"),
      JSON.stringify({ name: "admin", routes: [] }),
    );
    fs.writeFileSync(
      path.join(tmpDir, "profiles", "staff.json"),
      JSON.stringify({ name: "staff", routes: [] }),
    );

    const profiles = listProfiles(tmpDir);
    expect(profiles).toEqual(["admin", "staff"]);
  });

  it("returns empty array when no profiles dir", () => {
    const emptyDir = fs.mkdtempSync(path.join(os.tmpdir(), "pw-empty-"));
    expect(listProfiles(emptyDir)).toEqual([]);
    fs.rmSync(emptyDir, { recursive: true, force: true });
  });

  it("loads and validates a profile", () => {
    const profile = {
      name: "admin",
      description: "Admin user",
      routes: [
        { pattern: "**/api/me", status: 200, body: { id: "1" } },
      ],
    };
    fs.writeFileSync(
      path.join(tmpDir, "profiles", "admin.json"),
      JSON.stringify(profile),
    );

    const result = loadProfile(tmpDir, "admin");
    expect(result.profile).not.toBeNull();
    expect(result.profile!.name).toBe("admin");
    expect(result.profile!.routes).toHaveLength(1);
  });

  it("reports error for missing profile", () => {
    const result = loadProfile(tmpDir, "nonexistent");
    expect(result.profile).toBeNull();
    expect(result.error).toContain("not found");
  });

  it("reports error for invalid profile JSON", () => {
    fs.writeFileSync(
      path.join(tmpDir, "profiles", "bad.json"),
      "not json",
    );
    const result = loadProfile(tmpDir, "bad");
    expect(result.profile).toBeNull();
    expect(result.error).toBeDefined();
  });

  describe("sortRoutesForLIFO", () => {
    it("puts catch-all routes first and specific routes last", () => {
      const routes: Route[] = [
        { pattern: "**/api/me", status: 200, contentType: "application/json", body: {} },
        { pattern: "**/api/**", status: 200, contentType: "application/json", body: {} },
        { pattern: "**/api/tenants/*/onboarding", status: 200, contentType: "application/json", body: {} },
      ];

      const sorted = sortRoutesForLIFO(routes);
      // Catch-all (**/api/**) should be first (registered first, lowest LIFO priority)
      expect(sorted[0].pattern).toBe("**/api/**");
      // Both specific routes should come after catch-all
      const specificPatterns = sorted.slice(1).map((r) => r.pattern);
      expect(specificPatterns).toContain("**/api/me");
      expect(specificPatterns).toContain("**/api/tenants/*/onboarding");
    });
  });

  describe("renderProfileToolCalls", () => {
    it("renders browser_route calls in LIFO order", () => {
      const profile: Profile = {
        name: "test",
        routes: [
          { pattern: "**/api/me", status: 200, contentType: "application/json", body: { id: "1" } },
          { pattern: "**/api/**", status: 200, contentType: "application/json", body: {} },
        ],
      };

      const output = renderProfileToolCalls(profile, "http://localhost:4000");
      // Catch-all should appear before specific
      const catchAllIdx = output.indexOf("**/api/**");
      const specificIdx = output.indexOf("**/api/me");
      expect(catchAllIdx).toBeLessThan(specificIdx);
      // Should end with navigation
      expect(output).toContain("browser_navigate");
      expect(output).toContain("localhost:4000");
    });

    it("includes cookies and localStorage when present", () => {
      const profile: Profile = {
        name: "test",
        routes: [],
        cookies: [{ name: "auth", value: "tok", domain: "localhost", path: "/" }],
        localStorage: { theme: "dark" },
      };

      const output = renderProfileToolCalls(profile);
      expect(output).toContain("browser_cookie_set");
      expect(output).toContain("browser_localstorage_set");
    });
  });
});
