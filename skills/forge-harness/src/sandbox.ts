import { runInNewContext, type Context } from "node:vm";
import type { ExecRequest, ExecResponse } from "./types.js";
import { MetricsStore } from "./metrics.js";
import { GcScanner } from "./gc-scanner.js";
import { ChangelogManager } from "./changelog.js";
import { HealthChecker } from "./health.js";

const DEFAULT_TIMEOUT = 10_000;

export interface HarnessAPI {
  metrics: {
    log: (opts: Record<string, unknown>) => unknown;
    query: (opts?: Record<string, unknown>) => unknown;
    summary: (opts?: Record<string, unknown>) => unknown;
    aggregateByMode: () => unknown;
  };
  gc: {
    scan: (opts: Record<string, unknown>) => unknown;
    getFindings: (opts?: Record<string, unknown>) => unknown;
    clearFindings: (opts?: Record<string, unknown>) => unknown;
  };
  changelog: {
    add: (opts: Record<string, unknown>) => unknown;
    show: (opts?: Record<string, unknown>) => unknown;
    recent: (opts?: Record<string, unknown>) => unknown;
    init: () => unknown;
  };
  health: (() => unknown) & {
    suggestGc: () => unknown;
  };
}

export function createHarnessAPI(
  metrics: MetricsStore,
  gc: GcScanner,
  changelog: ChangelogManager,
): HarnessAPI {
  const healthChecker = new HealthChecker(metrics, gc);

  const healthFn = () => healthChecker.check();
  healthFn.suggestGc = () => healthChecker.suggestGc();

  return {
    metrics: {
      log: (opts) => metrics.log(opts as never),
      query: (opts) => metrics.query(opts as never),
      summary: (opts) => metrics.summary(opts as never),
      aggregateByMode: () => metrics.aggregateByMode(),
    },
    gc: {
      scan: (opts) => gc.scan(opts as never),
      getFindings: (opts) => gc.getFindings(opts as never),
      clearFindings: (opts) => gc.clearFindings(opts as never),
    },
    changelog: {
      add: (opts) => changelog.add(opts as never),
      show: (opts) => changelog.show(opts as never),
      recent: (opts) => changelog.recent(opts as never),
      init: () => changelog.init(),
    },
    health: healthFn as HarnessAPI["health"],
  };
}

export async function executeCode(
  api: HarnessAPI,
  request: ExecRequest,
): Promise<ExecResponse> {
  const startTime = Date.now();
  const timeout = request.timeout ?? DEFAULT_TIMEOUT;

  try {
    const context: Context = {
      harness: api,
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
      cleanError = `Execution timed out after ${timeout}ms. Simplify your code or increase --timeout.`;
    }

    return {
      success: false,
      error: cleanError,
      execution_time_ms: Date.now() - startTime,
    };
  }
}
