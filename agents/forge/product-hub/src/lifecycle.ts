// Feature lifecycle state machine

import {
  type FeatureStatus,
  type FeatureDocument,
  type FeatureFrontmatter,
  FEATURE_TRANSITIONS,
} from "./schema.js";
import { ProductRepository } from "./repository.js";

export interface TransitionResult {
  success: boolean;
  from: FeatureStatus;
  to: FeatureStatus;
  error?: string;
  bridge_prompt?: string; // auto-bridge message when reaching certain states
}

export function canTransition(
  from: FeatureStatus,
  to: FeatureStatus
): boolean {
  return FEATURE_TRANSITIONS[from]?.includes(to) ?? false;
}

export function transitionFeature(
  repo: ProductRepository,
  featureId: string,
  to: FeatureStatus
): TransitionResult {
  const feature = repo.featureRead(featureId);
  const from = feature.frontmatter.feature_status;

  if (!canTransition(from, to)) {
    return {
      success: false,
      from,
      to,
      error: `Invalid transition: ${from} → ${to}. Valid targets: ${FEATURE_TRANSITIONS[from].join(", ") || "none"}`,
    };
  }

  // Update feature status
  const updatedFm: FeatureFrontmatter = {
    ...feature.frontmatter,
    feature_status: to,
  };

  // Update document status to match lifecycle phase
  if (to === "validated" || to === "shipped") {
    updatedFm.status = "validated";
  } else if (to === "measuring") {
    updatedFm.status = "active";
  }

  repo.write(feature.path, {
    frontmatter: updatedFm,
    content: feature.content,
  });

  // Build result with auto-bridge prompts
  const result: TransitionResult = { success: true, from, to };

  if (to === "validated") {
    result.bridge_prompt = `Feature ${featureId} is validated. Create backlog epic from this spec?`;
  } else if (to === "planned") {
    if (!feature.frontmatter.epic_id) {
      result.bridge_prompt = `Feature ${featureId} is planned but has no linked epic. Create one?`;
    }
  } else if (to === "shipped") {
    result.bridge_prompt = `Feature ${featureId} shipped! Create an experiment to measure impact?`;
  }

  return result;
}

export function linkEpic(
  repo: ProductRepository,
  featureId: string,
  epicId: string
): void {
  const feature = repo.featureRead(featureId);
  const updatedFm: FeatureFrontmatter = {
    ...feature.frontmatter,
    epic_id: epicId,
  };
  repo.write(feature.path, {
    frontmatter: updatedFm,
    content: feature.content,
  });
}

export function getLifecycleOverview(
  repo: ProductRepository
): Record<FeatureStatus, string[]> {
  const overview: Record<FeatureStatus, string[]> = {
    discovery: [],
    defined: [],
    validated: [],
    planned: [],
    building: [],
    shipped: [],
    measuring: [],
  };

  const features = repo.featureList();
  for (const f of features) {
    const id = f.path.replace("features/", "").replace(".md", "");
    overview[f.frontmatter.feature_status].push(id);
  }

  return overview;
}
