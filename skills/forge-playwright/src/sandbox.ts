/**
 * Sandbox — exec mode for forge-playwright.
 * Exposes pw.profiles, pw.config, pw.discovery as sandboxed API.
 */

import { runInNewContext, type Context } from "node:vm";
import type { ExecRequest, ExecResponse } from "./types.js";

const DEFAULT_TIMEOUT = 10_000;

export interface PlaywrightAPI {
  profiles: {
    list: () => string[];
    load: (name: string) => unknown;
    render: (name: string) => string;
  };
  config: {
    recommend: () => unknown;
    validate: (args: string[]) => unknown;
  };
  project: {
    show: () => unknown;
    init: (targetDir: string) => unknown;
  };
  initPages: {
    list: () => string[];
    load: (name: string) => unknown;
  };
}

export async function executeCode(
  api: PlaywrightAPI,
  request: ExecRequest,
): Promise<ExecResponse> {
  const startTime = Date.now();
  const timeout = request.timeout ?? DEFAULT_TIMEOUT;

  try {
    const context: Context = {
      pw: api,
      console: {
        log: (..._args: unknown[]) => {},
        warn: (..._args: unknown[]) => {},
        error: (..._args: unknown[]) => {},
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
      parseInt,
      parseFloat,
      isNaN,
      isFinite,
      undefined,
      NaN,
      Infinity,
    };

    const wrappedCode = `(async () => { ${request.code} })()`;

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
    const message = err instanceof Error ? err.message : String(err);
    let cleanError = message;

    if (message.includes("Script execution timed out")) {
      cleanError = `Execution timed out after ${timeout}ms.`;
    }

    return {
      success: false,
      error: cleanError,
      execution_time_ms: Date.now() - startTime,
    };
  }
}
