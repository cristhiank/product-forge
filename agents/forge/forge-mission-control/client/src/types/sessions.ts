export interface SessionSummary {
  id: string;
  summary: string;
  branch: string;
  cwd: string;
  gitRoot: string;
  createdAt: string;
  updatedAt: string;
}

export interface SessionDetail {
  id: string;
  summary: string;
  branch: string;
  cwd: string;
  gitRoot: string;
  createdAt: string;
  updatedAt: string;
  stats: {
    turns: number;
    toolCalls: number;
    skills: number;
    subagents: number;
    errors: number;
    compactions: number;
    truncations: number;
    duration: number; // ms
  };
  models: string[];
  mcpServers: string[];
  skillsUsed: { name: string; count: number }[];
  toolBreakdown: {
    name: string;
    count: number;
    successCount: number;
    failCount: number;
    avgDuration: number;
    isMcp: boolean;
    mcpServer?: string;
  }[];
  subagentBreakdown: { agentName: string; count: number }[];
  compactionEvents: {
    timestamp: string;
    preTokens: number;
    postTokens?: number;
    summaryContent?: string;
  }[];
  truncationEvents: {
    timestamp: string;
    preTokens: number;
    postTokens: number;
    tokensRemoved: number;
    messagesRemoved: number;
  }[];
  errorEvents: { timestamp: string; errorType: string; message: string }[];
}

export interface Turn {
  turnId: string;
  startTime: string;
  endTime?: string;
  userMessage?: { content: string; timestamp: string };
  assistantMessages: AssistantMessage[];
  events: InlineEvent[];
}

export interface AssistantMessage {
  messageId: string;
  content: string;
  timestamp: string;
  toolGroups: ToolCallGroup[];
}

export interface ToolCallGroup {
  parallel: boolean;
  calls: ToolCall[];
}

export interface ToolCall {
  toolCallId: string;
  toolName: string;
  arguments: unknown;
  success?: boolean;
  result?: string;
  duration?: number;
  isSubagent: boolean;
  subagentName?: string;
  subagentDisplayName?: string;
}

export interface InlineEvent {
  type: string;
  timestamp: string;
  data: Record<string, unknown>;
}
