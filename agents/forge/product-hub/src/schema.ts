// Product document types and schemas

export type DocType =
  | "vision"
  | "customer"
  | "brand"
  | "feature"
  | "strategy"
  | "experiment"
  | "playbook";

export type DocStatus = "draft" | "active" | "validated" | "archived";

export type FeatureStatus =
  | "discovery"
  | "defined"
  | "validated"
  | "planned"
  | "building"
  | "shipped"
  | "measuring";

export type ProductStage = "idea" | "mvp" | "growth" | "scale";

export interface Frontmatter {
  type: DocType;
  version: string;
  status: DocStatus;
  created: string;
  updated: string;
  updated_by: string;
  tags: string[];
  [key: string]: unknown;
}

export interface FeatureFrontmatter extends Frontmatter {
  type: "feature";
  feature_status: FeatureStatus;
  epic_id?: string; // linked backlog epic
}

export interface ExperimentFrontmatter extends Frontmatter {
  type: "experiment";
  hypothesis: string;
  feature_id?: string;
  result?: "confirmed" | "rejected" | "inconclusive";
  metrics?: Record<string, string>;
}

export interface ProductMeta {
  name: string;
  stage: ProductStage;
  version: string;
  description: string;
  north_star: string;
  created: string;
}

export interface Document {
  path: string;
  frontmatter: Frontmatter;
  content: string;
}

export interface FeatureDocument extends Document {
  frontmatter: FeatureFrontmatter;
}

export interface ValidationError {
  path: string;
  field: string;
  message: string;
}

export interface ValidationResult {
  valid: boolean;
  errors: ValidationError[];
}

export interface HealthReport {
  total_docs: number;
  stale_docs: string[]; // not updated in 30+ days
  missing_required: ValidationError[];
  orphaned_features: string[]; // features with no epic
  draft_count: number;
  active_count: number;
}

export interface VersionEntry {
  version: string;
  date: string;
  updated_by: string;
}

// Required fields per document type
export const REQUIRED_FIELDS: Record<DocType, string[]> = {
  vision: ["type", "version", "status"],
  customer: ["type", "version", "status"],
  brand: ["type", "version", "status"],
  feature: ["type", "version", "status", "feature_status"],
  strategy: ["type", "version", "status"],
  experiment: ["type", "version", "status", "hypothesis"],
  playbook: ["type", "version", "status"],
};

// Valid feature status transitions
export const FEATURE_TRANSITIONS: Record<FeatureStatus, FeatureStatus[]> = {
  discovery: ["defined"],
  defined: ["validated", "discovery"], // can go back
  validated: ["planned", "defined"],
  planned: ["building"],
  building: ["shipped", "planned"], // can go back if blocked
  shipped: ["measuring"],
  measuring: [], // terminal
};

// Folder mapping for document types
export const TYPE_FOLDERS: Record<DocType, string> = {
  vision: "vision",
  customer: "customers",
  brand: "brand",
  feature: "features",
  strategy: "strategy",
  experiment: "experiments",
  playbook: "playbooks",
};

// Default frontmatter template
export function defaultFrontmatter(type: DocType): Frontmatter {
  const now = new Date().toISOString().split("T")[0];
  return {
    type,
    version: "0.1.0",
    status: "draft",
    created: now,
    updated: now,
    updated_by: "forge-product",
    tags: [],
  };
}

export function defaultFeatureFrontmatter(): FeatureFrontmatter {
  return {
    ...defaultFrontmatter("feature"),
    type: "feature",
    feature_status: "discovery",
  } as FeatureFrontmatter;
}
