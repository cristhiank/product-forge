/**
 * Agent Collaboration Board - MCP Server
 *
 * Model Context Protocol server exposing board operations as tools.
 *
 * Minimal Architecture (2 tools):
 * - `task` - Task lifecycle (operation: create/list/archive)
 * - `board` - Everything via code execution (facts, decisions, search, etc.)
 *
 * All board operations go through code execution using the sandboxed board API.
 * Use board.help() for API documentation, board.view() for quick status.
 */

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
    CallToolRequestSchema,
    ListResourcesRequestSchema,
    ListToolsRequestSchema,
    ReadResourceRequestSchema,
    type Tool,
} from "@modelcontextprotocol/sdk/types.js";
import { getBoardManager, resetBoardManager } from "../manager/index.js";
import { executeCode } from "../sandbox/index.js";
import type { AgentRole, TaskId } from "../types/core.js";

// ============================================================
// MINIMAL TOOL DEFINITIONS (2 tools)
// ============================================================

const TOOLS: Tool[] = [
  // ============================================================
  // TASK (consolidated create/list/archive)
  // ============================================================
  {
    name: "task",
    description: `Manage tasks. Operations:
- create: Create new task (returns task_id for subsequent operations)
- list: List all tasks with status
- archive: Archive completed/cancelled task`,
    inputSchema: {
      type: "object",
      properties: {
        operation: {
          type: "string",
          enum: ["create", "list", "archive"],
          description: "Task operation to perform",
        },
        // For create operation
        goal: { type: "string", description: "[create] The main goal of the task" },
        context: { type: "string", description: "[create] Additional context" },
        constraints: {
          type: "array",
          items: { type: "string" },
          description: "[create] List of constraints",
        },
        // For archive operation
        task_id: { type: "string", description: "[archive] The task ID to archive" },
      },
      required: ["operation"],
    },
  },

  // ============================================================
  // BOARD (code execution for everything)
  // ============================================================
  {
    name: "board",
    description: `Execute JavaScript code against the board API. All board operations are available via the 'board' object.

Quick access:
- board.help() - Get full API documentation
- board.view() - Get quick board status
- board.view("minimal", agent) - Get agent-specific view
- board.view("enhanced", agent, options) - Get graph-powered view

Common operations:
- board.getFacts(filter?) - List facts
- board.getDecisions(filter?) - List decisions
- board.getAlerts(filter?) - List alerts
- board.addFact({ content, confidence, evidence }) - Add fact
- board.proposeDecision({ title, description, rationale }) - Propose decision
- board.raiseAlert({ severity, title, description }) - Raise alert

Example: Get status and high-confidence facts
  code: "const status = board.view(); const facts = board.getFacts({ confidence: ['high'] }); return { status, facts };"

Example: Add a fact with evidence
  code: "return board.addFact({ content: 'API uses JWT', confidence: 'high', evidence: [{ type: 'file', reference: 'src/auth.ts' }] });"`,
    inputSchema: {
      type: "object",
      properties: {
        task_id: { type: "string", description: "The task ID" },
        agent: {
          type: "string",
          enum: ["orchestrator", "scout", "creative", "verifier", "executor"],
          description: "The agent executing the code (determines write permissions)",
        },
        code: {
          type: "string",
          description: "JavaScript code to execute. Use 'return' to return a value. The 'board' object provides all operations. Use board.help() for full API docs.",
        },
        timeout: {
          type: "number",
          description: "Execution timeout in ms (default 5000, max 30000)",
        },
      },
      required: ["task_id", "agent", "code"],
    },
  },
];

// ============================================================
// TOOL HANDLERS
// ============================================================

async function handleToolCall(
  name: string,
  args: Record<string, unknown>
): Promise<{ content: Array<{ type: "text"; text: string }> }> {
  const manager = getBoardManager(_projectPath);

  const result = (data: unknown) => ({
    content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }],
  });

  const error = (message: string) => ({
    content: [{ type: "text" as const, text: JSON.stringify({ error: message }) }],
  });

  try {
    switch (name) {
      // ============================================================
      // TASK (consolidated)
      // ============================================================
      case "task": {
        const operation = args.operation as string;

        switch (operation) {
          case "create": {
            if (!args.goal) {
              return error("goal is required for task create");
            }
            const { summary } = manager.createTask({
              goal: args.goal as string,
              context: args.context as string | undefined,
              constraints: args.constraints as string[] | undefined,
            });
            return result({ success: true, ...summary });
          }

          case "list": {
            const tasks = manager.listTasks();
            return result({ tasks, total: tasks.length });
          }

          case "archive": {
            if (!args.task_id) {
              return error("task_id is required for task archive");
            }
            manager.archiveTask(args.task_id as TaskId);
            return result({ success: true, archived: args.task_id });
          }

          default:
            return error(`Unknown task operation: ${operation}. Use: create, list, archive`);
        }
      }

      // ============================================================
      // BOARD (code execution)
      // ============================================================
      case "board": {
        if (!args.task_id) {
          return error("task_id is required. Use task({ operation: 'list' }) to see available tasks.");
        }

        const board = (() => {
          try {
            return manager.getBoard(args.task_id as TaskId);
          } catch {
            return null;
          }
        })();

        if (!board || !board.exists()) {
          return error(`Task ${args.task_id} not found. Use task({ operation: 'list' }) to see available tasks.`);
        }

        if (!args.agent) {
          return error("agent is required for board operations");
        }

        if (!args.code) {
          return error("code is required. Use board.help() for API documentation.");
        }

        // Enforce timeout limits
        let timeout = (args.timeout as number) || 5000;
        if (timeout > 30000) timeout = 30000;
        if (timeout < 100) timeout = 100;

        const response = await executeCode(board, {
          code: args.code as string,
          agent: args.agent as AgentRole,
          timeout,
        });

        if (response.success) {
          return result({
            success: true,
            result: response.result,
            execution_time_ms: response.execution_time_ms,
          });
        } else {
          return result({
            success: false,
            error: response.error,
            execution_time_ms: response.execution_time_ms,
            hint: "Use board.help() for API documentation",
          });
        }
      }

      default:
        return error(`Unknown tool: ${name}. Available tools: task, board`);
    }
  } catch (err) {
    return error(err instanceof Error ? err.message : String(err));
  }
}

// ============================================================
// SERVER SETUP
// ============================================================

function detectProjectPath(explicitPath?: string): string {
  if (explicitPath) return explicitPath;
  const envPath = process.env.AGENT_COLLAB_PROJECT;
  if (envPath) return envPath;
  return process.cwd();
}

function parseArgs(): { path?: string } {
  const args = process.argv.slice(2);
  const result: { path?: string } = {};

  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--path" && args[i + 1]) {
      result.path = args[i + 1];
      i++;
    } else if (args[i].startsWith("--path=")) {
      result.path = args[i].substring(7);
    }
  }

  return result;
}

let _projectPath: string | undefined;

export async function createServer(projectPath?: string): Promise<Server> {
  _projectPath = projectPath;

  if (projectPath) {
    getBoardManager(projectPath);
  }

  const server = new Server(
    {
      name: "agent-collab-board",
      version: "0.3.0",
    },
    {
      capabilities: {
        tools: {},
        resources: {},
      },
    }
  );

  // List tools
  server.setRequestHandler(ListToolsRequestSchema, async () => ({
    tools: TOOLS,
  }));

  // Call tool
  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args } = request.params;
    return handleToolCall(name, (args || {}) as Record<string, unknown>);
  });

  // List resources (board files for each task)
  server.setRequestHandler(ListResourcesRequestSchema, async () => {
    const manager = getBoardManager(_projectPath);
    const tasks = manager.listTasks();

    const resources: Array<{
      uri: string;
      name: string;
      description: string;
      mimeType: string;
    }> = [];

    const resourceTypes = [
      { type: "meta", name: "Metadata", description: "Board metadata including task ID, phase, and sequences" },
      { type: "mission", name: "Mission", description: "Task goal, constraints, and routing information" },
      { type: "facts", name: "Facts", description: "All discovered facts" },
      { type: "decisions", name: "Decisions", description: "All decisions (proposed, approved, rejected)" },
      { type: "plan", name: "Plan", description: "Execution plan with steps" },
      { type: "status", name: "Status", description: "Current board status" },
      { type: "alerts", name: "Alerts", description: "All alerts" },
      { type: "audit", name: "Audit Log", description: "Full audit trail of all operations" },
    ];

    for (const task of tasks) {
      for (const rt of resourceTypes) {
        resources.push({
          uri: `board://${task.task_id}/${rt.type}`,
          name: `[${task.task_id}] ${rt.name}`,
          description: rt.description,
          mimeType: "application/json",
        });
      }
    }

    return { resources };
  });

  // Read resource
  server.setRequestHandler(ReadResourceRequestSchema, async (request) => {
    const manager = getBoardManager(_projectPath);
    const uri = request.params.uri;

    const match = uri.match(/^board:\/\/([^/]+)\/(.+)$/);
    if (!match) {
      throw new Error(`Invalid resource URI format: ${uri}. Expected board://<task_id>/<type>`);
    }

    const [, taskId, resourceType] = match;

    if (!manager.taskExists(taskId as TaskId)) {
      throw new Error(`Task ${taskId} does not exist. Use task({ operation: 'list' }) to see available tasks.`);
    }

    const board = manager.getBoard(taskId as TaskId);
    if (!board.exists()) {
      throw new Error(`Board for task ${taskId} does not exist`);
    }

    let data: unknown;

    switch (resourceType) {
      case "meta":
        data = board.getBoard().meta;
        break;
      case "mission":
        data = board.getMission();
        break;
      case "facts":
        data = board.getFacts();
        break;
      case "decisions":
        data = board.getDecisions();
        break;
      case "plan":
        data = board.getPlan();
        break;
      case "status":
        data = board.getStatus();
        break;
      case "alerts":
        data = board.getAlerts();
        break;
      case "audit":
        data = board.getAuditLog();
        break;
      default:
        throw new Error(`Unknown resource type: ${resourceType}`);
    }

    return {
      contents: [
        {
          uri,
          mimeType: "application/json",
          text: JSON.stringify(data, null, 2),
        },
      ],
    };
  });

  return server;
}

// ============================================================
// MAIN ENTRY POINT
// ============================================================

export async function main(): Promise<void> {
  const cliArgs = parseArgs();
  const projectPath = detectProjectPath(cliArgs.path);

  console.error(`[agent-collab-board] Project path: ${projectPath}`);
  console.error(`[agent-collab-board] Minimal Architecture: 2 tools (task, board)`);

  const server = await createServer(projectPath);
  const transport = new StdioServerTransport();
  await server.connect(transport);

  process.on("SIGINT", () => {
    resetBoardManager();
    process.exit(0);
  });
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(console.error);
}
