/**
 * Telemetry abstraction for different agent types.
 * Currently supports: copilot (Copilot CLI events.jsonl format)
 */

import { closeSync, existsSync, openSync, readSync, statSync } from 'node:fs';
import type { WorkerEvent } from './types.js';

export type TelemetryView = 'raw' | 'conversation';

export interface PaginatedEventsResult {
  events: WorkerEvent[];
  cursor: string | null; // Cursor for older page
  hasMore: boolean;
  count: number;
  totalLines: number | null;
  error: string | null;
}

export interface ConversationItem {
  type: 'user_message' | 'assistant_message' | 'tool_lifecycle' | 'error' | 'unknown';
  timestamp: string;
  content: string;
  data?: Record<string, unknown>;
}

/**
 * Telemetry reader abstraction
 */
export interface TelemetryReader {
  /**
   * Read events with pagination support
   */
  readEvents(eventsPath: string, cursor: string | null, limit: number): PaginatedEventsResult;

  /**
   * Convert raw events to conversation-friendly items
   */
  toConversation(events: WorkerEvent[]): ConversationItem[];
}

/**
 * Copilot CLI telemetry reader
 */
class CopilotTelemetryReader implements TelemetryReader {
  readEvents(eventsPath: string, cursor: string | null, limit: number): PaginatedEventsResult {
    if (!existsSync(eventsPath)) {
      return {
        events: [],
        cursor: null,
        hasMore: false,
        count: 0,
        totalLines: null,
        error: 'Events file not found',
      };
    }

    const fileSize = statSync(eventsPath).size;
    const end = parseCursor(cursor, fileSize);
    if (end <= 0) {
      return {
        events: [],
        cursor: null,
        hasMore: false,
        count: 0,
        totalLines: null,
        error: null,
      };
    }

    const boundedLimit = Math.max(1, Math.min(limit, 500));
    const { selectedLines, nextCursor } = readPageLines(eventsPath, end, boundedLimit, fileSize);
    const events: WorkerEvent[] = [];
    for (const line of selectedLines) {
      try {
        const parsed = JSON.parse(line) as Partial<WorkerEvent>;
        events.push({
          type: parsed.type ?? '',
          data: parsed.data ?? {},
          id: parsed.id ?? '',
          timestamp: parsed.timestamp ?? '',
          parentId: parsed.parentId ?? null,
        });
      } catch {
        // Skip malformed lines.
      }
    }

    return {
      events,
      cursor: nextCursor,
      hasMore: nextCursor !== null,
      count: events.length,
      totalLines: null,
      error: null,
    };
  }

  toConversation(events: WorkerEvent[]): ConversationItem[] {
    const items: ConversationItem[] = [];
    
    for (const event of events) {
      const timestamp = event.timestamp;
      
      switch (event.type) {
        case 'user.message':
        case 'turn.user_message':
          items.push({
            type: 'user_message',
            timestamp,
            content: toContent(event.data.message, event.data.content),
            data: event.data,
          });
          break;

        case 'assistant.message':
        case 'turn.assistant_message':
          items.push({
            type: 'assistant_message',
            timestamp,
            content: toContent(event.data.message, event.data.content),
            data: event.data,
          });
          break;

        case 'tool.execution_start':
        case 'tool.execution_complete':
        case 'tool.error':
          items.push({
            type: 'tool_lifecycle',
            timestamp,
            content: `${event.type}: ${toContent(event.data.toolName, event.data.tool_name, event.data.tool, 'unknown')}`,
            data: event.data,
          });
          break;

        case 'session.error':
          items.push({
            type: 'error',
            timestamp,
            content: String(event.data.message ?? event.data.error ?? 'Unknown error'),
            data: event.data,
          });
          break;

        default:
          items.push({
            type: 'unknown',
            timestamp,
            content: event.type,
            data: event.data,
          });
      }
    }
    
    return items;
  }
}

/**
 * Get telemetry reader using the telemetry source path, not role/agent labels.
 */
export function getTelemetryReader(eventsPath: string | null): TelemetryReader | null {
  if (!eventsPath) return null;
  if (isCopilotSessionEventsPath(eventsPath)) return new CopilotTelemetryReader();
  return null;
}

function isCopilotSessionEventsPath(eventsPath: string): boolean {
  const normalizedPath = eventsPath.replace(/\\/g, '/');
  return normalizedPath.includes('/.copilot/session-state/') && normalizedPath.endsWith('/events.jsonl');
}

function parseCursor(cursor: string | null, fileSize: number): number {
  if (!cursor) return fileSize;
  const match = cursor.match(/^byte:(\d+)$/);
  if (!match) return fileSize;
  const parsed = parseInt(match[1], 10);
  if (Number.isNaN(parsed)) return fileSize;
  return Math.max(0, Math.min(parsed, fileSize));
}

function readPageLines(
  eventsPath: string,
  end: number,
  limit: number,
  fileSize: number,
): { selectedLines: string[]; nextCursor: string | null } {
  const fd = openSync(eventsPath, 'r');
  const chunkSize = 64 * 1024;
  let start = end;
  let text = '';

  try {
    while (start > 0) {
      const readLen = Math.min(chunkSize, start);
      start -= readLen;
      const chunk = Buffer.alloc(readLen);
      readSync(fd, chunk, 0, readLen, start);
      text = chunk.toString('utf-8') + text;

      const parts = text.split('\n');
      const completeLines = (start > 0 ? parts.slice(1) : parts).filter(line => line.trim().length > 0);
      if (completeLines.length >= limit + 1 || start === 0) break;
    }
  } finally {
    closeSync(fd);
  }

  let parts = text.split('\n');
  if (start > 0) {
    parts = parts.slice(1);
  }
  if (end === fileSize && !text.endsWith('\n') && parts.length > 0) {
    parts.pop();
  }
  if (parts.length > 0 && parts[parts.length - 1] === '') {
    parts.pop();
  }

  const selectedLinesReversed: string[] = [];
  let bytesFromEnd = 0;
  for (let i = parts.length - 1; i >= 0; i -= 1) {
    const line = parts[i];
    bytesFromEnd += Buffer.byteLength(`${line}\n`, 'utf-8');
    if (!line.trim()) continue;
    selectedLinesReversed.push(line);
    if (selectedLinesReversed.length >= limit) break;
  }

  const selectedLines = selectedLinesReversed.reverse();
  const selectedStart = Math.max(0, end - bytesFromEnd);
  return {
    selectedLines,
    nextCursor: selectedStart > 0 ? `byte:${selectedStart}` : null,
  };
}

function toContent(...values: unknown[]): string {
  for (const value of values) {
    if (typeof value === 'string' && value.trim().length > 0) return value;
  }
  return '';
}
