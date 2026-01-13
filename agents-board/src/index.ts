/**
 * Agent Collaboration Board
 *
 * Main entry point exporting all public APIs.
 */

// Core types
export * from "./types/index.js";

// Storage layer
export { BoardStorage } from "./storage/index.js";

// Direct index
export { DirectIndex } from "./index/index.js";
export type { DirectIndexFilters, IndexStats } from "./index/index.js";

// Search module
export {
    CKSearch,
    GraphIndex,
    TemporalIndex,
    UnifiedSearch,
    getUnifiedSearch,
    resetUnifiedSearch
} from "./search/index.js";
export type {
    CKSearchOptions,
    CKSearchResult, GraphPath, GraphQuery, TemporalEntry, TemporalQuery, UnifiedSearchQuery,
    UnifiedSearchResponse
} from "./search/index.js";

// Main Board class
export { Board } from "./board.js";

// Board Manager (multi-task support)
export {
    BoardManager,
    getBoardManager,
    resetBoardManager, type TaskCreateOptions, type TaskSummary
} from "./manager/index.js";

// MCP Server
export { createServer, main as startServer } from "./mcp/index.js";
