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
  type: 'user_message' | 'assistant_message' | 'tool_lifecycle' | 'session_event' | 'error' | 'unknown';
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
    const toolNamesByCallId = new Map<string, string>();
    
    for (const event of events) {
      const data = event.data ?? {};
      const timestamp = event.timestamp;
      
      switch (event.type) {
        case 'user.message':
        case 'turn.user_message': {
          const content = toContent(data.message, data.content);
          if (!content) break;
          items.push({
            type: 'user_message',
            timestamp,
            content,
            data,
          });
          break;
        }

        case 'assistant.message':
        case 'turn.assistant_message': {
          const content = summarizeAssistantMessage(data);
          if (!content) break;
          items.push({
            type: 'assistant_message',
            timestamp,
            content,
            data,
          });
          break;
        }

        case 'tool.execution_start': {
          const toolCallId = toContent(data.toolCallId, data.tool_call_id);
          const toolName = toContent(data.toolName, data.tool_name, asRecord(data.tool)?.name, data.tool, 'unknown');
          if (toolCallId && toolName) toolNamesByCallId.set(toolCallId, toolName);
          items.push({
            type: 'tool_lifecycle',
            timestamp,
            content: `start: ${toolName}${toolCallId ? ` (${toolCallId})` : ''}`,
            data,
          });
          break;
        }

        case 'tool.execution_complete': {
          const toolCallId = toContent(data.toolCallId, data.tool_call_id);
          const resolvedName = (toolCallId && toolNamesByCallId.get(toolCallId))
            ?? toContent(data.toolName, data.tool_name, asRecord(data.tool)?.name, data.tool, 'unknown');
          const status = data.success === false ? 'failed' : 'completed';
          const detail = summarizeToolResult(data);
          items.push({
            type: 'tool_lifecycle',
            timestamp,
            content: `${status}: ${resolvedName}${detail ? ` — ${detail}` : ''}${toolCallId ? ` (${toolCallId})` : ''}`,
            data,
          });
          break;
        }

        case 'tool.error': {
          const toolCallId = toContent(data.toolCallId, data.tool_call_id);
          const resolvedName = (toolCallId && toolNamesByCallId.get(toolCallId))
            ?? toContent(data.toolName, data.tool_name, asRecord(data.tool)?.name, data.tool, 'unknown');
          const detail = toContent(data.message, data.error, asRecord(data.result)?.error, asRecord(data.result)?.message, 'Tool error');
          items.push({
            type: 'error',
            timestamp,
            content: `${resolvedName}: ${truncateText(detail, 220)}`,
            data,
          });
          break;
        }

        case 'session.start':
        case 'session.model_change':
        case 'session.mode_changed':
        case 'session.compaction_start':
        case 'session.compaction_complete':
        case 'session.plan_changed':
        case 'subagent.started':
        case 'subagent.completed':
        case 'skill.invoked':
          items.push({
            type: 'session_event',
            timestamp,
            content: summarizeSessionEvent(event.type, data),
            data,
          });
          break;

        case 'session.error':
          items.push({
            type: 'error',
            timestamp,
            content: String(data.message ?? data.error ?? 'Unknown error'),
            data,
          });
          break;

        default: {
          if (
            event.type === 'assistant.turn_start' ||
            event.type === 'assistant.turn_end' ||
            event.type === 'turn.start' ||
            event.type === 'turn.end'
          ) {
            break;
          }
          items.push({
            type: 'unknown',
            timestamp,
            content: event.type,
            data,
          });
        }
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
    const extracted = extractString(value);
    if (extracted) return extracted;
  }
  return '';
}

function extractString(value: unknown, depth = 0): string {
  if (depth > 3 || value === null || value === undefined) return '';
  if (typeof value === 'string') {
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : '';
  }
  if (Array.isArray(value)) {
    for (const item of value) {
      const extracted = extractString(item, depth + 1);
      if (extracted) return extracted;
    }
    return '';
  }
  if (typeof value === 'object') {
    const record = value as Record<string, unknown>;
    const candidates = [record.content, record.text, record.message, record.value, record.summary];
    for (const candidate of candidates) {
      const extracted = extractString(candidate, depth + 1);
      if (extracted) return extracted;
    }
  }
  return '';
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== 'object') return null;
  return value as Record<string, unknown>;
}

function truncateText(value: string, max = 160): string {
  const normalized = value.replace(/\s+/g, ' ').trim();
  if (normalized.length <= max) return normalized;
  return `${normalized.slice(0, max - 3)}...`;
}

function summarizeAssistantMessage(data: Record<string, unknown>): string {
  const content = toContent(data.message, data.content);
  if (content) return content;

  const reasoning = toContent(data.reasoningText, data.reasoning);
  const toolRequests = Array.isArray(data.toolRequests) ? data.toolRequests : [];
  const toolNames = Array.from(new Set(
    toolRequests
      .map((item) => (typeof item === 'object' && item ? toContent((item as Record<string, unknown>).name) : ''))
      .filter(Boolean),
  ));
  const toolsSummary = toolNames.length > 0 ? `Tool requests: ${toolNames.join(', ')}` : '';

  if (reasoning && toolsSummary) return `${truncateText(reasoning, 180)}\n${toolsSummary}`;
  if (reasoning) return truncateText(reasoning, 220);
  if (toolsSummary) return toolsSummary;
  return '(assistant content is encrypted in telemetry)';
}

function summarizeToolResult(data: Record<string, unknown>): string {
  if (data.success === false) {
    return truncateText(toContent(data.error, asRecord(data.result)?.error, asRecord(data.result)?.message, 'error'), 220);
  }
  const result = asRecord(data.result);
  const content = toContent(result?.content, result?.message, result?.detailedContent);
  if (!content) return '';
  return truncateText(content, 220);
}

function summarizeSessionEvent(type: string, data: Record<string, unknown>): string {
  switch (type) {
    case 'session.start': {
      const context = asRecord(data.context);
      const branch = toContent(context?.branch);
      const repository = toContent(context?.repository);
      const details = [branch && `branch ${branch}`, repository && repository].filter(Boolean);
      return details.length > 0 ? `session started (${details.join(' · ')})` : 'session started';
    }
    case 'session.model_change': {
      const next = toContent(data.newModel, data.selectedModel, data.model, 'unknown');
      const previous = toContent(data.previousModel);
      return previous ? `model changed ${previous} -> ${next}` : `model selected ${next}`;
    }
    case 'session.mode_changed': {
      const previous = toContent(data.previousMode, 'unknown');
      const next = toContent(data.newMode, 'unknown');
      return `mode changed ${previous} -> ${next}`;
    }
    case 'session.compaction_start':
      return 'compaction started';
    case 'session.compaction_complete':
      return 'compaction completed';
    case 'session.plan_changed':
      return 'plan changed';
    case 'subagent.started':
      return `subagent started: ${toContent(data.agentName, 'unknown')}`;
    case 'subagent.completed':
      return `subagent completed: ${toContent(data.agentName, 'unknown')}`;
    case 'skill.invoked':
      return `skill invoked: ${toContent(data.name, 'unknown')}`;
    default:
      return type;
  }
}
