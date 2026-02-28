// ─── Budget MCP Server — Sandboxed Code Execution ─────────────────────────
// Same model as backlog: node:vm with restricted globals.

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
  console_output?: string[];
}

export async function executeCode(
  budgetApi: unknown,
  request: ExecuteRequest,
): Promise<ExecuteResponse> {
  const startTime = Date.now();
  const timeout = request.timeout || 10000;  // 10s default (financial calculations can be heavier)

  try {
    const consoleOutput: string[] = [];

    const context: Context = {
      budget: budgetApi,
      console: {
        log: (...args: unknown[]) => { consoleOutput.push(args.map(String).join(" ")); },
        warn: (...args: unknown[]) => { consoleOutput.push(`[warn] ${args.map(String).join(" ")}`); },
        error: (...args: unknown[]) => { consoleOutput.push(`[error] ${args.map(String).join(" ")}`); },
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
      RegExp,
      Error,
      TypeError,
      RangeError,
      parseFloat,
      parseInt,
      isNaN,
      isFinite,
      undefined,
      NaN,
      Infinity,
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
      console_output: consoleOutput.length > 0 ? consoleOutput : undefined,
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
