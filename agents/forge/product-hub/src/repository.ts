// Product repository — CRUD operations for .product/ documents

import * as fs from "node:fs";
import * as path from "node:path";
import matter from "gray-matter";
import yaml from "yaml";
import {
  type Document,
  type DocType,
  type Frontmatter,
  type FeatureDocument,
  type FeatureFrontmatter,
  type ProductMeta,
  type ValidationResult,
  type ValidationError,
  type HealthReport,
  type VersionEntry,
  REQUIRED_FIELDS,
  TYPE_FOLDERS,
  defaultFrontmatter,
  defaultFeatureFrontmatter,
} from "./schema.js";

const PRODUCT_DIR = ".product";
const META_FILE = "_meta.yaml";

export class ProductRepository {
  private root: string;

  constructor(projectRoot: string) {
    this.root = path.join(projectRoot, PRODUCT_DIR);
  }

  get productDir(): string {
    return this.root;
  }

  // --- Init ---

  init(meta: ProductMeta): void {
    const dirs = [
      "vision",
      "customers",
      "brand",
      "features",
      "strategy",
      "experiments",
      "playbooks",
    ];

    for (const dir of dirs) {
      fs.mkdirSync(path.join(this.root, dir), { recursive: true });
    }

    fs.writeFileSync(
      path.join(this.root, META_FILE),
      yaml.stringify(meta),
      "utf-8"
    );
  }

  exists(): boolean {
    return fs.existsSync(path.join(this.root, META_FILE));
  }

  // --- Meta ---

  readMeta(): ProductMeta {
    const raw = fs.readFileSync(
      path.join(this.root, META_FILE),
      "utf-8"
    );
    return yaml.parse(raw) as ProductMeta;
  }

  writeMeta(meta: ProductMeta): void {
    fs.writeFileSync(
      path.join(this.root, META_FILE),
      yaml.stringify(meta),
      "utf-8"
    );
  }

  // --- Document CRUD ---

  read(relativePath: string): Document {
    const fullPath = path.join(this.root, relativePath);
    if (!fs.existsSync(fullPath)) {
      throw new Error(`Document not found: ${relativePath}`);
    }
    const raw = fs.readFileSync(fullPath, "utf-8");
    const parsed = matter(raw);
    return {
      path: relativePath,
      frontmatter: parsed.data as Frontmatter,
      content: parsed.content.trim(),
    };
  }

  write(relativePath: string, doc: Omit<Document, "path">): void {
    const fullPath = path.join(this.root, relativePath);
    fs.mkdirSync(path.dirname(fullPath), { recursive: true });

    // Auto-update timestamps unless caller explicitly set _skip_auto_update
    const fm = { ...doc.frontmatter };
    if (!(fm as any)._skip_auto_update) {
      fm.updated = new Date().toISOString().split("T")[0];
      fm.updated_by = "forge-product";
    }
    delete (fm as any)._skip_auto_update;

    const output = matter.stringify(doc.content, fm);
    fs.writeFileSync(fullPath, output, "utf-8");
  }

  delete(relativePath: string): void {
    const fullPath = path.join(this.root, relativePath);
    if (fs.existsSync(fullPath)) {
      fs.unlinkSync(fullPath);
    }
  }

  list(type?: DocType): Document[] {
    const docs: Document[] = [];
    const targetDirs = type
      ? [TYPE_FOLDERS[type]]
      : Object.values(TYPE_FOLDERS);

    for (const dir of targetDirs) {
      const dirPath = path.join(this.root, dir);
      if (!fs.existsSync(dirPath)) continue;

      const files = fs.readdirSync(dirPath).filter((f) => f.endsWith(".md"));
      for (const file of files) {
        try {
          docs.push(this.read(path.join(dir, file)));
        } catch {
          // Skip unparseable files
        }
      }
    }
    return docs;
  }

  search(query: string): Document[] {
    const all = this.list();
    const q = query.toLowerCase();
    return all.filter(
      (doc) =>
        doc.content.toLowerCase().includes(q) ||
        doc.frontmatter.tags?.some((t) => t.toLowerCase().includes(q)) ||
        doc.path.toLowerCase().includes(q)
    );
  }

  // --- Feature operations ---

  featureCreate(id: string, title: string, description: string): FeatureDocument {
    const fm = defaultFeatureFrontmatter();
    fm.tags = [];
    const content = `# ${title}\n\n${description}\n`;
    const relativePath = `features/${id}.md`;
    this.write(relativePath, { frontmatter: fm, content });
    return { path: relativePath, frontmatter: fm, content };
  }

  featureRead(id: string): FeatureDocument {
    const doc = this.read(`features/${id}.md`);
    return doc as FeatureDocument;
  }

  featureList(status?: string): FeatureDocument[] {
    const features = this.list("feature") as FeatureDocument[];
    if (!status) return features;
    return features.filter((f) => f.frontmatter.feature_status === status);
  }

  // --- Experiment operations ---

  experimentCreate(
    id: string,
    hypothesis: string,
    featureId?: string
  ): Document {
    const fm: Record<string, unknown> = {
      ...defaultFrontmatter("experiment"),
      hypothesis,
    };
    if (featureId) fm.feature_id = featureId;
    const content = `# Experiment ${id}\n\n**Hypothesis:** ${hypothesis}\n\n## Design\n\n## Results\n\n## Conclusion\n`;
    const relativePath = `experiments/${id}.md`;
    this.write(relativePath, { frontmatter: fm as unknown as Frontmatter, content });
    return { path: relativePath, frontmatter: fm as Frontmatter, content };
  }

  // --- Versioning ---

  bump(relativePath: string, change: "major" | "minor" | "patch"): Document {
    const doc = this.read(relativePath);
    const [major, minor, patch] = doc.frontmatter.version
      .split(".")
      .map(Number);

    let newVersion: string;
    switch (change) {
      case "major":
        newVersion = `${major + 1}.0.0`;
        break;
      case "minor":
        newVersion = `${major}.${minor + 1}.0`;
        break;
      case "patch":
        newVersion = `${major}.${minor}.${patch + 1}`;
        break;
    }

    doc.frontmatter.version = newVersion;
    this.write(relativePath, doc);
    return this.read(relativePath);
  }

  // --- Validation ---

  validate(): ValidationResult {
    const errors: ValidationError[] = [];
    const docs = this.list();

    for (const doc of docs) {
      const required = REQUIRED_FIELDS[doc.frontmatter.type];
      if (!required) {
        errors.push({
          path: doc.path,
          field: "type",
          message: `Unknown document type: ${doc.frontmatter.type}`,
        });
        continue;
      }

      for (const field of required) {
        if (
          doc.frontmatter[field] === undefined ||
          doc.frontmatter[field] === null ||
          doc.frontmatter[field] === ""
        ) {
          errors.push({
            path: doc.path,
            field,
            message: `Missing required field: ${field}`,
          });
        }
      }
    }

    return { valid: errors.length === 0, errors };
  }

  // --- Health ---

  health(): HealthReport {
    const docs = this.list();
    const now = new Date();
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

    const staleDocs: string[] = [];
    const features = docs.filter((d) => d.frontmatter.type === "feature") as FeatureDocument[];
    const orphaned: string[] = [];
    let draftCount = 0;
    let activeCount = 0;

    for (const doc of docs) {
      const updated = new Date(doc.frontmatter.updated);
      if (updated < thirtyDaysAgo) {
        staleDocs.push(doc.path);
      }
      if (doc.frontmatter.status === "draft") draftCount++;
      if (doc.frontmatter.status === "active") activeCount++;
    }

    for (const f of features) {
      if (
        ["planned", "building", "shipped"].includes(f.frontmatter.feature_status) &&
        !f.frontmatter.epic_id
      ) {
        orphaned.push(f.path);
      }
    }

    const validation = this.validate();

    return {
      total_docs: docs.length,
      stale_docs: staleDocs,
      missing_required: validation.errors,
      orphaned_features: orphaned,
      draft_count: draftCount,
      active_count: activeCount,
    };
  }

  // --- Bridge ---

  featureBridgeTemplate(id: string): string {
    const feature = this.featureRead(id);
    const title = feature.content.match(/^#\s+(.+)/m)?.[1] || id;
    return `---
Title: ${title}
Type: epic
Priority: medium
Status: Not Started
Tags: feature-bridge, ${id}
Feature: ${id}
---

# ${title}

> Auto-generated from product feature ${id}

## Source Feature
- Path: .product/features/${id}.md
- Status: ${feature.frontmatter.feature_status}
- Version: ${feature.frontmatter.version}

## Scope

[Derived from feature spec — fill in implementation scope]

## Children

[Break down into user stories]
`;
  }
}
