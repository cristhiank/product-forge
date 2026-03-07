/**
 * Unit tests for telemetry module
 */

import { describe, it, expect } from 'vitest';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { getTelemetryReader } from '../../src/core/telemetry.js';

const COPILOT_EVENTS_PATH = '/Users/me/.copilot/session-state/123/events.jsonl';

describe('telemetry module', () => {
  describe('getTelemetryReader', () => {
    it('should return CopilotTelemetryReader when events path is in .copilot/session-state', () => {
      const reader = getTelemetryReader(COPILOT_EVENTS_PATH);
      expect(reader).not.toBeNull();
    });

    it('should support windows-style copilot session paths', () => {
      const reader = getTelemetryReader('C:\\Users\\me\\.copilot\\session-state\\123\\events.jsonl');
      expect(reader).not.toBeNull();
    });

    it('should return null when events path is missing', () => {
      expect(getTelemetryReader(null)).toBeNull();
    });

    it('should return null for non-copilot telemetry paths', () => {
      expect(getTelemetryReader('/tmp/custom-agent/events.jsonl')).toBeNull();
    });
  });

  describe('CopilotTelemetryReader', () => {
    let tmpDir: string;

    function createEventsFile(events: Array<{ type: string; data: Record<string, unknown>; timestamp: string }>) {
      tmpDir = mkdtempSync(join(tmpdir(), 'telemetry-test-'));
      const eventsPath = join(tmpDir, 'events.jsonl');
      const lines = events.map(evt => JSON.stringify({
        id: `evt-${Math.random()}`,
        type: evt.type,
        data: evt.data,
        timestamp: evt.timestamp,
        parentId: null,
      }));
      writeFileSync(eventsPath, lines.join('\n') + '\n', 'utf-8');
      return eventsPath;
    }

    function cleanup() {
      if (tmpDir) {
        rmSync(tmpDir, { recursive: true, force: true });
      }
    }

    describe('readEvents', () => {
      it('should read events with default limit', () => {
        const eventsPath = createEventsFile([
          { type: 'session.start', data: {}, timestamp: '2024-01-01T10:00:00Z' },
          { type: 'turn.user_message', data: { message: 'Hello' }, timestamp: '2024-01-01T10:01:00Z' },
          { type: 'turn.assistant_message', data: { message: 'Hi' }, timestamp: '2024-01-01T10:02:00Z' },
        ]);

        const reader = getTelemetryReader(COPILOT_EVENTS_PATH)!;
        const result = reader.readEvents(eventsPath, null, 100);

        expect(result.error).toBeNull();
        expect(result.events.length).toBe(3);
        expect(result.totalLines).toBeNull();
        expect(result.hasMore).toBe(false);
        expect(result.cursor).toBeNull();

        cleanup();
      });

      it('should paginate events correctly', () => {
        const events = Array.from({ length: 10 }, (_, i) => ({
          type: 'turn.user_message',
          data: { message: `Message ${i}` },
          timestamp: `2024-01-01T10:${String(i).padStart(2, '0')}:00Z`,
        }));
        const eventsPath = createEventsFile(events);

        const reader = getTelemetryReader(COPILOT_EVENTS_PATH)!;
        
        // First page: limit 3
        const page1 = reader.readEvents(eventsPath, null, 3);
        expect(page1.events.length).toBe(3);
        expect(page1.hasMore).toBe(true);
        expect(page1.cursor).toMatch(/^byte:\d+$/);
        expect(page1.totalLines).toBeNull();

        // Second page: use cursor
        const page2 = reader.readEvents(eventsPath, page1.cursor, 3);
        expect(page2.events.length).toBe(3);
        expect(page2.hasMore).toBe(true);
        expect(page2.cursor).toMatch(/^byte:\d+$/);

        // Last page
        const page3 = reader.readEvents(eventsPath, page2.cursor, 5);
        expect(page3.events.length).toBe(4); // Only 4 remaining
        expect(page3.hasMore).toBe(false);
        expect(page3.cursor).toBeNull();

        cleanup();
      });

      it('should return error when file missing', () => {
        const reader = getTelemetryReader(COPILOT_EVENTS_PATH)!;
        const result = reader.readEvents('/nonexistent/path', null, 100);

        expect(result.error).toBe('Events file not found');
        expect(result.events.length).toBe(0);
        expect(result.hasMore).toBe(false);
      });

      it('should enforce bounded limit', () => {
        const events = Array.from({ length: 600 }, (_, i) => ({
          type: 'turn.user_message',
          data: { message: `Message ${i}` },
          timestamp: `2024-01-01T10:00:00Z`,
        }));
        const eventsPath = createEventsFile(events);

        const reader = getTelemetryReader(COPILOT_EVENTS_PATH)!;
        const result = reader.readEvents(eventsPath, null, 100);

        // Should return last 100 events
        expect(result.events.length).toBe(100);
        expect(result.totalLines).toBeNull();
        expect(result.hasMore).toBe(true);

        cleanup();
      });
    });

    describe('toConversation', () => {
      it('should convert user messages', () => {
        const reader = getTelemetryReader(COPILOT_EVENTS_PATH)!;
        const events = [
          {
            id: 'e1',
            type: 'user.message',
            data: { content: 'Hello world' },
            timestamp: '2024-01-01T10:00:00Z',
            parentId: null,
          },
        ];

        const items = reader.toConversation(events);
        expect(items.length).toBe(1);
        expect(items[0].type).toBe('user_message');
        expect(items[0].content).toBe('Hello world');
        expect(items[0].timestamp).toBe('2024-01-01T10:00:00Z');
      });

      it('should convert assistant messages', () => {
        const reader = getTelemetryReader(COPILOT_EVENTS_PATH)!;
        const events = [
          {
            id: 'e1',
            type: 'assistant.message',
            data: { content: 'Hi there' },
            timestamp: '2024-01-01T10:01:00Z',
            parentId: null,
          },
        ];

        const items = reader.toConversation(events);
        expect(items.length).toBe(1);
        expect(items[0].type).toBe('assistant_message');
        expect(items[0].content).toBe('Hi there');
      });

      it('should summarize assistant steps when content is empty', () => {
        const reader = getTelemetryReader(COPILOT_EVENTS_PATH)!;
        const events = [
          {
            id: 'e1',
            type: 'assistant.message',
            data: {
              content: '',
              reasoningText: 'Inspecting worker telemetry payloads',
              toolRequests: [{ name: 'view' }, { name: 'rg' }],
            },
            timestamp: '2024-01-01T10:01:00Z',
            parentId: null,
          },
        ];

        const items = reader.toConversation(events);
        expect(items.length).toBe(1);
        expect(items[0].type).toBe('assistant_message');
        expect(items[0].content).toContain('Inspecting worker telemetry payloads');
        expect(items[0].content).toContain('Tool requests: view, rg');
      });

      it('should convert tool lifecycle events', () => {
        const reader = getTelemetryReader(COPILOT_EVENTS_PATH)!;
        const events = [
          {
            id: 'e1',
            type: 'tool.execution_start',
            data: { toolCallId: 'call-1', tool_name: 'view', parameters: { path: '/test' } },
            timestamp: '2024-01-01T10:02:00Z',
            parentId: null,
          },
          {
            id: 'e2',
            type: 'tool.execution_complete',
            data: { toolCallId: 'call-1', success: true },
            timestamp: '2024-01-01T10:02:05Z',
            parentId: null,
          },
        ];

        const items = reader.toConversation(events);
        expect(items.length).toBe(2);
        expect(items[0].type).toBe('tool_lifecycle');
        expect(items[0].content).toContain('start: view');
        expect(items[0].content).toContain('call-1');
        expect(items[1].content).toContain('completed: view');
        expect(items[0].content).toContain('view');
        expect(items[1].type).toBe('tool_lifecycle');
      });

      it('should convert session lifecycle events', () => {
        const reader = getTelemetryReader(COPILOT_EVENTS_PATH)!;
        const events = [
          {
            id: 'e1',
            type: 'session.model_change',
            data: { previousModel: 'gpt-4.1', newModel: 'gpt-5.4' },
            timestamp: '2024-01-01T10:02:05Z',
            parentId: null,
          },
        ];

        const items = reader.toConversation(events);
        expect(items.length).toBe(1);
        expect(items[0].type).toBe('session_event');
        expect(items[0].content).toContain('model changed');
        expect(items[0].content).toContain('gpt-5.4');
      });

      it('should convert error events', () => {
        const reader = getTelemetryReader(COPILOT_EVENTS_PATH)!;
        const events = [
          {
            id: 'e1',
            type: 'session.error',
            data: { message: 'Something went wrong', error: 'Details' },
            timestamp: '2024-01-01T10:03:00Z',
            parentId: null,
          },
        ];

        const items = reader.toConversation(events);
        expect(items.length).toBe(1);
        expect(items[0].type).toBe('error');
        expect(items[0].content).toBe('Something went wrong');
      });

      it('should handle unknown event types', () => {
        const reader = getTelemetryReader(COPILOT_EVENTS_PATH)!;
        const events = [
          {
            id: 'e1',
            type: 'custom.event',
            data: { foo: 'bar' },
            timestamp: '2024-01-01T10:04:00Z',
            parentId: null,
          },
        ];

        const items = reader.toConversation(events);
        expect(items.length).toBe(1);
        expect(items[0].type).toBe('unknown');
        expect(items[0].content).toBe('custom.event');
      });

      it('should convert mixed event types in order', () => {
        const reader = getTelemetryReader(COPILOT_EVENTS_PATH)!;
        const events = [
          {
            id: 'e1',
            type: 'turn.user_message',
            data: { message: 'Do something' },
            timestamp: '2024-01-01T10:00:00Z',
            parentId: null,
          },
          {
            id: 'e2',
            type: 'tool.execution_start',
            data: { tool_name: 'bash' },
            timestamp: '2024-01-01T10:00:01Z',
            parentId: null,
          },
          {
            id: 'e3',
            type: 'assistant.turn_start',
            data: { turnId: 't1' },
            timestamp: '2024-01-01T10:00:01Z',
            parentId: null,
          },
          {
            id: 'e4',
            type: 'turn.assistant_message',
            data: { message: 'Done' },
            timestamp: '2024-01-01T10:00:02Z',
            parentId: null,
          },
        ];

        const items = reader.toConversation(events);
        expect(items.length).toBe(3);
        expect(items[0].type).toBe('user_message');
        expect(items[1].type).toBe('tool_lifecycle');
        expect(items[2].type).toBe('assistant_message');
      });
    });
  });
});
