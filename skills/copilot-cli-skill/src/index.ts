/**
 * Copilot CLI Worker Management - Programmatic API
 *
 * @packageDocumentation
 */

// Main classes
export { WorkerManager } from './workers.js';
export { WorkerSDK } from './sdk.js';

// Extracted modules (Phase 1-2)
export { WorktreeManager } from './worktree.js';
export { StateStore } from './state.js';
export { SessionRunner } from './session.js';
export { applyContext } from './context.js';

// Core types
export type {
  SpawnOptions,
  WorkerInfo,
  WorkerStatus,
  CleanupResult,
  WorkerMeta,
  SymlinkSpec,
  WorkerContextProvider,
  ContextProviderResult,
  WorkerHooks,
  WorkerTool,
  ErrorPolicy,
  WorkerEvent,
  WorkerHistory,
  ToolCallSummary,
  CommitSummary,
  AwaitOptions,
  ValidateWorkerOptions,
  ValidationResult,
} from './types.js';

// SDK options
export type { WorkerSDKOptions } from './sdk.js';

// Module-specific types
export type { ExitData } from './state.js';
export type { SessionInfo } from './session.js';
export type {
  WorktreeCreateOptions,
  WorktreeCreateResult,
  WorktreeRemoveResult,
} from './worktree.js';
