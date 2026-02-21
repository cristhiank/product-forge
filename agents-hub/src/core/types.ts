/**
 * Core TypeScript types for the Agents Hub
 */

export type MessageType = 'note' | 'decision' | 'request' | 'status';

/**
 * A message in the hub
 */
export interface Message {
  id: string;
  channel: string;
  type: MessageType;
  author: string;
  content: string;
  tags: string[];
  threadId: string | null;
  metadata: Record<string, unknown>;
  workerId: string | null;
  createdAt: string;
  updatedAt: string | null;
}

/**
 * Options for posting a new message
 */
export interface PostOptions {
  channel: string;
  type: MessageType;
  author: string;
  content: string;
  tags?: string[];
  metadata?: Record<string, unknown>;
  workerId?: string;
}

/**
 * Options for replying to an existing message
 */
export interface ReplyOptions {
  author: string;
  content: string;
  tags?: string[];
  metadata?: Record<string, unknown>;
  type?: MessageType; // Override parent type if needed
}

/**
 * Options for updating an existing message
 */
export interface UpdateOptions {
  content?: string;
  metadata?: Record<string, unknown>; // Merged, not replaced
  tags?: string[];
}

/**
 * Options for reading/querying messages
 */
export interface ReadOptions {
  channel?: string;
  type?: MessageType;
  author?: string;
  tags?: string[];
  since?: string; // ISO 8601 timestamp
  until?: string; // ISO 8601 timestamp
  limit?: number;
  offset?: number;
  threadId?: string;
  unresolved?: boolean; // For request-type messages
  workerId?: string;
}

/**
 * Options for searching messages (FTS5)
 */
export interface SearchOptions {
  channel?: string;
  type?: MessageType;
  tags?: string[];
  limit?: number;
  since?: string; // ISO 8601 timestamp
}

/**
 * Search result with ranking and highlighting
 */
export interface SearchResult extends Message {
  rank: number;
  highlightedContent?: string;
}

/**
 * Options for watching/polling for new messages
 */
export interface WatchOptions {
  channel?: string;
  type?: MessageType;
  timeout?: number; // Seconds (default 300, 0 = forever)
  count?: number; // Number of messages to wait for
}

/**
 * A channel in the hub
 */
export interface Channel {
  name: string;
  createdAt: string;
  createdBy: string;
  description: string | null;
  workerId: string | null;
}

/**
 * Channel information with statistics
 */
export interface ChannelInfo extends Channel {
  messageCount: number;
  lastActivity: string | null;
}

/**
 * Hub metadata
 */
export interface HubMeta {
  schemaVersion: string;
  createdAt: string;
  mode: 'single' | 'multi';
  hubId: string;
}

/**
 * Hub status overview
 */
export interface HubStatus {
  hubId: string;
  mode: 'single' | 'multi';
  channels: Record<string, {
    messages: number;
    unresolvedRequests: number;
  }>;
  totalMessages: number;
  totalUnresolved: number;
  recentActivity: Array<{
    channel: string;
    type: MessageType;
    timestamp: string;
  }>;
}

/**
 * Hub statistics
 */
export interface HubStats {
  dbSizeBytes: number;
  walSizeBytes: number;
  messagesByType: Record<MessageType, number>;
  messagesByChannel: Record<string, number>;
  totalMessages: number;
  ftsStatus: {
    indexed: number;
    unindexed: number;
  };
}
