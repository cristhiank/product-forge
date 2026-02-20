/**
 * Backlog Skill
 *
 * Main entry point exporting all public APIs.
 */

// Core types
export * from "./types.js";

// Storage layer
export { FileSystemBacklogStore } from "./storage/fs-store.js";
export { MultiRootBacklogStore } from "./storage/multi-root-store.js";
export { discoverProjects } from "./storage/project-discovery.js";
export type { BacklogStore, StoredItem } from "./storage/backlog-store.js";
export type { MultiRootStoredItem } from "./storage/multi-root-store.js";

// ID utilities
export { parseQualifiedId, toQualifiedId, isValidProjectName, isValidLocalId } from "./id-utils.js";
export type { QualifiedId } from "./id-utils.js";

// Markdown parsing
export { parseBacklogMarkdown } from "./markdown/parser.js";
export { formatBacklogItemTemplate } from "./markdown/templates.js";
export { validateBacklogItem } from "./markdown/validate.js";

// API
export { createBacklogAPI } from "./backlog-api.js";

// Sandbox
export { executeCode, createSandboxAPI, BACKLOG_API_HELP } from "./sandbox/index.js";
export type { ExecuteRequest, ExecuteResponse } from "./sandbox/index.js";

// Serve
export { startServer } from "./serve/server.js";
export type { ServeOptions } from "./serve/server.js";

// CLI entry
export { main } from "./skill-cli.js";
