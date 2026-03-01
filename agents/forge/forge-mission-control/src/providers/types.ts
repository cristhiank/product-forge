// Re-export what each provider returns so the rest of the app doesn't import skill internals

export interface ProductDoc {
  path: string;
  type: string;
  title: string; // extracted from first # heading in content
  version: string;
  status: string;
  tags: string[];
  created: string;
  updated: string;
  content: string; // raw markdown body (no frontmatter)
}

export interface ProductMeta {
  name: string;
  stage: string;
  version: string;
  description: string;
  north_star: string;
  created: string;
}

export interface ProductFeature {
  path: string;
  title: string;
  featureStatus: string;
  epicId?: string;
  version: string;
  tags: string[];
}

export interface ProductHealth {
  total_docs: number;
  stale_docs: string[];
  orphaned_features: string[];
  draft_count: number;
  active_count: number;
}

export interface FeatureOverview {
  discovery: string[];
  defined: string[];
  validated: string[];
  planned: string[];
  building: string[];
  shipped: string[];
  measuring: string[];
}
