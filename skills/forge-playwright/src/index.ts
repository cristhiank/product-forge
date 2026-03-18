/**
 * Public API exports for forge-playwright skill.
 */

export { discoverProject, hasProjectDir, PROJECT_DIR_NAME } from "./discovery.js";
export { listProfiles, loadProfile, renderProfileToolCalls, sortRoutesForLIFO } from "./profiles.js";
export { recommendConfig, validateConfig, formatConfigJSON } from "./config.js";
export { scaffoldProject } from "./project-scaffold.js";
export { listInitPages, loadInitPage, generateInitPageFromProfile } from "./init-pages.js";
export { executeCode } from "./sandbox.js";
export type {
  ProjectConfig,
  Profile,
  Route,
  InitPageInfo,
  MCPConfigRecommendation,
  ExecRequest,
  ExecResponse,
} from "./types.js";
