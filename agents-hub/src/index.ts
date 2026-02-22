/**
 * Agents Hub - Real-time messaging and knowledge sharing for multi-agent systems
 * 
 * @packageDocumentation
 */

// Main API
export { Hub } from './hub.js';
export { HubSDK } from './sdk.js';

// SDK types
export type {
  SDKOptions,
  FindingOptions,
  SnippetOptions,
  DecisionOptions,
  RequestOptions,
  ProgressOptions,
  TrailOptions,
  QueryOptions,
} from './sdk.js';

// Core types
export type {
  Message,
  MessageType,
  PostOptions,
  ReplyOptions,
  UpdateOptions,
  ReadOptions,
  SearchOptions,
  SearchResult,
  WatchOptions,
  Channel,
  ChannelInfo,
  HubMeta,
  HubStatus,
  HubStats,
  Worker,
  WorkerStatus,
  WorkerEvent,
  RegisterWorkerOptions,
  WorkerSyncResult,
} from './core/types.js';

// Database utilities
export { openDatabase } from './db/connection.js';
export { initSchema } from './db/schema.js';

// Core modules
export {
  postMessage,
  replyToMessage,
  updateMessage,
  readMessages,
  readThread,
} from './core/messages.js';

export {
  createChannel,
  listChannels,
  ensureChannel,
} from './core/channels.js';

export { searchMessages } from './core/search.js';

// Watch module
export { watchMessages } from './core/watch.js';

// Maintenance module
export {
  getStatus,
  getStats,
  exportMessages,
  importMessages,
  garbageCollect,
} from './core/maintenance.js';

// Worker module
export {
  registerWorker,
  getWorker,
  listWorkers,
  updateWorker,
  removeWorker,
  discoverSession,
} from './core/workers.js';

// Reactor module
export {
  readNewEvents,
  processEvents,
  detectHealth,
  buildSyncResult,
} from './core/reactor.js';
