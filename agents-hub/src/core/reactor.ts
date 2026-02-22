import { existsSync, statSync, openSync, readSync, closeSync } from 'node:fs';
import type { WorkerEvent, WorkerSyncResult, WorkerStatus } from './types.js';

/** Read new events from an events.jsonl file starting from byte offset.
 *  Returns parsed events and the new byte offset for next read.
 */
export function readNewEvents(eventsPath: string, fromOffset: number = 0): { events: WorkerEvent[]; newOffset: number } {
  if (!existsSync(eventsPath)) return { events: [], newOffset: fromOffset };
  
  const stat = statSync(eventsPath);
  if (stat.size <= fromOffset) return { events: [], newOffset: fromOffset };
  
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
  const lines = text.split('\n').filter(l => l.trim().length > 0);
  const events: WorkerEvent[] = [];
  
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
    }
  }
  
  return { events, newOffset: stat.size };
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

  for (const event of events) {
    // Update last activity
    if (event.timestamp) {
      lastEventAt = event.timestamp;
      lastEventType = event.type;
    }

    switch (event.type) {
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

      case 'session.error': {
        errors++;
        const msg = (event.data.message as string) ?? 'Unknown error';
        significantEvents.push({
          type: 'session_error',
          timestamp: event.timestamp,
          summary: msg.substring(0, 200),
        });
        terminalStatus = 'failed';
        exitCode = 1;
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
          summary: `Session started (model: ${(event.data.selectedModel as string) ?? 'unknown'})`,
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
    newEvents: events.length,
    status,
    toolCalls: processed.toolCalls,
    turns: processed.turns,
    errors: processed.errors,
    lastEventAt: processed.lastEventAt,
    significantEvents: processed.significantEvents,
  };
}
