import { describe, it, expect, beforeEach, afterEach } from "vitest";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { ChangelogManager } from "../src/changelog.js";

let changelog: ChangelogManager;
let tmpDir: string;
let dbPath: string;
let repoDir: string;

beforeEach(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "forge-harness-cl-test-"));
  dbPath = path.join(tmpDir, "test.db");
  repoDir = path.join(tmpDir, "repo");

  // Create mock mode file structure
  const forgeModes = path.join(repoDir, "agents", "forge", "modes");
  fs.mkdirSync(forgeModes, { recursive: true });
  fs.writeFileSync(
    path.join(forgeModes, "execute.md"),
    "# Execute Mode\n\nContent here.\n\n## Changelog\n\n- 2026-03-14: Initial.\n",
  );
  fs.writeFileSync(
    path.join(forgeModes, "verify.md"),
    "# Verify Mode\n\nContent here.\n",
  );

  changelog = new ChangelogManager(dbPath, repoDir);
});

afterEach(() => {
  changelog.close();
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

describe("ChangelogManager", () => {
  describe("add", () => {
    it("persists entry to DB and returns it", () => {
      const entry = changelog.add({
        modeFile: "execute.md",
        entry: "Tightened scope drift check",
      });
      expect(entry.mode_file).toBe("execute.md");
      expect(entry.entry).toContain("Tightened scope drift check");
      expect(entry.entry).toMatch(/^\d{4}-\d{2}-\d{2}:/);
    });

    it("appends entry to the actual mode file", () => {
      changelog.add({
        modeFile: "execute.md",
        entry: "Added flywheel metrics",
      });
      const content = fs.readFileSync(
        path.join(repoDir, "agents", "forge", "modes", "execute.md"),
        "utf-8",
      );
      expect(content).toContain("Added flywheel metrics");
    });
  });

  describe("show", () => {
    it("returns entries grouped by mode file", () => {
      changelog.add({ modeFile: "execute.md", entry: "Change 1" });
      changelog.add({ modeFile: "verify.md", entry: "Change 2" });
      const result = changelog.show();
      expect(result["execute.md"]).toHaveLength(1);
      expect(result["verify.md"]).toHaveLength(1);
    });

    it("filters by specific mode file", () => {
      changelog.add({ modeFile: "execute.md", entry: "Change 1" });
      changelog.add({ modeFile: "verify.md", entry: "Change 2" });
      const result = changelog.show({ modeFile: "execute.md" });
      expect(Object.keys(result)).toEqual(["execute.md"]);
    });
  });

  describe("recent", () => {
    it("returns recent entries across all files", () => {
      changelog.add({ modeFile: "execute.md", entry: "A" });
      changelog.add({ modeFile: "verify.md", entry: "B" });
      changelog.add({ modeFile: "execute.md", entry: "C" });
      const recent = changelog.recent({ limit: 2 });
      expect(recent).toHaveLength(2);
    });
  });

  describe("init", () => {
    it("adds changelog section to files that lack one", () => {
      const result = changelog.init();
      expect(result.initialized).toContain("agents/forge/modes/verify.md");
      // execute.md already has ## Changelog, should NOT be re-initialized
      expect(result.initialized).not.toContain("agents/forge/modes/execute.md");

      const content = fs.readFileSync(
        path.join(repoDir, "agents", "forge", "modes", "verify.md"),
        "utf-8",
      );
      expect(content).toContain("## Changelog");
    });
  });
});
