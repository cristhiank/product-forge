/**
 * Backlog MCP Server
 *
 * Minimal Architecture (1 tool):
 * - `backlog` - Everything via code execution against the injected backlog API.
 */

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { CallToolRequestSchema, ListToolsRequestSchema, type Tool } from "@modelcontextprotocol/sdk/types.js";
import { z } from "zod";

import { createBacklogAPI } from "../backlog-api.js";
import { executeCode } from "../sandbox/index.js";
import { FileSystemBacklogStore } from "../storage/fs-store.js";

const TOOL_BACKLOG: Tool = {
  name: "backlog",
  description: `Execute JavaScript code against the backlog API. All backlog operations are available via the 'backlog' object.

Quick access:
- backlog.help()

Example:
  code: "return backlog.list({ folder: 'next', limit: 20 })"`,
  inputSchema: {
    type: "object",
    properties: {
      code: {
        type: "string",
        description: "JavaScript code to execute. Use 'return' to return a value. The 'backlog' object provides all operations. Use backlog.help() for API docs.",
      },
      timeout: {
        type: "number",
        description: "Execution timeout in ms (default 5000, max 30000)",
      },
    },
    required: ["code"],
  },
};

const TOOLS: Tool[] = [TOOL_BACKLOG];

const CliArgsSchema = z.object({
  root: z.string().optional(),
  help: z.boolean().optional(),
});

function parseArgs(): z.infer<typeof CliArgsSchema> {
  const argv = process.argv.slice(2);
  const parsed: { root?: string; help?: boolean } = {};

  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];

    if (a === "--help" || a === "-h") {
      parsed.help = true;
      continue;
    }

    if (a === "--root" && argv[i + 1]) {
      parsed.root = argv[i + 1];
      i++;
      continue;
    }
    if (a.startsWith("--root=")) {
      parsed.root = a.substring("--root=".length);
      continue;
    }
  }

  return CliArgsSchema.parse(parsed);
}

function printHelp(): void {
  // Intentionally small (keep parity with agents-board which is stdio-first)
  console.error(`backlog MCP server (stdio)

Usage:
  node dist/cli.js serve --root <path>
  node dist/cli.js --help

Options:
  --root <path>   Backlog root directory (default: app/.backlog)
  -h, --help      Show this help
`);
}

async function handleToolCall(
  backlogApi: ReturnType<typeof createBacklogAPI>,
  name: string,
  args: Record<string, unknown>
): Promise<{ content: Array<{ type: "text"; text: string }> }> {
  const result = (data: unknown) => ({
    content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }],
  });

  const error = (message: string) => ({
    content: [{ type: "text" as const, text: JSON.stringify({ error: message }) }],
  });

  try {
    switch (name) {
      case "backlog": {
        const code = args.code as string | undefined;
        if (!code) {
          return error("code is required. Use backlog.help() for API documentation.");
        }

        let timeout = (args.timeout as number) || 5000;
        if (timeout > 30000) timeout = 30000;
        if (timeout < 100) timeout = 100;

        const response = await executeCode(backlogApi, { code, timeout });

        if (response.success) {
          return result({
            success: true,
            result: response.result,
            execution_time_ms: response.execution_time_ms,
          });
        }

        return result({
          success: false,
          error: response.error,
          execution_time_ms: response.execution_time_ms,
          hint: "Use backlog.help() for API documentation",
        });
      }
      default:
        return error(`Unknown tool: ${name}. Available tools: backlog`);
    }
  } catch (err) {
    return error(err instanceof Error ? err.message : String(err));
  }
}

export async function createServer(backlogRoot: string): Promise<Server> {
  if (TOOLS.length !== 1 || TOOLS[0]?.name !== "backlog") {
    throw new Error("Invariant: backlog MCP server must expose exactly one tool named 'backlog'");
  }

  const store = new FileSystemBacklogStore({ root: backlogRoot });
  const backlogApi = createBacklogAPI(store);

  const server = new Server(
    { name: "agent-collab-backlog", version: "0.1.0" },
    {
      capabilities: {
        tools: {},
      },
    }
  );

  server.setRequestHandler(ListToolsRequestSchema, async () => ({ tools: TOOLS }));

  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: toolArgs } = request.params;
    return handleToolCall(backlogApi, name, (toolArgs || {}) as Record<string, unknown>);
  });

  return server;
}

export async function main(): Promise<void> {
  const cliArgs = parseArgs();
  if (cliArgs.help) {
    printHelp();
    return;
  }
  const backlogRoot = cliArgs.root || process.env.BACKLOG_ROOT || "app/.backlog";

  console.error(`[agent-collab-backlog] Backlog root: ${backlogRoot}`);
  console.error(`[agent-collab-backlog] Minimal Architecture: 1 tool (backlog)`);

  const server = await createServer(backlogRoot);
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(console.error);
}
