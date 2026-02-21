/**
 * Agents Hub - Real-time messaging and knowledge sharing for multi-agent systems
 * 
 * @packageDocumentation
 */

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
} from './core/types.js';

// Database utilities
export { openDatabase } from './db/connection.js';
export { initSchema } from './db/schema.js';
