import { describe, it, expect, beforeEach, afterEach } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";
import * as os from "node:os";
import { ProductRepository } from "../src/repository.js";
import {
  transitionFeature,
  canTransition,
  linkEpic,
  getLifecycleOverview,
} from "../src/lifecycle.js";
import {
  FEATURE_TRANSITIONS,
  defaultFrontmatter,
  defaultFeatureFrontmatter,
} from "../src/schema.js";

let tmpDir: string;
let repo: ProductRepository;

beforeEach(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "product-hub-test-"));
  repo = new ProductRepository(tmpDir);
  repo.init({
    name: "TestProduct",
    stage: "mvp",
    version: "0.1.0",
    description: "Test product",
    north_star: "test_metric",
    created: "2026-01-01",
  });
});

afterEach(() => {
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

// --- Repository tests ---

describe("ProductRepository", () => {
  describe("init", () => {
    it("creates .product directory structure", () => {
      expect(fs.existsSync(path.join(tmpDir, ".product"))).toBe(true);
      expect(fs.existsSync(path.join(tmpDir, ".product/_meta.yaml"))).toBe(true);
      expect(fs.existsSync(path.join(tmpDir, ".product/vision"))).toBe(true);
      expect(fs.existsSync(path.join(tmpDir, ".product/customers"))).toBe(true);
      expect(fs.existsSync(path.join(tmpDir, ".product/brand"))).toBe(true);
      expect(fs.existsSync(path.join(tmpDir, ".product/features"))).toBe(true);
      expect(fs.existsSync(path.join(tmpDir, ".product/strategy"))).toBe(true);
      expect(fs.existsSync(path.join(tmpDir, ".product/experiments"))).toBe(true);
      expect(fs.existsSync(path.join(tmpDir, ".product/playbooks"))).toBe(true);
    });

    it("writes _meta.yaml with correct content", () => {
      const meta = repo.readMeta();
      expect(meta.name).toBe("TestProduct");
      expect(meta.stage).toBe("mvp");
      expect(meta.north_star).toBe("test_metric");
    });
  });

  describe("exists", () => {
    it("returns true when initialized", () => {
      expect(repo.exists()).toBe(true);
    });

    it("returns false for uninitialized dir", () => {
      const otherDir = fs.mkdtempSync(path.join(os.tmpdir(), "product-hub-empty-"));
      const otherRepo = new ProductRepository(otherDir);
      expect(otherRepo.exists()).toBe(false);
      fs.rmSync(otherDir, { recursive: true, force: true });
    });
  });

  describe("read/write", () => {
    it("writes and reads a document with frontmatter", () => {
      const fm = defaultFrontmatter("vision");
      repo.write("vision/VISION.md", {
        frontmatter: fm,
        content: "# Our Vision\n\nBuild the best thing.",
      });

      const doc = repo.read("vision/VISION.md");
      expect(doc.frontmatter.type).toBe("vision");
      expect(doc.frontmatter.version).toBe("0.1.0");
      expect(doc.frontmatter.status).toBe("draft");
      expect(doc.content).toContain("Build the best thing");
    });

    it("auto-updates timestamp on write", () => {
      const fm = { ...defaultFrontmatter("brand"), updated: "2020-01-01" };
      repo.write("brand/GUIDELINES.md", {
        frontmatter: fm,
        content: "# Brand",
      });

      const doc = repo.read("brand/GUIDELINES.md");
      expect(doc.frontmatter.updated).not.toBe("2020-01-01");
      expect(doc.frontmatter.updated_by).toBe("forge-product");
    });

    it("throws for missing document", () => {
      expect(() => repo.read("nonexistent.md")).toThrow("Document not found");
    });
  });

  describe("delete", () => {
    it("deletes an existing document", () => {
      repo.write("vision/TEST.md", {
        frontmatter: defaultFrontmatter("vision"),
        content: "temp",
      });
      expect(() => repo.read("vision/TEST.md")).not.toThrow();
      repo.delete("vision/TEST.md");
      expect(() => repo.read("vision/TEST.md")).toThrow();
    });
  });

  describe("list", () => {
    it("lists all documents", () => {
      repo.write("vision/V.md", {
        frontmatter: defaultFrontmatter("vision"),
        content: "v",
      });
      repo.write("brand/B.md", {
        frontmatter: defaultFrontmatter("brand"),
        content: "b",
      });

      const all = repo.list();
      expect(all.length).toBe(2);
    });

    it("filters by type", () => {
      repo.write("vision/V.md", {
        frontmatter: defaultFrontmatter("vision"),
        content: "v",
      });
      repo.write("brand/B.md", {
        frontmatter: defaultFrontmatter("brand"),
        content: "b",
      });

      const visionOnly = repo.list("vision");
      expect(visionOnly.length).toBe(1);
      expect(visionOnly[0].frontmatter.type).toBe("vision");
    });
  });

  describe("search", () => {
    it("finds documents by content", () => {
      repo.write("vision/V.md", {
        frontmatter: defaultFrontmatter("vision"),
        content: "# Alpha Vision\n\nWe want to dominate the market.",
      });
      repo.write("brand/B.md", {
        frontmatter: defaultFrontmatter("brand"),
        content: "# Brand\n\nOur brand is strong.",
      });

      const results = repo.search("market");
      expect(results.length).toBe(1);
      expect(results[0].path).toContain("V.md");
    });

    it("finds documents by tag", () => {
      const fm = { ...defaultFrontmatter("strategy"), tags: ["pricing", "mvp"] };
      repo.write("strategy/GTM.md", { frontmatter: fm, content: "# GTM" });

      const results = repo.search("pricing");
      expect(results.length).toBe(1);
    });
  });

  describe("bump", () => {
    it("bumps patch version", () => {
      repo.write("vision/V.md", {
        frontmatter: { ...defaultFrontmatter("vision"), version: "1.2.3" },
        content: "test",
      });
      const doc = repo.bump("vision/V.md", "patch");
      expect(doc.frontmatter.version).toBe("1.2.4");
    });

    it("bumps minor version", () => {
      repo.write("vision/V.md", {
        frontmatter: { ...defaultFrontmatter("vision"), version: "1.2.3" },
        content: "test",
      });
      const doc = repo.bump("vision/V.md", "minor");
      expect(doc.frontmatter.version).toBe("1.3.0");
    });

    it("bumps major version", () => {
      repo.write("vision/V.md", {
        frontmatter: { ...defaultFrontmatter("vision"), version: "1.2.3" },
        content: "test",
      });
      const doc = repo.bump("vision/V.md", "major");
      expect(doc.frontmatter.version).toBe("2.0.0");
    });
  });

  describe("validate", () => {
    it("passes for valid documents", () => {
      repo.write("vision/V.md", {
        frontmatter: defaultFrontmatter("vision"),
        content: "valid",
      });
      const result = repo.validate();
      expect(result.valid).toBe(true);
    });

    it("fails for missing required fields", () => {
      repo.write("vision/V.md", {
        frontmatter: { type: "vision", version: "", status: "draft", created: "", updated: "", updated_by: "", tags: [] },
        content: "invalid",
      });
      const result = repo.validate();
      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.field === "version")).toBe(true);
    });
  });

  describe("health", () => {
    it("detects stale documents", () => {
      repo.write("vision/OLD.md", {
        frontmatter: { ...defaultFrontmatter("vision"), updated: "2025-01-01", _skip_auto_update: true } as any,
        content: "old",
      });
      const report = repo.health();
      expect(report.stale_docs.length).toBe(1);
    });

    it("detects orphaned features", () => {
      const fm = { ...defaultFeatureFrontmatter(), feature_status: "planned" as const };
      repo.write("features/F-001.md", { frontmatter: fm, content: "# Feature" });
      const report = repo.health();
      expect(report.orphaned_features.length).toBe(1);
    });
  });

  describe("featureCreate", () => {
    it("creates a feature with discovery status", () => {
      const feature = repo.featureCreate("F-001", "Pricing Management", "Allow users to manage prices");
      expect(feature.frontmatter.type).toBe("feature");
      expect(feature.frontmatter.feature_status).toBe("discovery");
      expect(feature.content).toContain("Pricing Management");
    });
  });

  describe("featureBridgeTemplate", () => {
    it("generates a backlog epic template", () => {
      repo.featureCreate("F-001", "Pricing Management", "Manage prices");
      const template = repo.featureBridgeTemplate("F-001");
      expect(template).toContain("Pricing Management");
      expect(template).toContain("F-001");
      expect(template).toContain("Type: epic");
    });
  });

  describe("experimentCreate", () => {
    it("creates an experiment with hypothesis", () => {
      const exp = repo.experimentCreate(
        "X-001",
        "Adding social proof increases conversion by 20%",
        "F-001"
      );
      expect(exp.frontmatter.type).toBe("experiment");
      expect(exp.content).toContain("social proof");
    });
  });
});

// --- Lifecycle tests ---

describe("Lifecycle", () => {
  describe("canTransition", () => {
    it("allows valid forward transitions", () => {
      expect(canTransition("discovery", "defined")).toBe(true);
      expect(canTransition("defined", "validated")).toBe(true);
      expect(canTransition("validated", "planned")).toBe(true);
      expect(canTransition("planned", "building")).toBe(true);
      expect(canTransition("building", "shipped")).toBe(true);
      expect(canTransition("shipped", "measuring")).toBe(true);
    });

    it("allows valid backward transitions", () => {
      expect(canTransition("defined", "discovery")).toBe(true);
      expect(canTransition("validated", "defined")).toBe(true);
      expect(canTransition("building", "planned")).toBe(true);
    });

    it("rejects invalid transitions", () => {
      expect(canTransition("discovery", "shipped")).toBe(false);
      expect(canTransition("measuring", "discovery")).toBe(false);
      expect(canTransition("planned", "discovery")).toBe(false);
    });
  });

  describe("transitionFeature", () => {
    it("transitions feature and returns success", () => {
      repo.featureCreate("F-001", "Test", "desc");
      const result = transitionFeature(repo, "F-001", "defined");
      expect(result.success).toBe(true);
      expect(result.from).toBe("discovery");
      expect(result.to).toBe("defined");
    });

    it("rejects invalid transition", () => {
      repo.featureCreate("F-001", "Test", "desc");
      const result = transitionFeature(repo, "F-001", "shipped");
      expect(result.success).toBe(false);
      expect(result.error).toContain("Invalid transition");
    });

    it("prompts bridge on validated", () => {
      repo.featureCreate("F-001", "Test", "desc");
      transitionFeature(repo, "F-001", "defined");
      const result = transitionFeature(repo, "F-001", "validated");
      expect(result.bridge_prompt).toContain("Create backlog epic");
    });

    it("prompts experiment on shipped", () => {
      repo.featureCreate("F-001", "Test", "desc");
      transitionFeature(repo, "F-001", "defined");
      transitionFeature(repo, "F-001", "validated");
      transitionFeature(repo, "F-001", "planned");
      transitionFeature(repo, "F-001", "building");
      const result = transitionFeature(repo, "F-001", "shipped");
      expect(result.bridge_prompt).toContain("experiment");
    });
  });

  describe("linkEpic", () => {
    it("links feature to epic", () => {
      repo.featureCreate("F-001", "Test", "desc");
      linkEpic(repo, "F-001", "B-002");
      const feature = repo.featureRead("F-001");
      expect(feature.frontmatter.epic_id).toBe("B-002");
    });
  });

  describe("getLifecycleOverview", () => {
    it("groups features by status", () => {
      repo.featureCreate("F-001", "Feature One", "");
      repo.featureCreate("F-002", "Feature Two", "");
      transitionFeature(repo, "F-002", "defined");

      const overview = getLifecycleOverview(repo);
      expect(overview.discovery).toContain("F-001");
      expect(overview.defined).toContain("F-002");
    });
  });
});
