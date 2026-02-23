/**
 * Unit tests for reactor module
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { tmpdir } from 'node:os';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import {
  readNewEvents,
  processEvents,
  detectHealth,
  buildSyncResult,
} from '../../src/core/reactor.js';
import type { WorkerEvent } from '../../src/core/types.js';

describe('reactor module', () => {
  let tempDir: string;
  let eventsFile: string;

  beforeEach(() => {
    tempDir = mkdtempSync(join(tmpdir(), 'reactor-test-'));
    eventsFile = join(tempDir, 'events.jsonl');
  });

  afterEach(() => {
    if (tempDir) {
      rmSync(tempDir, { recursive: true, force: true });
    }
  });

  describe('readNewEvents', () => {
    it('should return empty for non-existent file', () => {
      const result = readNewEvents('/path/to/non-existent.jsonl', 0);
      expect(result.events).toEqual([]);
      expect(result.newOffset).toBe(0);
    });

    it('should parse valid NDJSON', () => {
      const events = [
        { type: 'session.start', data: { model: 'claude' }, id: 'e1', timestamp: '2024-01-15T10:00:00Z', parentId: null },
        { type: 'assistant.turn_end', data: {}, id: 'e2', timestamp: '2024-01-15T10:01:00Z', parentId: null },
        { type: 'tool.execution_complete', data: { toolName: 'bash', success: true }, id: 'e3', timestamp: '2024-01-15T10:02:00Z', parentId: null },
      ];
      
      const ndjson = events.map(e => JSON.stringify(e)).join('\n') + '\n';
      writeFileSync(eventsFile, ndjson);

      const result = readNewEvents(eventsFile, 0);
      expect(result.events.length).toBe(3);
      expect(result.events[0].type).toBe('session.start');
      expect(result.events[1].type).toBe('assistant.turn_end');
      expect(result.events[2].type).toBe('tool.execution_complete');
      expect(result.newOffset).toBeGreaterThan(0);
    });

    it('should respect byte offset and read only new lines', () => {
      const events1 = [
        { type: 'session.start', data: {}, id: 'e1', timestamp: '2024-01-15T10:00:00Z', parentId: null },
        { type: 'assistant.turn_end', data: {}, id: 'e2', timestamp: '2024-01-15T10:01:00Z', parentId: null },
      ];
      
      const ndjson1 = events1.map(e => JSON.stringify(e)).join('\n') + '\n';
      writeFileSync(eventsFile, ndjson1);

      const result1 = readNewEvents(eventsFile, 0);
      expect(result1.events.length).toBe(2);
      const offset1 = result1.newOffset;

      // Append more events
      const events2 = [
        { type: 'tool.execution_complete', data: { toolName: 'view' }, id: 'e3', timestamp: '2024-01-15T10:02:00Z', parentId: null },
        { type: 'tool.execution_complete', data: { toolName: 'edit' }, id: 'e4', timestamp: '2024-01-15T10:03:00Z', parentId: null },
      ];
      
      const ndjson2 = events2.map(e => JSON.stringify(e)).join('\n') + '\n';
      writeFileSync(eventsFile, ndjson1 + ndjson2);

      const result2 = readNewEvents(eventsFile, offset1);
      expect(result2.events.length).toBe(2);
      expect(result2.events[0].type).toBe('tool.execution_complete');
      expect(result2.events[0].data.toolName).toBe('view');
      expect(result2.events[1].data.toolName).toBe('edit');
      expect(result2.newOffset).toBeGreaterThan(offset1);
    });

    it('should skip malformed lines', () => {
      const ndjson = `
{"type": "session.start", "data": {}, "id": "e1", "timestamp": "2024-01-15T10:00:00Z", "parentId": null}
{invalid json here
{"type": "assistant.turn_end", "data": {}, "id": "e2", "timestamp": "2024-01-15T10:01:00Z", "parentId": null}
malformed line without braces
{"type": "tool.execution_complete", "data": {}, "id": "e3", "timestamp": "2024-01-15T10:02:00Z", "parentId": null}
`.trim() + '\n';
      
      writeFileSync(eventsFile, ndjson);

      const result = readNewEvents(eventsFile, 0);
      // Should get 3 valid events, skipping 2 malformed lines
      expect(result.events.length).toBe(3);
      expect(result.events[0].type).toBe('session.start');
      expect(result.events[1].type).toBe('assistant.turn_end');
      expect(result.events[2].type).toBe('tool.execution_complete');
    });

    it('should not skip partial trailing lines — offset stays before them', () => {
      // Write one complete line + one partial (no trailing newline)
      const complete = '{"type": "session.start", "data": {}, "id": "e1", "timestamp": "2024-01-15T10:00:00Z", "parentId": null}\n';
      const partial = '{"type": "assistant.turn_end", "da';
      writeFileSync(eventsFile, complete + partial);

      const result = readNewEvents(eventsFile, 0);
      // Should parse only the complete line
      expect(result.events.length).toBe(1);
      expect(result.events[0].type).toBe('session.start');
      // Offset should stop after the complete line, NOT at end of file
      expect(result.newOffset).toBe(Buffer.byteLength(complete, 'utf-8'));

      // Simulate the partial line being completed on next write
      const completed = '{"type": "assistant.turn_end", "data": {}, "id": "e2", "timestamp": "2024-01-15T10:01:00Z", "parentId": null}\n';
      writeFileSync(eventsFile, complete + completed);

      const result2 = readNewEvents(eventsFile, result.newOffset);
      expect(result2.events.length).toBe(1);
      expect(result2.events[0].type).toBe('assistant.turn_end');
    });

    it('should handle file with only partial data (no newlines)', () => {
      writeFileSync(eventsFile, '{"type": "session.st');
      const result = readNewEvents(eventsFile, 0);
      expect(result.events.length).toBe(0);
      expect(result.newOffset).toBe(0);
    });

    it('should detect file truncation and reset offset to 0', () => {
      // Write a large file, get offset
      const events = [
        { type: 'session.start', data: {}, id: 'e1', timestamp: '2024-01-15T10:00:00Z', parentId: null },
        { type: 'assistant.turn_end', data: {}, id: 'e2', timestamp: '2024-01-15T10:01:00Z', parentId: null },
        { type: 'tool.execution_complete', data: { success: true }, id: 'e3', timestamp: '2024-01-15T10:02:00Z', parentId: null },
      ];
      const ndjson = events.map(e => JSON.stringify(e)).join('\n') + '\n';
      writeFileSync(eventsFile, ndjson);

      const result1 = readNewEvents(eventsFile, 0);
      expect(result1.events.length).toBe(3);
      const oldOffset = result1.newOffset;

      // Truncate the file (simulating rotation/replacement)
      const newEvent = { type: 'session.start', data: {}, id: 'e4', timestamp: '2024-01-15T11:00:00Z', parentId: null };
      const smallContent = JSON.stringify(newEvent) + '\n';
      writeFileSync(eventsFile, smallContent);

      // File is now smaller than oldOffset — should reset and read from 0
      const result2 = readNewEvents(eventsFile, oldOffset);
      expect(result2.events.length).toBe(1);
      expect(result2.events[0].id).toBe('e4');
      expect(result2.newOffset).toBe(Buffer.byteLength(smallContent, 'utf-8'));
    });

    it('should return empty if file size has not changed', () => {
      const ndjson = '{"type": "test", "data": {}, "id": "e1", "timestamp": "2024-01-15T10:00:00Z", "parentId": null}\n';
      writeFileSync(eventsFile, ndjson);

      const result1 = readNewEvents(eventsFile, 0);
      expect(result1.events.length).toBe(1);

      // Read again from same offset (file unchanged)
      const result2 = readNewEvents(eventsFile, result1.newOffset);
      expect(result2.events.length).toBe(0);
      expect(result2.newOffset).toBe(result1.newOffset);
    });
  });

  describe('processEvents', () => {
    it('should count tool calls from tool.execution_complete events', () => {
      const events: WorkerEvent[] = [
        { type: 'tool.execution_complete', data: { toolName: 'bash', success: true }, id: 'e1', timestamp: '2024-01-15T10:00:00Z', parentId: null },
        { type: 'tool.execution_complete', data: { toolName: 'view', success: true }, id: 'e2', timestamp: '2024-01-15T10:01:00Z', parentId: null },
        { type: 'tool.execution_complete', data: { toolName: 'edit', success: true }, id: 'e3', timestamp: '2024-01-15T10:02:00Z', parentId: null },
      ];

      const result = processEvents(events);
      expect(result.toolCalls).toBe(3);
    });

    it('should count turns from assistant.turn_end events', () => {
      const events: WorkerEvent[] = [
        { type: 'assistant.turn_end', data: {}, id: 'e1', timestamp: '2024-01-15T10:00:00Z', parentId: null },
        { type: 'assistant.turn_end', data: {}, id: 'e2', timestamp: '2024-01-15T10:01:00Z', parentId: null },
      ];

      const result = processEvents(events);
      expect(result.turns).toBe(2);
    });

    it('should count errors from session.error events', () => {
      const events: WorkerEvent[] = [
        { type: 'session.error', data: { message: 'Error 1' }, id: 'e1', timestamp: '2024-01-15T10:00:00Z', parentId: null },
        { type: 'session.error', data: { message: 'Error 2' }, id: 'e2', timestamp: '2024-01-15T10:01:00Z', parentId: null },
      ];

      const result = processEvents(events);
      expect(result.errors).toBe(2);
    });

    it('should count errors from failed tool executions', () => {
      const events: WorkerEvent[] = [
        { type: 'tool.execution_complete', data: { toolName: 'bash', success: false }, id: 'e1', timestamp: '2024-01-15T10:00:00Z', parentId: null },
        { type: 'tool.execution_complete', data: { toolName: 'view', success: true }, id: 'e2', timestamp: '2024-01-15T10:01:00Z', parentId: null },
      ];

      const result = processEvents(events);
      expect(result.toolCalls).toBe(2);
      expect(result.errors).toBe(1);
    });

    it('should NOT set terminal status from session.error (transient errors)', () => {
      const events: WorkerEvent[] = [
        { type: 'session.error', data: { message: 'Transient error occurred' }, id: 'e1', timestamp: '2024-01-15T10:00:00Z', parentId: null },
      ];

      const result = processEvents(events);
      expect(result.errors).toBe(1);
      expect(result.terminalStatus).toBeNull();
      expect(result.exitCode).toBeNull();
    });

    it('should keep worker active after transient error followed by successful events', () => {
      const events: WorkerEvent[] = [
        { type: 'session.start', data: {}, id: 'e1', timestamp: '2024-01-15T10:00:00Z', parentId: null },
        { type: 'session.error', data: { message: 'Transient network error' }, id: 'e2', timestamp: '2024-01-15T10:01:00Z', parentId: null },
        { type: 'tool.execution_complete', data: { toolName: 'bash', success: true }, id: 'e3', timestamp: '2024-01-15T10:02:00Z', parentId: null },
        { type: 'assistant.turn_end', data: {}, id: 'e4', timestamp: '2024-01-15T10:03:00Z', parentId: null },
        { type: 'tool.execution_complete', data: { toolName: 'view', success: true }, id: 'e5', timestamp: '2024-01-15T10:04:00Z', parentId: null },
      ];

      const result = processEvents(events);
      expect(result.errors).toBe(1);
      expect(result.toolCalls).toBe(2);
      expect(result.turns).toBe(1);
      expect(result.terminalStatus).toBeNull();
      expect(result.exitCode).toBeNull();
    });

    it('should detect abort with exit code 130', () => {
      const events: WorkerEvent[] = [
        { type: 'abort', data: { reason: 'User interrupted' }, id: 'e1', timestamp: '2024-01-15T10:00:00Z', parentId: null },
      ];

      const result = processEvents(events);
      expect(result.terminalStatus).toBe('failed');
      expect(result.exitCode).toBe(130);
    });

    it('should extract significant events - subagent started', () => {
      const events: WorkerEvent[] = [
        { type: 'subagent.started', data: { agentName: 'Scout' }, id: 'e1', timestamp: '2024-01-15T10:00:00Z', parentId: null },
      ];

      const result = processEvents(events);
      expect(result.significantEvents.length).toBe(1);
      expect(result.significantEvents[0].type).toBe('subagent');
      expect(result.significantEvents[0].summary).toContain('Scout');
      expect(result.significantEvents[0].summary).toContain('started');
    });

    it('should extract significant events - subagent completed', () => {
      const events: WorkerEvent[] = [
        { type: 'subagent.completed', data: { agentName: 'Executor' }, id: 'e1', timestamp: '2024-01-15T10:00:00Z', parentId: null },
      ];

      const result = processEvents(events);
      expect(result.significantEvents.length).toBe(1);
      expect(result.significantEvents[0].type).toBe('subagent');
      expect(result.significantEvents[0].summary).toContain('Executor');
      expect(result.significantEvents[0].summary).toContain('completed');
    });

    it('should extract significant events - skill invoked', () => {
      const events: WorkerEvent[] = [
        { type: 'skill.invoked', data: { name: 'agents-hub' }, id: 'e1', timestamp: '2024-01-15T10:00:00Z', parentId: null },
      ];

      const result = processEvents(events);
      expect(result.significantEvents.length).toBe(1);
      expect(result.significantEvents[0].type).toBe('skill');
      expect(result.significantEvents[0].summary).toContain('agents-hub');
    });

    it('should extract significant events - session start (no model)', () => {
      const events: WorkerEvent[] = [
        { type: 'session.start', data: {}, id: 'e1', timestamp: '2024-01-15T10:00:00Z', parentId: null },
      ];

      const result = processEvents(events);
      expect(result.significantEvents.length).toBe(1);
      expect(result.significantEvents[0].type).toBe('start');
      expect(result.significantEvents[0].summary).toBe('Session started');
    });

    it('should extract significant events - session.model_change', () => {
      const events: WorkerEvent[] = [
        { type: 'session.model_change', data: { newModel: 'claude-sonnet-4' }, id: 'e1', timestamp: '2024-01-15T10:00:00Z', parentId: null },
      ];

      const result = processEvents(events);
      expect(result.significantEvents.length).toBe(1);
      expect(result.significantEvents[0].type).toBe('model_change');
      expect(result.significantEvents[0].summary).toBe('Model: claude-sonnet-4');
    });

    it('should handle session.model_change with missing newModel', () => {
      const events: WorkerEvent[] = [
        { type: 'session.model_change', data: {}, id: 'e1', timestamp: '2024-01-15T10:00:00Z', parentId: null },
      ];

      const result = processEvents(events);
      expect(result.significantEvents.length).toBe(1);
      expect(result.significantEvents[0].type).toBe('model_change');
      expect(result.significantEvents[0].summary).toBe('Model: unknown');
    });

    it('should handle real Copilot CLI interaction events deterministically', () => {
      const events: WorkerEvent[] = [
        { type: 'tool.execution_start', data: { toolCallId: 'call-1', toolName: 'view', arguments: { path: 'src/core/reactor.ts' } }, id: 'e1', timestamp: '2024-01-15T10:00:00Z', parentId: null },
        { type: 'tool.execution_complete', data: { toolCallId: 'call-1', success: true, result: {} }, id: 'e2', timestamp: '2024-01-15T10:00:01Z', parentId: null },
        { type: 'assistant.turn_start', data: { turnId: '0' }, id: 'e3', timestamp: '2024-01-15T10:00:02Z', parentId: null },
        { type: 'assistant.message', data: { messageId: 'm1', content: '', toolRequests: [{}] }, id: 'e4', timestamp: '2024-01-15T10:00:03Z', parentId: null },
        { type: 'user.message', data: { content: 'Expand reactor event handling', agentMode: 'autopilot' }, id: 'e5', timestamp: '2024-01-15T10:00:04Z', parentId: null },
        { type: 'session.mode_changed', data: { previousMode: 'interactive', newMode: 'autopilot' }, id: 'e6', timestamp: '2024-01-15T10:00:05Z', parentId: null },
      ];

      const result = processEvents(events);
      expect(result.toolCalls).toBe(1);
      expect(result.turns).toBe(0);
      expect(result.errors).toBe(0);
      expect(result.lastEventType).toBe('session.mode_changed');
      expect(result.significantEvents.map(event => event.type)).toEqual([
        'tool_start',
        'turn_start',
        'assistant_message',
        'user_message',
        'mode_change',
      ]);
      expect(result.significantEvents[0].summary).toBe('Tool view started');
      expect(result.significantEvents[4].summary).toBe('Mode: interactive -> autopilot');
    });

    it('should extract significant events - compaction and plan changes', () => {
      const events: WorkerEvent[] = [
        { type: 'session.compaction_start', data: {}, id: 'e1', timestamp: '2024-01-15T10:00:00Z', parentId: null },
        { type: 'session.plan_changed', data: {}, id: 'e2', timestamp: '2024-01-15T10:00:01Z', parentId: null },
        { type: 'session.compaction_complete', data: {}, id: 'e3', timestamp: '2024-01-15T10:00:02Z', parentId: null },
      ];

      const result = processEvents(events);
      expect(result.significantEvents.map(event => event.type)).toEqual([
        'compaction',
        'plan_change',
        'compaction',
      ]);
      expect(result.significantEvents[0].summary).toBe('Session compaction started');
      expect(result.significantEvents[2].summary).toBe('Session compaction completed');
    });

    it('should pair tool start/complete events and aggregate duration stats', () => {
      const events: WorkerEvent[] = [
        { type: 'tool.execution_start', data: { toolCallId: 'call-1', toolName: 'view' }, id: 'e1', timestamp: '2024-01-15T10:00:00Z', parentId: null },
        { type: 'tool.execution_complete', data: { toolCallId: 'call-1', success: true }, id: 'e2', timestamp: '2024-01-15T10:00:02Z', parentId: null },
        { type: 'tool.execution_start', data: { toolCallId: 'call-2', toolName: 'view' }, id: 'e3', timestamp: '2024-01-15T10:00:03Z', parentId: null },
        { type: 'tool.execution_complete', data: { toolCallId: 'call-2', success: true }, id: 'e4', timestamp: '2024-01-15T10:00:06Z', parentId: null },
      ];

      const result = processEvents(events);
      expect(result.pendingStarts).toEqual({});
      expect(result.toolDurationStats).toEqual([
        {
          toolName: 'view',
          count: 2,
          totalMs: 5000,
          avgMs: 2500,
          maxMs: 3000,
          slowCount: 0,
        },
      ]);
      expect(result.slowTools).toEqual([]);
    });

    it('should carry pending starts across sync boundaries and flag slow tools', () => {
      const existingStarts = {
        'call-1': { toolName: 'bash', startedAt: '2024-01-15T10:00:00Z' },
      };
      const events: WorkerEvent[] = [
        { type: 'tool.execution_complete', data: { toolCallId: 'call-1', success: false }, id: 'e1', timestamp: '2024-01-15T10:00:08Z', parentId: null },
      ];

      const result = processEvents(events, existingStarts);
      expect(result.pendingStarts).toEqual({});
      expect(result.toolDurationStats[0]).toMatchObject({
        toolName: 'bash',
        count: 1,
        totalMs: 8000,
        avgMs: 8000,
        maxMs: 8000,
        slowCount: 1,
      });
      expect(result.slowTools).toHaveLength(1);
      expect(result.slowTools[0]).toMatchObject({
        toolName: 'bash',
        durationMs: 8000,
        success: false,
      });
      expect(result.significantEvents.some((event) => event.type === 'tool_slow')).toBe(true);
    });

    it('should extract significant events - tool error', () => {
      const events: WorkerEvent[] = [
        { type: 'tool.execution_complete', data: { toolName: 'bash', success: false }, id: 'e1', timestamp: '2024-01-15T10:00:00Z', parentId: null },
      ];

      const result = processEvents(events);
      expect(result.significantEvents.length).toBe(1);
      expect(result.significantEvents[0].type).toBe('tool_error');
      expect(result.significantEvents[0].summary).toContain('bash');
    });

    it('should track last event timestamp and type', () => {
      const events: WorkerEvent[] = [
        { type: 'session.start', data: {}, id: 'e1', timestamp: '2024-01-15T10:00:00Z', parentId: null },
        { type: 'assistant.turn_end', data: {}, id: 'e2', timestamp: '2024-01-15T10:05:00Z', parentId: null },
        { type: 'tool.execution_complete', data: { success: true }, id: 'e3', timestamp: '2024-01-15T10:10:00Z', parentId: null },
      ];

      const result = processEvents(events);
      expect(result.lastEventAt).toBe('2024-01-15T10:10:00Z');
      expect(result.lastEventType).toBe('tool.execution_complete');
    });

    it('should handle empty events array', () => {
      const result = processEvents([]);
      expect(result.toolCalls).toBe(0);
      expect(result.turns).toBe(0);
      expect(result.errors).toBe(0);
      expect(result.lastEventAt).toBeNull();
      expect(result.lastEventType).toBeNull();
      expect(result.terminalStatus).toBeNull();
      expect(result.exitCode).toBeNull();
      expect(result.significantEvents).toEqual([]);
    });

    it('should handle mixed event types correctly', () => {
      const events: WorkerEvent[] = [
        { type: 'session.start', data: {}, id: 'e1', timestamp: '2024-01-15T10:00:00Z', parentId: null },
        { type: 'session.model_change', data: { newModel: 'claude-sonnet-4' }, id: 'e1b', timestamp: '2024-01-15T10:00:01Z', parentId: null },
        { type: 'tool.execution_complete', data: { toolName: 'view', success: true }, id: 'e2', timestamp: '2024-01-15T10:01:00Z', parentId: null },
        { type: 'tool.execution_complete', data: { toolName: 'bash', success: false }, id: 'e3', timestamp: '2024-01-15T10:02:00Z', parentId: null },
        { type: 'assistant.turn_end', data: {}, id: 'e4', timestamp: '2024-01-15T10:03:00Z', parentId: null },
        { type: 'skill.invoked', data: { name: 'backlog' }, id: 'e5', timestamp: '2024-01-15T10:04:00Z', parentId: null },
        { type: 'subagent.started', data: { agentName: 'Scout' }, id: 'e6', timestamp: '2024-01-15T10:05:00Z', parentId: null },
      ];

      const result = processEvents(events);
      expect(result.toolCalls).toBe(2);
      expect(result.turns).toBe(1);
      expect(result.errors).toBe(1);
      expect(result.significantEvents.length).toBe(5); // start, model_change, tool_error, skill, subagent
      expect(result.lastEventAt).toBe('2024-01-15T10:05:00Z');
    });
  });

  describe('detectHealth', () => {
    it('should return "lost" for null timestamp', () => {
      const health = detectHealth(null);
      expect(health).toBe('lost');
    });

    it('should return "healthy" for recent timestamp', () => {
      const now = new Date();
      const recentTimestamp = new Date(now.getTime() - 60 * 1000).toISOString(); // 1 minute ago
      const health = detectHealth(recentTimestamp, 300);
      expect(health).toBe('healthy');
    });

    it('should return "stale" for old timestamp within 2x threshold', () => {
      const now = new Date();
      const staleTimestamp = new Date(now.getTime() - 400 * 1000).toISOString(); // 400 seconds ago (> 300, < 600)
      const health = detectHealth(staleTimestamp, 300);
      expect(health).toBe('stale');
    });

    it('should return "lost" for very old timestamp beyond 2x threshold', () => {
      const now = new Date();
      const lostTimestamp = new Date(now.getTime() - 700 * 1000).toISOString(); // 700 seconds ago (> 600)
      const health = detectHealth(lostTimestamp, 300);
      expect(health).toBe('lost');
    });

    it('should use custom threshold correctly', () => {
      const now = new Date();
      const timestamp = new Date(now.getTime() - 150 * 1000).toISOString(); // 150 seconds ago
      
      // With threshold of 100s: 150s > 100s but < 200s = stale
      const health1 = detectHealth(timestamp, 100);
      expect(health1).toBe('stale');
      
      // With threshold of 200s: 150s < 200s = healthy
      const health2 = detectHealth(timestamp, 200);
      expect(health2).toBe('healthy');
    });

    it('should handle edge case at exactly threshold boundary', () => {
      const now = new Date();
      const exactThreshold = new Date(now.getTime() - 300 * 1000).toISOString(); // exactly 300s ago
      const health = detectHealth(exactThreshold, 300);
      // Should be stale (> 300) since time has passed during test execution
      expect(['healthy', 'stale']).toContain(health);
    });
  });

  describe('buildSyncResult', () => {
    it('should build correct result object', () => {
      const events: WorkerEvent[] = [
        { type: 'tool.execution_complete', data: { success: true }, id: 'e1', timestamp: '2024-01-15T10:00:00Z', parentId: null },
        { type: 'assistant.turn_end', data: {}, id: 'e2', timestamp: '2024-01-15T10:01:00Z', parentId: null },
      ];
      
      const processed = processEvents(events);
      const result = buildSyncResult('worker-1', events, processed, 'active');

      expect(result.workerId).toBe('worker-1');
      expect(result.newEvents).toBe(2);
      expect(result.status).toBe('active');
      expect(result.toolCalls).toBe(1);
      expect(result.turns).toBe(1);
      expect(result.errors).toBe(0);
      expect(result.lastEventAt).toBe('2024-01-15T10:01:00Z');
      expect(result.significantEvents).toBeDefined();
      expect(result.slowTools).toEqual([]);
      expect(result.toolDurationStats).toEqual([]);
    });

    it('should keep active status when session.error occurs (not terminal)', () => {
      const events: WorkerEvent[] = [
        { type: 'session.error', data: { message: 'Transient error' }, id: 'e1', timestamp: '2024-01-15T10:00:00Z', parentId: null },
      ];
      
      const processed = processEvents(events);
      const result = buildSyncResult('worker-1', events, processed, 'active');

      expect(result.status).toBe('active'); // session.error no longer terminal
      expect(result.errors).toBe(1);
    });

    it('should preserve current status if no terminal status detected', () => {
      const events: WorkerEvent[] = [
        { type: 'tool.execution_complete', data: { success: true }, id: 'e1', timestamp: '2024-01-15T10:00:00Z', parentId: null },
      ];
      
      const processed = processEvents(events);
      const result = buildSyncResult('worker-1', events, processed, 'active');

      expect(result.status).toBe('active');
    });

    it('should handle empty events', () => {
      const events: WorkerEvent[] = [];
      const processed = processEvents(events);
      const result = buildSyncResult('worker-1', events, processed, 'completed');

      expect(result.workerId).toBe('worker-1');
      expect(result.newEvents).toBe(0);
      expect(result.status).toBe('completed');
      expect(result.toolCalls).toBe(0);
      expect(result.turns).toBe(0);
      expect(result.errors).toBe(0);
      expect(result.lastEventAt).toBeNull();
      expect(result.slowTools).toEqual([]);
      expect(result.toolDurationStats).toEqual([]);
      expect(result.significantEvents).toEqual([]);
    });

    it('should include significant events in result', () => {
      const events: WorkerEvent[] = [
        { type: 'session.start', data: {}, id: 'e1', timestamp: '2024-01-15T10:00:00Z', parentId: null },
        { type: 'skill.invoked', data: { name: 'agents-hub' }, id: 'e2', timestamp: '2024-01-15T10:01:00Z', parentId: null },
      ];
      
      const processed = processEvents(events);
      const result = buildSyncResult('worker-1', events, processed, 'active');

      expect(result.significantEvents.length).toBe(2);
      expect(result.significantEvents[0].type).toBe('start');
      expect(result.significantEvents[1].type).toBe('skill');
    });
  });
});
