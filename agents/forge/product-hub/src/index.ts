// Public API — re-export everything consumers need

export { ProductRepository } from "./repository.js";
export {
  transitionFeature,
  canTransition,
  linkEpic,
  getLifecycleOverview,
  type TransitionResult,
} from "./lifecycle.js";
export {
  type DocType,
  type DocStatus,
  type FeatureStatus,
  type ProductStage,
  type Frontmatter,
  type FeatureFrontmatter,
  type ExperimentFrontmatter,
  type ProductMeta,
  type Document,
  type FeatureDocument,
  type ValidationResult,
  type ValidationError,
  type HealthReport,
  type VersionEntry,
  REQUIRED_FIELDS,
  FEATURE_TRANSITIONS,
  TYPE_FOLDERS,
  defaultFrontmatter,
  defaultFeatureFrontmatter,
} from "./schema.js";
