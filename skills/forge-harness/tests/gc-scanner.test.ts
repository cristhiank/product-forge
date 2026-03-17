import { describe, it, expect, beforeEach, afterEach } from "vitest";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { GcScanner } from "../src/gc-scanner.js";

let scanner: GcScanner;
let tmpDir: string;
let dbPath: string;
let projectDir: string;

beforeEach(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "forge-harness-gc-test-"));
  dbPath = path.join(tmpDir, "test.db");
  projectDir = path.join(tmpDir, "project");
  fs.mkdirSync(projectDir, { recursive: true });
  scanner = new GcScanner(dbPath);
});

afterEach(() => {
  scanner.close();
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

describe("GcScanner", () => {
  describe("scan - debt", () => {
    it("finds TODO comments", () => {
      fs.writeFileSync(
        path.join(projectDir, "app.ts"),
        'const x = 1; // TODO: refactor this\nconst y = 2;\n',
      );
      const findings = scanner.scan({ type: "debt", path: projectDir });
      expect(findings).toHaveLength(1);
      expect(findings[0].scan_type).toBe("debt");
      expect(findings[0].finding).toContain("TODO");
      expect(findings[0].severity).toBe("info");
    });

    it("finds FIXME as warning", () => {
      fs.writeFileSync(
        path.join(projectDir, "app.ts"),
        '// FIXME: this is broken\n',
      );
      const findings = scanner.scan({ type: "debt", path: projectDir });
      expect(findings).toHaveLength(1);
      expect(findings[0].severity).toBe("warning");
    });

    it("finds HACK as warning", () => {
      fs.writeFileSync(
        path.join(projectDir, "app.ts"),
        '// HACK: workaround for issue #123\n',
      );
      const findings = scanner.scan({ type: "debt", path: projectDir });
      expect(findings).toHaveLength(1);
      expect(findings[0].severity).toBe("warning");
    });

    it("skips non-code files", () => {
      fs.writeFileSync(
        path.join(projectDir, "data.json"),
        '{"todo": "this should not match"}',
      );
      const findings = scanner.scan({ type: "debt", path: projectDir });
      expect(findings).toHaveLength(0);
    });

    it("skips node_modules", () => {
      const nm = path.join(projectDir, "node_modules", "pkg");
      fs.mkdirSync(nm, { recursive: true });
      fs.writeFileSync(path.join(nm, "index.ts"), "// TODO: dep debt\n");
      const findings = scanner.scan({ type: "debt", path: projectDir });
      expect(findings).toHaveLength(0);
    });
  });

  describe("scan - stale-docs", () => {
    it("warns when README.md is missing", () => {
      const findings = scanner.scan({ type: "stale-docs", path: projectDir });
      expect(findings).toHaveLength(1);
      expect(findings[0].finding).toContain("No README.md");
    });

    it("finds references to non-existent files", () => {
      fs.writeFileSync(
        path.join(projectDir, "README.md"),
        "See `src/missing.ts` for details.\n",
      );
      const findings = scanner.scan({ type: "stale-docs", path: projectDir });
      expect(findings).toHaveLength(1);
      expect(findings[0].finding).toContain("non-existent file");
    });

    it("does not flag existing file references", () => {
      fs.mkdirSync(path.join(projectDir, "src"), { recursive: true });
      fs.writeFileSync(path.join(projectDir, "src", "app.ts"), "export {};\n");
      fs.writeFileSync(
        path.join(projectDir, "README.md"),
        "See `src/app.ts` for details.\n",
      );
      const findings = scanner.scan({ type: "stale-docs", path: projectDir });
      expect(findings).toHaveLength(0);
    });

    it("finds broken relative links", () => {
      fs.writeFileSync(
        path.join(projectDir, "README.md"),
        "[Guide](./docs/guide.md) is here.\n",
      );
      const findings = scanner.scan({ type: "stale-docs", path: projectDir });
      expect(findings.some((f) => f.finding.includes("Broken link"))).toBe(true);
    });
  });

  describe("scan - dead-exports", () => {
    it("finds unused exports", () => {
      fs.writeFileSync(
        path.join(projectDir, "utils.ts"),
        'export function unusedHelper() { return 1; }\nexport function usedHelper() { return 2; }\n',
      );
      fs.writeFileSync(
        path.join(projectDir, "app.ts"),
        'import { usedHelper } from "./utils";\nconsole.log(usedHelper());\n',
      );
      const findings = scanner.scan({ type: "dead-exports", path: projectDir });
      const unused = findings.filter((f) =>
        f.finding.includes("unusedHelper"),
      );
      expect(unused.length).toBeGreaterThanOrEqual(1);
    });
  });

  describe("scan - all", () => {
    it("runs all scan types", () => {
      fs.writeFileSync(
        path.join(projectDir, "app.ts"),
        '// TODO: fix this\nexport function deadExport() {}\n',
      );
      const findings = scanner.scan({ type: "all", path: projectDir });
      const types = new Set(findings.map((f) => f.scan_type));
      expect(types.has("debt")).toBe(true);
      expect(types.has("stale-docs")).toBe(true);
    });
  });

  describe("getFindings", () => {
    it("retrieves persisted findings", () => {
      fs.writeFileSync(
        path.join(projectDir, "app.ts"),
        "// TODO: something\n// FIXME: broken\n",
      );
      scanner.scan({ type: "debt", path: projectDir });
      const findings = scanner.getFindings();
      expect(findings.length).toBeGreaterThanOrEqual(2);
    });

    it("filters by severity", () => {
      fs.writeFileSync(
        path.join(projectDir, "app.ts"),
        "// TODO: info level\n// FIXME: warning level\n",
      );
      scanner.scan({ type: "debt", path: projectDir });
      const warnings = scanner.getFindings({ severity: "warning" });
      expect(warnings.every((f) => f.severity === "warning")).toBe(true);
    });
  });

  describe("clearFindings", () => {
    it("clears all findings", () => {
      fs.writeFileSync(path.join(projectDir, "app.ts"), "// TODO: a\n");
      scanner.scan({ type: "debt", path: projectDir });
      const { cleared } = scanner.clearFindings();
      expect(cleared).toBeGreaterThan(0);
      expect(scanner.getFindings()).toHaveLength(0);
    });
  });
});
