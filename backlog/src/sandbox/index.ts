/**
 * Backlog MCP Server - Sandboxed Code Execution
 *
 * Reuses the same sandbox model as agents-board:
 * - node:vm runInNewContext
 * - restricted globals
 * - async wrapper
 * - timeout enforcement
 */

import { runInNewContext, type Context } from "node:vm";

export interface ExecuteRequest {
  code: string;
  timeout?: number;
}

export interface ExecuteResponse {
  success: boolean;
  result?: unknown;
  error?: string;
  execution_time_ms: number;
}

export async function executeCode(
  backlogApi: unknown,
  request: ExecuteRequest
): Promise<ExecuteResponse> {
  const startTime = Date.now();
  const timeout = request.timeout || 5000;

  try {
    const context: Context = {
      backlog: backlogApi,
      console: {
        log: () => {},
        warn: () => {},
        error: () => {},
      },
      JSON,
      Math,
      Date,
      Array,
      Object,
      String,
      Number,
      Boolean,
      Map,
      Set,
      Promise,
    };

    const wrappedCode = `
      (async () => {
        ${request.code}
      })()
    `;

    const result = await runInNewContext(wrappedCode, context, {
      timeout,
      displayErrors: false,
    });

    return {
      success: true,
      result,
      execution_time_ms: Date.now() - startTime,
    };
  } catch (err) {
    const raw = err instanceof Error ? err.message : String(err);
    let clean = raw;
    if (raw.includes("Script execution timed out")) {
      clean = `Execution timed out after ${timeout}ms. Simplify your code or increase timeout.`;
    }
    return {
      success: false,
      error: clean,
      execution_time_ms: Date.now() - startTime,
    };
  }
}
