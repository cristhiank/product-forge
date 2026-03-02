import { createReadStream, existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { createInterface } from 'node:readline';
import { join } from 'node:path';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface SessionSummary {
  id: string;
  summary: string;
  branch: string;
  cwd: string;
  gitRoot: string;
  model: string;
  createdAt: string;
  updatedAt: string;
}

export interface SessionStats {
  turns: number;
  toolCalls: number;
  skills: number;
  subagents: number;
  errors: number;
  compactions: number;
  truncations: number;
  duration: number; // ms between first and last event
}

export interface SkillUsage {
  name: string;
  count: number;
}

export interface ToolBreakdown {
  name: string;
  count: number;
  successCount: number;
  failCount: number;
  avgDuration: number;
  isMcp: boolean;
  mcpServer?: string;
}

export interface SubagentBreakdown {
  agentName: string;
  count: number;
}

export interface CompactionEvent {
  timestamp: string;
  preTokens: number;
  postTokens?: number;
  summaryContent?: string;
}

export interface TruncationEvent {
  timestamp: string;
  preTokens: number;
  postTokens: number;
  tokensRemoved: number;
  messagesRemoved: number;
}

export interface ErrorEvent {
  timestamp: string;
  errorType: string;
  message: string;
}

export interface SessionDetail {
  id: string;
  summary: string;
  branch: string;
  cwd: string;
  gitRoot: string;
  createdAt: string;
  updatedAt: string;
  stats: SessionStats;
  models: string[];
  mcpServers: string[];
  skillsUsed: SkillUsage[];
  toolBreakdown: ToolBreakdown[];
  subagentBreakdown: SubagentBreakdown[];
  compactionEvents: CompactionEvent[];
  truncationEvents: TruncationEvent[];
  errorEvents: ErrorEvent[];
}

export interface ToolCall {
  toolCallId: string;
  toolName: string;
  arguments: Record<string, unknown>;
  success?: boolean;
  result?: string;
  duration?: number;
  isSubagent: boolean;
  subagentName?: string;
  subagentDisplayName?: string;
}

export interface ToolCallGroup {
  parallel: boolean;
  calls: ToolCall[];
}

export interface AssistantMessage {
  messageId: string;
  content: string;
  timestamp: string;
  toolGroups: ToolCallGroup[];
}

export interface InlineEvent {
  type: string;
  timestamp: string;
  data: Record<string, unknown>;
}

export interface Turn {
  turnId: string;
  startTime: string;
  endTime?: string;
  userMessage?: { content: string; timestamp: string };
  assistantMessages: AssistantMessage[];
  events: InlineEvent[];
}

export interface RawEvent {
  id: string;
  timestamp: string;
  parentId: string | null;
  type: string;
  data: Record<string, unknown>;
}

// ─── Utilities ────────────────────────────────────────────────────────────────

function getMcpServer(toolName: string): string | undefined {
  const prefixes: Record<string, string> = {
    'github-mcp-server-': 'GitHub',
    'playwright-': 'Playwright',
    'microsoft-learn-': 'Microsoft Learn',
    'Tavily-': 'Tavily',
  };
  for (const [prefix, label] of Object.entries(prefixes)) {
    if (toolName.startsWith(prefix)) return label;
  }
  return undefined;
}

function parseWorkspaceYaml(content: string): Record<string, string> {
  const result: Record<string, string> = {};
  for (const line of content.split('\n')) {
    const colonIdx = line.indexOf(':');
    if (colonIdx === -1) continue;
    const key = line.slice(0, colonIdx).trim();
    const value = line.slice(colonIdx + 1).trim();
    if (key) result[key] = value;
  }
  return result;
}

function truncateStr(s: string, max: number): string {
  return s.length > max ? s.slice(0, max) + '…' : s;
}

function truncateArgValues(args: unknown, max = 500): Record<string, unknown> {
  if (!args || typeof args !== 'object' || Array.isArray(args)) return {};
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(args as Record<string, unknown>)) {
    out[k] = typeof v === 'string' ? truncateStr(v, max) : v;
  }
  return out;
}

async function streamJsonl(filePath: string, onLine: (obj: RawEvent) => void): Promise<void> {
  return new Promise((resolve, reject) => {
    const rl = createInterface({
      input: createReadStream(filePath, { encoding: 'utf-8' }),
      crlfDelay: Infinity,
    });
    rl.on('line', (line) => {
      const trimmed = line.trim();
      if (!trimmed) return;
      try {
        onLine(JSON.parse(trimmed) as RawEvent);
      } catch {
        // skip malformed lines
      }
    });
    rl.on('close', resolve);
    rl.on('error', reject);
  });
}

// ─── Provider ─────────────────────────────────────────────────────────────────

export class SessionsProvider {
  private readonly sessionsPath: string;

  constructor(sessionsPath: string) {
    this.sessionsPath = sessionsPath;
  }

  private getSessionDir(id: string): string {
    return join(this.sessionsPath, id);
  }

  private readWorkspace(id: string): Record<string, string> | null {
    const yamlPath = join(this.getSessionDir(id), 'workspace.yaml');
    if (!existsSync(yamlPath)) return null;
    try {
      return parseWorkspaceYaml(readFileSync(yamlPath, 'utf-8'));
    } catch {
      return null;
    }
  }

  async listSessions(): Promise<SessionSummary[]> {
    if (!existsSync(this.sessionsPath)) return [];

    let entries: string[];
    try {
      entries = readdirSync(this.sessionsPath);
    } catch {
      return [];
    }

    const sessions: SessionSummary[] = [];

    for (const entry of entries) {
      const sessionDir = join(this.sessionsPath, entry);
      try {
        if (!statSync(sessionDir).isDirectory()) continue;
      } catch {
        continue;
      }

      const ws = this.readWorkspace(entry);
      if (!ws) continue;

      sessions.push({
        id: ws['id'] ?? entry,
        summary: ws['summary'] ?? '',
        branch: ws['branch'] ?? '',
        cwd: ws['cwd'] ?? '',
        gitRoot: ws['git_root'] ?? '',
        model: '',
        createdAt: ws['created_at'] ?? '',
        updatedAt: ws['updated_at'] ?? '',
      });
    }

    return sessions.sort((a, b) => {
      if (a.updatedAt > b.updatedAt) return -1;
      if (a.updatedAt < b.updatedAt) return 1;
      return 0;
    });
  }

  async getSession(id: string): Promise<SessionDetail | null> {
    const ws = this.readWorkspace(id);
    if (!ws) return null;

    const eventsPath = join(this.getSessionDir(id), 'events.jsonl');
    if (!existsSync(eventsPath)) {
      return {
        id: ws['id'] ?? id,
        summary: ws['summary'] ?? '',
        branch: ws['branch'] ?? '',
        cwd: ws['cwd'] ?? '',
        gitRoot: ws['git_root'] ?? '',
        createdAt: ws['created_at'] ?? '',
        updatedAt: ws['updated_at'] ?? '',
        stats: { turns: 0, toolCalls: 0, skills: 0, subagents: 0, errors: 0, compactions: 0, truncations: 0, duration: 0 },
        models: [],
        mcpServers: [],
        skillsUsed: [],
        toolBreakdown: [],
        subagentBreakdown: [],
        compactionEvents: [],
        truncationEvents: [],
        errorEvents: [],
      };
    }

    const stats: SessionStats = { turns: 0, toolCalls: 0, skills: 0, subagents: 0, errors: 0, compactions: 0, truncations: 0, duration: 0 };
    const modelsSet = new Set<string>();
    const mcpServersSet = new Set<string>();
    const skillsMap = new Map<string, number>();
    const toolMap = new Map<string, { count: number; successCount: number; failCount: number; durations: number[] }>();
    const toolStartTimes = new Map<string, number>();
    const subagentMap = new Map<string, number>();
    const compactionEvents: CompactionEvent[] = [];
    const truncationEvents: TruncationEvent[] = [];
    const errorEvents: ErrorEvent[] = [];
    let firstTs: number | null = null;
    let lastTs: number | null = null;

    await streamJsonl(eventsPath, (event) => {
      const ts = new Date(event.timestamp).getTime();
      if (!isNaN(ts)) {
        if (firstTs === null || ts < firstTs) firstTs = ts;
        if (lastTs === null || ts > lastTs) lastTs = ts;
      }

      const d = event.data ?? {};

      switch (event.type) {
        case 'session.start':
          if (typeof d['selectedModel'] === 'string') modelsSet.add(d['selectedModel']);
          break;
        case 'session.model_change':
          if (typeof d['newModel'] === 'string') modelsSet.add(d['newModel']);
          break;
        case 'session.info':
          if (d['infoType'] === 'mcp' && typeof d['message'] === 'string') {
            mcpServersSet.add(d['message']);
          }
          break;
        case 'session.compaction_start':
          stats.compactions++;
          compactionEvents.push({ timestamp: event.timestamp, preTokens: 0 });
          break;
        case 'session.compaction_complete': {
          const pre = typeof d['preCompactionTokens'] === 'number' ? d['preCompactionTokens'] : 0;
          const summary = typeof d['summaryContent'] === 'string' ? d['summaryContent'] : undefined;
          // update last compaction_start entry with actual token data
          const last = compactionEvents[compactionEvents.length - 1];
          if (last && last.preTokens === 0) {
            last.preTokens = pre;
            last.summaryContent = summary;
          } else {
            compactionEvents.push({ timestamp: event.timestamp, preTokens: pre, summaryContent: summary });
          }
          break;
        }
        case 'session.truncation': {
          const pre = typeof d['preTruncationTokensInMessages'] === 'number' ? d['preTruncationTokensInMessages'] : 0;
          const post = typeof d['postTruncationTokensInMessages'] === 'number' ? d['postTruncationTokensInMessages'] : 0;
          const tokensRemoved = typeof d['tokensRemovedDuringTruncation'] === 'number' ? d['tokensRemovedDuringTruncation'] : 0;
          const msgsRemoved = typeof d['messagesRemovedDuringTruncation'] === 'number' ? d['messagesRemovedDuringTruncation'] : 0;
          stats.truncations++;
          truncationEvents.push({ timestamp: event.timestamp, preTokens: pre, postTokens: post, tokensRemoved, messagesRemoved: msgsRemoved });
          break;
        }
        case 'session.error': {
          stats.errors++;
          errorEvents.push({
            timestamp: event.timestamp,
            errorType: typeof d['errorType'] === 'string' ? d['errorType'] : 'unknown',
            message: typeof d['message'] === 'string' ? d['message'] : '',
          });
          break;
        }
        case 'assistant.turn_start':
          stats.turns++;
          break;
        case 'tool.execution_start': {
          const callId = typeof d['toolCallId'] === 'string' ? d['toolCallId'] : '';
          if (callId) toolStartTimes.set(callId, ts);
          const toolName = typeof d['toolName'] === 'string' ? d['toolName'] : 'unknown';
          stats.toolCalls++;
          if (!toolMap.has(toolName)) toolMap.set(toolName, { count: 0, successCount: 0, failCount: 0, durations: [] });
          toolMap.get(toolName)!.count++;
          break;
        }
        case 'tool.execution_complete': {
          const callId = typeof d['toolCallId'] === 'string' ? d['toolCallId'] : '';
          const success = d['success'] !== false;
          const toolName = typeof d['toolName'] === 'string' ? d['toolName'] : '';

          // Infer toolName from start event if not in complete
          let resolvedName = toolName;
          if (!resolvedName) {
            // We'll track it via the toolStartTimes map — we need toolName from start
            // Since we don't have it here, skip the breakdown update for toolName
          }

          if (callId) {
            const startTime = toolStartTimes.get(callId);
            if (startTime && !isNaN(ts)) {
              const duration = ts - startTime;
              // find any tool entry — we need to match by callId
              // Since tool.execution_start already incremented, we update via toolName if available
            }
          }

          // For success/fail tracking we need tool name — it's in execution_start, not complete
          // We patch this below by matching on toolCallId via a separate map
          if (resolvedName && toolMap.has(resolvedName)) {
            if (success) toolMap.get(resolvedName)!.successCount++;
            else toolMap.get(resolvedName)!.failCount++;
          }
          break;
        }
        case 'skill.invoked': {
          stats.skills++;
          const name = typeof d['name'] === 'string' ? d['name'] : 'unknown';
          skillsMap.set(name, (skillsMap.get(name) ?? 0) + 1);
          break;
        }
        case 'subagent.started': {
          stats.subagents++;
          const agentName = typeof d['agentName'] === 'string' ? d['agentName'] : 'unknown';
          subagentMap.set(agentName, (subagentMap.get(agentName) ?? 0) + 1);
          break;
        }
      }
    });

    stats.duration = firstTs !== null && lastTs !== null ? lastTs - firstTs : 0;

    // Build toolBreakdown — do a second pass to properly match start/complete durations
    // Re-parse with toolCallId->toolName tracking
    const callIdToTool = new Map<string, string>();
    const toolDurations = new Map<string, number[]>();

    await streamJsonl(eventsPath, (event) => {
      const d = event.data ?? {};
      if (event.type === 'tool.execution_start') {
        const callId = typeof d['toolCallId'] === 'string' ? d['toolCallId'] : '';
        const toolName = typeof d['toolName'] === 'string' ? d['toolName'] : 'unknown';
        if (callId) callIdToTool.set(callId, toolName);
      } else if (event.type === 'tool.execution_complete') {
        const callId = typeof d['toolCallId'] === 'string' ? d['toolCallId'] : '';
        const startTime = toolStartTimes.get(callId);
        const ts = new Date(event.timestamp).getTime();
        if (callId && startTime && !isNaN(ts)) {
          const toolName = callIdToTool.get(callId);
          if (toolName) {
            if (!toolDurations.has(toolName)) toolDurations.set(toolName, []);
            toolDurations.get(toolName)!.push(ts - startTime);
          }
        }
      }
    });

    const toolBreakdown: ToolBreakdown[] = Array.from(toolMap.entries()).map(([name, data]) => {
      const durations = toolDurations.get(name) ?? [];
      const avgDuration = durations.length > 0 ? durations.reduce((a, b) => a + b, 0) / durations.length : 0;
      const mcpServer = getMcpServer(name);
      return {
        name,
        count: data.count,
        successCount: data.successCount,
        failCount: data.failCount,
        avgDuration,
        isMcp: mcpServer !== undefined,
        mcpServer,
      };
    });

    return {
      id: ws['id'] ?? id,
      summary: ws['summary'] ?? '',
      branch: ws['branch'] ?? '',
      cwd: ws['cwd'] ?? '',
      gitRoot: ws['git_root'] ?? '',
      createdAt: ws['created_at'] ?? '',
      updatedAt: ws['updated_at'] ?? '',
      stats,
      models: Array.from(modelsSet),
      mcpServers: Array.from(mcpServersSet),
      skillsUsed: Array.from(skillsMap.entries()).map(([name, count]) => ({ name, count })),
      toolBreakdown,
      subagentBreakdown: Array.from(subagentMap.entries()).map(([agentName, count]) => ({ agentName, count })),
      compactionEvents,
      truncationEvents,
      errorEvents,
    };
  }

  async getTimeline(id: string): Promise<Turn[]> {
    const eventsPath = join(this.getSessionDir(id), 'events.jsonl');
    if (!existsSync(eventsPath)) return [];

    const allEvents: RawEvent[] = [];
    await streamJsonl(eventsPath, (e) => allEvents.push(e));

    const turns: Turn[] = [];
    let currentTurn: Turn | null = null;

    // Maps for matching
    const toolStarts = new Map<string, { event: RawEvent; toolName: string; arguments: Record<string, unknown> }>();
    const subagentStarted = new Map<string, { agentName: string; agentDisplayName: string }>();

    // Index events by id for parent lookup
    const eventById = new Map<string, RawEvent>();
    for (const e of allEvents) eventById.set(e.id, e);

    // Helper: find which assistant.message an event belongs to
    function findParentMessageId(event: RawEvent): string | null {
      let current: RawEvent | undefined = event;
      while (current) {
        if (current.type === 'assistant.message') return current.id;
        if (!current.parentId) break;
        current = eventById.get(current.parentId);
      }
      return null;
    }

    // First pass: collect tool starts and subagent starts
    for (const e of allEvents) {
      const d = e.data ?? {};
      if (e.type === 'tool.execution_start') {
        const callId = typeof d['toolCallId'] === 'string' ? d['toolCallId'] : e.id;
        toolStarts.set(callId, {
          event: e,
          toolName: typeof d['toolName'] === 'string' ? d['toolName'] : 'unknown',
          arguments: typeof d['arguments'] === 'object' && d['arguments'] !== null ? d['arguments'] as Record<string, unknown> : {},
        });
      } else if (e.type === 'subagent.started') {
        const callId = typeof d['toolCallId'] === 'string' ? d['toolCallId'] : '';
        if (callId) {
          subagentStarted.set(callId, {
            agentName: typeof d['agentName'] === 'string' ? d['agentName'] : '',
            agentDisplayName: typeof d['agentDisplayName'] === 'string' ? d['agentDisplayName'] : '',
          });
        }
      }
    }

    // Build complete map: toolCallId -> ToolCall
    const toolCallMap = new Map<string, ToolCall>();
    const toolCallParentMsg = new Map<string, string>(); // toolCallId -> parentMessageId

    for (const [callId, start] of toolStarts) {
      const sub = subagentStarted.get(callId);
      const tc: ToolCall = {
        toolCallId: callId,
        toolName: start.toolName,
        arguments: truncateArgValues(start.arguments),
        isSubagent: sub !== undefined,
        subagentName: sub?.agentName,
        subagentDisplayName: sub?.agentDisplayName,
      };
      toolCallMap.set(callId, tc);
      const parentMsgId = findParentMessageId(start.event);
      if (parentMsgId) toolCallParentMsg.set(callId, parentMsgId);
    }

    // Process tool.execution_complete to fill in results
    for (const e of allEvents) {
      if (e.type !== 'tool.execution_complete') continue;
      const d = e.data ?? {};
      const callId = typeof d['toolCallId'] === 'string' ? d['toolCallId'] : '';
      const tc = toolCallMap.get(callId);
      if (!tc) continue;

      tc.success = d['success'] !== false;
      const result = d['result'];
      if (result && typeof result === 'object') {
        const r = result as Record<string, unknown>;
        const content = typeof r['content'] === 'string' ? r['content'] : JSON.stringify(r);
        tc.result = truncateStr(content, 500);
      }

      const startEvent = toolStarts.get(callId);
      if (startEvent) {
        const startTs = new Date(startEvent.event.timestamp).getTime();
        const endTs = new Date(e.timestamp).getTime();
        if (!isNaN(startTs) && !isNaN(endTs)) tc.duration = endTs - startTs;
      }
    }

    // Build assistant message map
    const assistantMessages = new Map<string, AssistantMessage>();
    for (const e of allEvents) {
      if (e.type !== 'assistant.message') continue;
      const d = e.data ?? {};
      const content = typeof d['content'] === 'string' ? truncateStr(d['content'], 2000) : '';
      const msgId = e.id;
      assistantMessages.set(msgId, {
        messageId: msgId,
        content,
        timestamp: e.timestamp,
        toolGroups: [],
      });
    }

    // Group tool calls into messages
    // Detect parallel: check toolRequests array in parent assistant.message
    for (const [callId, parentMsgId] of toolCallParentMsg) {
      const msg = assistantMessages.get(parentMsgId);
      if (!msg) continue;
      const tc = toolCallMap.get(callId);
      if (!tc) continue;

      // Find parent msg event to check toolRequests
      const msgEvent = eventById.get(parentMsgId);
      const toolRequests = msgEvent?.data?.['toolRequests'];
      const isParallel = Array.isArray(toolRequests) && toolRequests.length > 1;

      if (msg.toolGroups.length === 0) {
        msg.toolGroups.push({ parallel: isParallel, calls: [tc] });
      } else {
        // Add to existing group if same assistant message
        const lastGroup = msg.toolGroups[msg.toolGroups.length - 1];
        lastGroup.calls.push(tc);
        lastGroup.parallel = isParallel;
      }
    }

    // Now build turns by iterating events in order
    for (const e of allEvents) {
      const d = e.data ?? {};

      switch (e.type) {
        case 'assistant.turn_start': {
          currentTurn = {
            turnId: e.id,
            startTime: e.timestamp,
            assistantMessages: [],
            events: [],
          };
          turns.push(currentTurn);
          break;
        }
        case 'assistant.turn_end': {
          if (currentTurn) currentTurn.endTime = e.timestamp;
          break;
        }
        case 'user.message': {
          const content = typeof d['content'] === 'string' ? d['content'] : '';
          // Attach to current turn or create a synthetic turn
          if (currentTurn) {
            currentTurn.userMessage = { content, timestamp: e.timestamp };
          }
          break;
        }
        case 'assistant.message': {
          const msg = assistantMessages.get(e.id);
          if (msg && currentTurn) {
            currentTurn.assistantMessages.push(msg);
          }
          break;
        }
        case 'session.model_change':
        case 'session.mode_changed':
        case 'session.compaction_start':
        case 'session.compaction_complete':
        case 'session.error':
        case 'skill.invoked': {
          if (currentTurn) {
            currentTurn.events.push({ type: e.type, timestamp: e.timestamp, data: d as Record<string, unknown> });
          }
          break;
        }
      }
    }

    return turns;
  }

  async getEvents(id: string, typeFilter?: string): Promise<RawEvent[]> {
    const eventsPath = join(this.getSessionDir(id), 'events.jsonl');
    if (!existsSync(eventsPath)) return [];

    const events: RawEvent[] = [];
    const MAX = 5000;
    const CONTENT_MAX = 1000;

    await streamJsonl(eventsPath, (e) => {
      if (events.length >= MAX) return;
      if (typeFilter && e.type !== typeFilter) return;

      // Truncate large content fields
      const d = e.data ?? {};
      if (e.type === 'tool.execution_complete') {
        const result = d['result'];
        if (result && typeof result === 'object') {
          const r = result as Record<string, unknown>;
          if (typeof r['content'] === 'string') {
            r['content'] = truncateStr(r['content'], CONTENT_MAX);
          }
          if (typeof r['detailedContent'] === 'string') {
            r['detailedContent'] = truncateStr(r['detailedContent'], CONTENT_MAX);
          }
        }
      }
      if (e.type === 'assistant.message') {
        if (typeof d['content'] === 'string') {
          d['content'] = truncateStr(d['content'], CONTENT_MAX);
        }
      }
      if (e.type === 'skill.invoked') {
        // Omit content, keep name and content length
        if (typeof d['content'] === 'string') {
          const len = d['content'].length;
          d['content'] = undefined as unknown as string;
          (d as Record<string, unknown>)['contentLength'] = len;
        }
      }

      events.push(e);
    });

    return events;
  }
}
