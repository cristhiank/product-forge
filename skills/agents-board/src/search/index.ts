/**
 * Agent Collaboration Board - Search Module
 */

// CK Hybrid Search
export {
    CKSearch,
    getCKSearch,
    resetCKSearch, type CKIndexStats, type CKSearchOptions,
    type CKSearchResult
} from "./ck-search.js";

// Graph Index
export {
    GraphIndex,
    getGraphIndex,
    resetGraphIndex, type GraphPath, type GraphQuery, type GraphStats
} from "./graph-index.js";

// Temporal Index
export {
    TemporalIndex,
    getTemporalIndex,
    resetTemporalIndex, type PhaseTimeline, type TemporalEntry, type TemporalQuery, type TemporalStats, type TimelineEntry
} from "./temporal-index.js";

// Unified Search
export {
    UnifiedSearch,
    getUnifiedSearch,
    resetUnifiedSearch, type SearchLayerResult, type UnifiedSearchQuery,
    type UnifiedSearchResponse
} from "./unified-search.js";

