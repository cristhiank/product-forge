// ─── Budget MCP Server ────────────────────────────────────────────────────
// 1 tool: `budget` — same architecture as backlog MCP server.

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { CallToolRequestSchema, ListToolsRequestSchema, type Tool } from "@modelcontextprotocol/sdk/types.js";
import { z } from "zod";

import { createBudgetAPI } from "../budget-api.js";
import { executeCode } from "../sandbox/index.js";
import { FileSystemBudgetStore } from "../storage/fs-store.js";

const TOOL_BUDGET: Tool = {
  name: "budget",
  description: `Execute JavaScript against the Lopez family budget API. The 'budget' object is available in scope.

API (all async — use return/await):
  config: .get() .getSetting(key) .setSetting(key,val) .getCopRate() .setCopRate(rate)
  income: .list() .get({id}) .update({id,field,value}) .add({id,member_id,description,type,gross_monthly,net_monthly,frequency})
  debts:  .list() .get({id}) .add({id?,description,type,current_balance,interest_rate_annual,minimum_payment,...}) .updateBalance({id,balance,note?}) .update({id,field,value}) .recalculatePayoff({id?}) .getPayoffPlan({id?})
  expenses: .list() .get({id}) .add({id?,description,category_id,amount,frequency?,auto_pay?,vendor?,notes?}) .update({id,field,value}) .remove({id}) .summary()
  allocations: .listAnnual() .listMonthly() .getAnnual({categoryId}) .setAnnual({categoryId,amount,notes?}) .setMonthly({categoryId,month,amount}) .validate()
  goals:  .list() .get({id}) .add({id?,description,target_amount,monthly_contribution?,...}) .update({id,field,value})
  analysis: .snapshot() .snapshotGet({metric}) .snapshotSet({metric,value,notes?}) .health() .strategy() .carAffordability() .houseAffordability() .projectHouseFund({startBalance,monthlyContribution,startMonth,months,annualYield?,extras?})
  audit() — cross-file validation
  actuals: .list({month?}) .add(entry) .addMany(entries[]) .update({txnId,field,value}) .remove({txnId})
  log: .list({limit?})
  help() — full API docs at runtime

Features: auto-generated IDs (expenses, debts, goals, actuals), category_id validation, cascade mutations.
Cascade: mutations auto-propagate (debts→payoff→snapshot→strategy→health). Never edit CSV files directly.

Examples:
  return budget.debts.updateBalance({ id: "DEBT-002", balance: 77000 })
  return budget.expenses.add({ description: "Netflix", category_id: "CAT-009", amount: 15.99, auto_pay: "yes", vendor: "Netflix" })
  return budget.actuals.update({ txnId: "TXN-005", field: "description", value: "Corrected description" })
  return budget.audit()`,
  inputSchema: {
    type: "object",
    properties: {
      code: {
        type: "string",
        description: "JavaScript code to execute. The 'budget' object is in scope. Use 'return' for output. All methods are async.",
      },
      timeout: {
        type: "number",
        description: "Execution timeout in ms (default 10000, max 60000)",
      },
    },
    required: ["code"],
  },
};

const TOOLS: Tool[] = [TOOL_BUDGET];

const CliArgsSchema = z.object({
  root: z.string().optional(),
  year: z.string().optional(),
  help: z.boolean().optional(),
});

function parseArgs(): z.infer<typeof CliArgsSchema> {
  const argv = process.argv.slice(2);
  const parsed: { root?: string; year?: string; help?: boolean } = {};

  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--help" || a === "-h") { parsed.help = true; continue; }
    if (a === "serve") continue;  // skip subcommand

    if (a === "--root" && argv[i + 1]) { parsed.root = argv[i + 1]; i++; continue; }
    if (a.startsWith("--root=")) { parsed.root = a.substring("--root=".length); continue; }

    if (a === "--year" && argv[i + 1]) { parsed.year = argv[i + 1]; i++; continue; }
    if (a.startsWith("--year=")) { parsed.year = a.substring("--year=".length); continue; }
  }

  return CliArgsSchema.parse(parsed);
}

function printHelp(): void {
  console.error(`budget MCP server (stdio)

Usage:
  node dist/cli.js serve --root <path> --year <year>
  node dist/cli.js --help

Options:
  --root <path>   Finance root directory (default: ./finance)
  --year <year>   Budget year (default: current year)
  -h, --help      Show this help
`);
}

async function handleToolCall(
  budgetApi: ReturnType<typeof createBudgetAPI>,
  name: string,
  args: Record<string, unknown>,
): Promise<{ content: Array<{ type: "text"; text: string }> }> {
  const result = (data: unknown) => ({
    content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }],
  });

  const error = (message: string) => ({
    content: [{ type: "text" as const, text: JSON.stringify({ error: message }) }],
    isError: true,
  });

  try {
    switch (name) {
      case "budget": {
        const code = args.code as string | undefined;
        if (!code) {
          return error("code is required. Use budget.help() for API documentation.");
        }

        let timeout = (args.timeout as number) || 10000;
        if (timeout > 60000) timeout = 60000;
        if (timeout < 100) timeout = 100;

        const response = await executeCode(budgetApi, { code, timeout });

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
          hint: "Use budget.help() for API documentation",
        });
      }
      default:
        return error(`Unknown tool: ${name}. Available tools: budget`);
    }
  } catch (err) {
    return error(err instanceof Error ? err.message : String(err));
  }
}

export async function createServer(root: string, year: string): Promise<Server> {
  const store = new FileSystemBudgetStore({ root, year });
  const budgetApi = createBudgetAPI(store);

  const server = new Server(
    { name: "agent-collab-budget", version: "0.1.0" },
    {
      capabilities: {
        tools: {},
      },
    },
  );

  server.setRequestHandler(ListToolsRequestSchema, async () => ({ tools: TOOLS }));

  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: toolArgs } = request.params;
    return handleToolCall(budgetApi, name, (toolArgs || {}) as Record<string, unknown>);
  });

  return server;
}

export async function main(): Promise<void> {
  const cliArgs = parseArgs();
  if (cliArgs.help) {
    printHelp();
    return;
  }

  const root = cliArgs.root || process.env.BUDGET_ROOT || "./finance";
  const year = cliArgs.year || process.env.BUDGET_YEAR || String(new Date().getFullYear());

  console.error(`[agent-collab-budget] Finance root: ${root}`);
  console.error(`[agent-collab-budget] Year: ${year}`);
  console.error(`[agent-collab-budget] Architecture: 1 tool (budget)`);

  const server = await createServer(root, year);
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(console.error);
}
