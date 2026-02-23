import { existsSync, statSync, openSync, readSync, closeSync } from 'node:fs';
import type { WorkerEvent, WorkerSyncResult, WorkerStatus } from './types.js';

/** Read new events from an events.jsonl file starting from byte offset.
 *  Returns parsed events and the new byte offset for next read.
 */
export function readNewEvents(
  eventsPath: string,
  fromOffset_: number = 0,
): { events: WorkerEvent[]; newOffset: number; parseErrors: number; fileMissing: boolean } {
  let fromOffset = fromOffset_;
  if (!existsSync(eventsPath)) return { events: [], newOffset: fromOffset, parseErrors: 0, fileMissing: true };
  
  const stat = statSync(eventsPath);
  // File truncated (e.g., rotated/replaced) — reset to beginning
  if (stat.size < fromOffset) fromOffset = 0;
  if (stat.size <= fromOffset) return { events: [], newOffset: fromOffset, parseErrors: 0, fileMissing: false };
  
  // Read only the new bytes
  const bytesToRead = stat.size - fromOffset;
  const buffer = Buffer.alloc(bytesToRead);
  const fd = openSync(eventsPath, 'r');
  try {
    readSync(fd, buffer, 0, bytesToRead, fromOffset);
  } finally {
    closeSync(fd);
  }
  
  const text = buffer.toString('utf-8');
  // Only process up to the last complete newline to avoid losing partial writes
  const lastNewline = text.lastIndexOf('\n');
  if (lastNewline === -1) {
    // No complete lines yet — don't advance offset
    return { events: [], newOffset: fromOffset, parseErrors: 0, fileMissing: false };
  }
  const completeText = text.substring(0, lastNewline + 1);
  const newOffset = fromOffset + Buffer.byteLength(completeText, 'utf-8');

  const lines = completeText.split('\n').filter(l => l.trim().length > 0);
  const events: WorkerEvent[] = [];
  let parseErrors = 0;
  
  for (const line of lines) {
    try {
      const parsed = JSON.parse(line);
      events.push({
        type: parsed.type ?? '',
        data: parsed.data ?? {},
        id: parsed.id ?? '',
        timestamp: parsed.timestamp ?? '',
        parentId: parsed.parentId ?? null,
      });
    } catch {
      // Skip malformed lines (could be partial writes)
      parseErrors++;
    }
  }
  
  return { events, newOffset, parseErrors, fileMissing: false };
}

/** Process events and extract counters and significant events */
export function processEvents(events: WorkerEvent[]): {
  toolCalls: number;
  turns: number;
  errors: number;
  lastEventAt: string | null;
  lastEventType: string | null;
  /** Session ended? If so, what status? */
  terminalStatus: WorkerStatus | null;
  exitCode: number | null;
  significantEvents: Array<{ type: string; timestamp: string; summary: string }>;
} {
  let toolCalls = 0;
  let turns = 0;
  let errors = 0;
  let lastEventAt: string | null = null;
  let lastEventType: string | null = null;
  let terminalStatus: WorkerStatus | null = null;
  let exitCode: number | null = null;
  const significantEvents: Array<{ type: string; timestamp: string; summary: string }> = [];
  const asNonEmptyString = (value: unknown): string | null =>
    typeof value === 'string' && value.trim().length > 0 ? value.trim() : null;
  const summarizeMessage = (value: unknown): string => {
    const content = asNonEmptyString(value);
    if (!content) return 'no content';
    return content.length > 80 ? `${content.substring(0, 80)}...` : content;
  };

  for (const event of events) {
    // Update last activity
    if (event.timestamp) {
      lastEventAt = event.timestamp;
      lastEventType = event.type;
    }

    switch (event.type) {
      case 'tool.execution_start': {
        const toolName = asNonEmptyString(event.data.toolName) ?? 'unknown';
        significantEvents.push({
          type: 'tool_start',
          timestamp: event.timestamp,
          summary: `Tool ${toolName} started`,
        });
        break;
      }

      case 'tool.execution_complete':
        toolCalls++;
        if (event.data.success === false) {
          errors++;
          const toolName = (event.data.toolName as string) ?? 'unknown';
          significantEvents.push({
            type: 'tool_error',
            timestamp: event.timestamp,
            summary: `Tool ${toolName} failed`,
          });
        }
        break;

      case 'assistant.turn_end':
        turns++;
        break;

      case 'assistant.turn_start': {
        const turnId = asNonEmptyString(event.data.turnId) ?? 'unknown';
        significantEvents.push({
          type: 'turn_start',
          timestamp: event.timestamp,
          summary: `Assistant turn started: ${turnId}`,
        });
        break;
      }

      case 'assistant.message': {
        const toolRequests = Array.isArray(event.data.toolRequests) ? event.data.toolRequests.length : 0;
        const detail = toolRequests > 0 ? `${toolRequests} tool request${toolRequests === 1 ? '' : 's'}` : summarizeMessage(event.data.content);
        significantEvents.push({
          type: 'assistant_message',
          timestamp: event.timestamp,
          summary: `Assistant message: ${detail}`,
        });
        break;
      }

      case 'user.message': {
        const mode = asNonEmptyString(event.data.agentMode) ?? 'unknown';
        significantEvents.push({
          type: 'user_message',
          timestamp: event.timestamp,
          summary: `User message (${mode}): ${summarizeMessage(event.data.content)}`,
        });
        break;
      }

      case 'session.error': {
        errors++;
        const msg = (event.data.message as string) ?? 'Unknown error';
        significantEvents.push({
          type: 'session_error',
          timestamp: event.timestamp,
          summary: msg.substring(0, 200),
        });
        // Do NOT set terminalStatus here — session.error can be transient.
        // Only abort events should mark terminal failure.
        break;
      }

      case 'abort':
        significantEvents.push({
          type: 'abort',
          timestamp: event.timestamp,
          summary: `Aborted: ${(event.data.reason as string) ?? 'unknown'}`,
        });
        terminalStatus = 'failed';
        exitCode = 130;
        break;

      case 'subagent.started':
        significantEvents.push({
          type: 'subagent',
          timestamp: event.timestamp,
          summary: `Subagent started: ${(event.data.agentName as string) ?? 'unknown'}`,
        });
        break;

      case 'subagent.completed':
        significantEvents.push({
          type: 'subagent',
          timestamp: event.timestamp,
          summary: `Subagent completed: ${(event.data.agentName as string) ?? 'unknown'}`,
        });
        break;

      case 'skill.invoked':
        significantEvents.push({
          type: 'skill',
          timestamp: event.timestamp,
          summary: `Skill loaded: ${(event.data.name as string) ?? 'unknown'}`,
        });
        break;

      case 'session.start':
        significantEvents.push({
          type: 'start',
          timestamp: event.timestamp,
          summary: 'Session started',
        });
        break;

      case 'session.model_change':
        significantEvents.push({
          type: 'model_change',
          timestamp: event.timestamp,
          summary: `Model: ${(event.data.newModel as string) ?? 'unknown'}`,
        });
        break;

      case 'session.mode_changed': {
        const previousMode = asNonEmptyString(event.data.previousMode) ?? 'unknown';
        const newMode = asNonEmptyString(event.data.newMode) ?? 'unknown';
        significantEvents.push({
          type: 'mode_change',
          timestamp: event.timestamp,
          summary: `Mode: ${previousMode} -> ${newMode}`,
        });
        break;
      }

      case 'session.compaction_start':
        significantEvents.push({
          type: 'compaction',
          timestamp: event.timestamp,
          summary: 'Session compaction started',
        });
        break;

      case 'session.compaction_complete':
        significantEvents.push({
          type: 'compaction',
          timestamp: event.timestamp,
          summary: 'Session compaction completed',
        });
        break;

      case 'session.plan_changed':
        significantEvents.push({
          type: 'plan_change',
          timestamp: event.timestamp,
          summary: 'Session plan changed',
        });
        break;
    }
  }

  return { toolCalls, turns, errors, lastEventAt, lastEventType, terminalStatus, exitCode, significantEvents };
}

/** Detect if a worker is stale/lost based on last activity timestamp.
 *  @param lastEventAt - ISO timestamp of last event
 *  @param thresholdSeconds - How many seconds of inactivity before considered lost (default: 300 = 5 min)
 */
export function detectHealth(lastEventAt: string | null, thresholdSeconds: number = 300): 'healthy' | 'stale' | 'lost' {
  if (!lastEventAt) return 'lost';
  
  const lastTime = new Date(lastEventAt).getTime();
  const elapsed = (Date.now() - lastTime) / 1000;
  
  if (elapsed > thresholdSeconds * 2) return 'lost';
  if (elapsed > thresholdSeconds) return 'stale';
  return 'healthy';
}

/** Build a WorkerSyncResult from processed events */
export function buildSyncResult(
  workerId: string,
  events: WorkerEvent[],
  processed: ReturnType<typeof processEvents>,
  currentStatus: WorkerStatus,
): WorkerSyncResult {
  const status = processed.terminalStatus ?? currentStatus;
  return {
    workerId,
    ok: true,
    syncStatus: 'ok',
    newEvents: events.length,
    status,
    toolCalls: processed.toolCalls,
    turns: processed.turns,
    errors: processed.errors,
    lastEventAt: processed.lastEventAt,
    error: null,
    significantEvents: processed.significantEvents,
  };
}
