/**
 * Budget Engine - CLI Entry Point
 * 
 * Dual-mode CLI for budget operations:
 * 1. Command mode: Direct operations via flags
 * 2. Exec mode: JavaScript composition via sandbox
 */

import { createBudgetAPI } from "./budget-api.js";
import { executeCode } from "./sandbox/index.js";
import { FileSystemBudgetStore } from "./storage/fs-store.js";
import * as path from "node:path";
import * as os from "node:os";

// ============================================================
// TYPES
// ============================================================

interface ParsedArgs {
  command: string;
  flags: Map<string, string>;
  positional: string[];
}

// ============================================================
// ARG PARSING
// ============================================================

function parseArgs(argv: string[]): ParsedArgs {
  const flags = new Map<string, string>();
  const positional: string[] = [];
  let command = "";

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];

    if (arg.startsWith("--")) {
      // Flag: --key value or --key=value
      const flagName = arg.slice(2);
      if (flagName.includes("=")) {
        const [key, ...valueParts] = flagName.split("=");
        flags.set(key, valueParts.join("="));
      } else if (i + 1 < argv.length && !argv[i + 1].startsWith("--")) {
        flags.set(flagName, argv[i + 1]);
        i++;
      } else {
        flags.set(flagName, "true");
      }
    } else if (!command) {
      command = arg;
    } else {
      positional.push(arg);
    }
  }

  return { command, flags, positional };
}

function getFlag(flags: Map<string, string>, key: string): string | undefined {
  return flags.get(key);
}

function requireFlag(flags: Map<string, string>, key: string): string {
  const value = flags.get(key);
  if (!value) {
    throw new Error(`Missing required flag: --${key}`);
  }
  return value;
}

// ============================================================
// OUTPUT HELPERS
// ============================================================

function success(data: unknown): void {
  console.log(JSON.stringify({ success: true, data }, null, 2));
  process.exit(0);
}

function error(message: string): never {
  console.error(JSON.stringify({ success: false, error: message }, null, 2));
  process.exit(1);
}

// ============================================================
// HELP TEXT
// ============================================================

const HELP_TEXT = `
Budget Engine CLI

USAGE:
  node dist/skill-cli.js <command> [--flags]

GLOBAL FLAGS:
  --root <path>      Finance root directory (default: ~/budget/finance)
  --year <year>      Budget year (default: current year)
  --help, -h         Show this help message

MODES:
  1. Command mode: Direct operations via flags
  2. Exec mode: JavaScript composition via sandbox

COMMANDS:

  help               Show this help message

  exec               Execute JavaScript code in sandbox
    --code <js>      JavaScript code to execute (required)
    --timeout <ms>   Timeout in milliseconds (default: 5000)

  DEBTS:
    list-debts       List all debts
    update-balance   Update debt balance
      --id <id>      Debt ID (required)
      --balance <n>  New balance (required)
      --note <text>  Update note
    add-debt         Add a new debt
      --description  Debt description (required)
      --type         Debt type (required)
      --balance      Initial balance (required)
      --rate         Interest rate (required)
      --payment      Minimum payment (required)
      --lender       Lender name
      --notes        Additional notes
    payoff-plan      Get debt payoff plan
      --id <id>      Debt ID (required)

  INCOME:
    list-income      List all income sources

  EXPENSES:
    list-expenses    List all expenses
    expense-summary  Get expense summary
    add-expense      Add a new expense
      --description  Expense description (required)
      --category-id  Category ID (required)
      --amount       Amount (required)
      --vendor       Vendor name
      --auto-pay     Auto-pay (true/false)
      --notes        Additional notes

  GOALS:
    list-goals       List all financial goals
    add-goal         Add a new goal
      --description  Goal description (required)
      --target       Target amount (required)
      --contribution Monthly contribution (required)
      --priority     Priority (1-10)

  TRANSACTIONS:
    add-transaction  Add an actual transaction
      --date         Transaction date (YYYY-MM-DD) (required)
      --type         Type: income|expense|debt|goal (required)
      --category-id  Category ID (required)
      --description  Description (required)
      --amount       Amount (required)
      --method       Payment method
      --notes        Additional notes

  ANALYSIS:
    health           Get budget health status
    snapshot         Get current financial snapshot
    strategy         Get debt payoff strategy
    validate         Validate budget allocations
    audit            Run budget audit
    log              View audit log
      --limit <n>    Number of entries (default: 20)

EXAMPLES:

  # List all debts
  node dist/skill-cli.js list-debts

  # Update debt balance
  node dist/skill-cli.js update-balance --id debt-001 --balance 5000 --note "Paid down"

  # Get budget health
  node dist/skill-cli.js health --year 2024

  # Execute custom code
  node dist/skill-cli.js exec --code "return budget.debts.list()"

  # Add a new expense
  node dist/skill-cli.js add-expense --description "Internet" --category-id utilities \\
    --amount 80 --vendor "Comcast" --auto-pay true

  # Get payoff plan for a debt
  node dist/skill-cli.js payoff-plan --id debt-001

ENVIRONMENT VARIABLES:
  BUDGET_ROOT        Finance root directory
  BUDGET_YEAR        Budget year
`;

// ============================================================
// STORE INITIALIZATION
// ============================================================

function createStore(flags: Map<string, string>) {
  const root = getFlag(flags, "root") || 
    process.env.BUDGET_ROOT || 
    path.join(os.homedir(), "budget", "finance");
  
  const year = getFlag(flags, "year") || 
    process.env.BUDGET_YEAR || 
    String(new Date().getFullYear());

  return new FileSystemBudgetStore({ root, year });
}

// ============================================================
// COMMAND HANDLERS
// ============================================================

async function handleExec(flags: Map<string, string>): Promise<void> {
  const code = requireFlag(flags, "code");
  const timeoutStr = getFlag(flags, "timeout");
  const timeout = timeoutStr ? parseInt(timeoutStr, 10) : 5000;

  const store = createStore(flags);
  const budget = createBudgetAPI(store);

  const result = await executeCode(budget, { code, timeout });
  success(result);
}

async function handleListDebts(flags: Map<string, string>): Promise<void> {
  const store = createStore(flags);
  const budget = createBudgetAPI(store);
  
  const debts = await budget.debts.list();
  success(debts);
}

async function handleUpdateBalance(flags: Map<string, string>): Promise<void> {
  const id = requireFlag(flags, "id");
  const balanceStr = requireFlag(flags, "balance");
  const balance = parseFloat(balanceStr);
  const note = getFlag(flags, "note");

  if (isNaN(balance)) {
    error("Invalid balance value");
  }

  const store = createStore(flags);
  const budget = createBudgetAPI(store);
  
  const result = await budget.debts.updateBalance({ id, balance, note });
  success(result);
}

async function handleAddDebt(flags: Map<string, string>): Promise<void> {
  const description = requireFlag(flags, "description");
  const type = requireFlag(flags, "type");
  const balanceStr = requireFlag(flags, "balance");
  const rateStr = requireFlag(flags, "rate");
  const paymentStr = requireFlag(flags, "payment");

  const balance = parseFloat(balanceStr);
  const rate = parseFloat(rateStr);
  const payment = parseFloat(paymentStr);

  if (isNaN(balance) || isNaN(rate) || isNaN(payment)) {
    error("Invalid numeric values for balance, rate, or payment");
  }

  const lender = getFlag(flags, "lender");
  const notes = getFlag(flags, "notes");

  const store = createStore(flags);
  const budget = createBudgetAPI(store);
  
  const result = await budget.debts.add({
    description,
    type,
    current_balance: balance,
    interest_rate_annual: rate,
    minimum_payment: payment,
    lender,
    notes,
  });
  success(result);
}

async function handlePayoffPlan(flags: Map<string, string>): Promise<void> {
  const id = requireFlag(flags, "id");

  const store = createStore(flags);
  const budget = createBudgetAPI(store);
  
  const plan = await budget.debts.getPayoffPlan({ id });
  success(plan);
}

async function handleListIncome(flags: Map<string, string>): Promise<void> {
  const store = createStore(flags);
  const budget = createBudgetAPI(store);
  
  const income = await budget.income.list();
  success(income);
}

async function handleListExpenses(flags: Map<string, string>): Promise<void> {
  const store = createStore(flags);
  const budget = createBudgetAPI(store);
  
  const expenses = await budget.expenses.list();
  success(expenses);
}

async function handleExpenseSummary(flags: Map<string, string>): Promise<void> {
  const store = createStore(flags);
  const budget = createBudgetAPI(store);
  
  const summary = await budget.expenses.summary();
  success(summary);
}

async function handleAddExpense(flags: Map<string, string>): Promise<void> {
  const description = requireFlag(flags, "description");
  const categoryId = requireFlag(flags, "category-id");
  const amountStr = requireFlag(flags, "amount");

  const amount = parseFloat(amountStr);
  if (isNaN(amount)) {
    error("Invalid amount value");
  }

  const vendor = getFlag(flags, "vendor");
  const autoPayStr = getFlag(flags, "auto-pay");
  const notes = getFlag(flags, "notes");

  const store = createStore(flags);
  const budget = createBudgetAPI(store);
  
  const result = await budget.expenses.add({
    description,
    category_id: categoryId,
    amount,
    vendor,
    auto_pay: autoPayStr || "no",
    notes,
  });
  success(result);
}

async function handleListGoals(flags: Map<string, string>): Promise<void> {
  const store = createStore(flags);
  const budget = createBudgetAPI(store);
  
  const goals = await budget.goals.list();
  success(goals);
}

async function handleAddGoal(flags: Map<string, string>): Promise<void> {
  const description = requireFlag(flags, "description");
  const targetStr = requireFlag(flags, "target");
  const contributionStr = requireFlag(flags, "contribution");

  const target = parseFloat(targetStr);
  const contribution = parseFloat(contributionStr);

  if (isNaN(target) || isNaN(contribution)) {
    error("Invalid numeric values for target or contribution");
  }

  const priorityStr = getFlag(flags, "priority");
  const priority = priorityStr ? parseInt(priorityStr, 10) : undefined;

  const store = createStore(flags);
  const budget = createBudgetAPI(store);
  
  const result = await budget.goals.add({
    description,
    target_amount: target,
    monthly_contribution: contribution,
    priority,
  });
  success(result);
}

async function handleAddTransaction(flags: Map<string, string>): Promise<void> {
  const date = requireFlag(flags, "date");
  const type = requireFlag(flags, "type");
  const categoryId = requireFlag(flags, "category-id");
  const description = requireFlag(flags, "description");
  const amountStr = requireFlag(flags, "amount");

  const amount = parseFloat(amountStr);
  if (isNaN(amount)) {
    error("Invalid amount value");
  }

  const method = getFlag(flags, "method");
  const notes = getFlag(flags, "notes");

  const store = createStore(flags);
  const budget = createBudgetAPI(store);
  
  const result = await budget.actuals.add({
    date,
    type,
    category_id: categoryId,
    description,
    amount: String(amount),
    payment_method: method || "",
    notes: notes || "",
  });
  success(result);
}

async function handleHealth(flags: Map<string, string>): Promise<void> {
  const store = createStore(flags);
  const budget = createBudgetAPI(store);
  
  const health = await budget.analysis.health();
  success(health);
}

async function handleSnapshot(flags: Map<string, string>): Promise<void> {
  const store = createStore(flags);
  const budget = createBudgetAPI(store);
  
  const snapshot = await budget.analysis.snapshot();
  success(snapshot);
}

async function handleStrategy(flags: Map<string, string>): Promise<void> {
  const store = createStore(flags);
  const budget = createBudgetAPI(store);
  
  const strategy = await budget.analysis.strategy();
  success(strategy);
}

async function handleValidate(flags: Map<string, string>): Promise<void> {
  const store = createStore(flags);
  const budget = createBudgetAPI(store);
  
  const validation = await budget.allocations.validate();
  success(validation);
}

async function handleAudit(flags: Map<string, string>): Promise<void> {
  const store = createStore(flags);
  const budget = createBudgetAPI(store);
  
  const auditResult = await budget.audit();
  success(auditResult);
}

async function handleLog(flags: Map<string, string>): Promise<void> {
  const limitStr = getFlag(flags, "limit");
  const limit = limitStr ? parseInt(limitStr, 10) : 20;

  const store = createStore(flags);
  const budget = createBudgetAPI(store);
  
  const logEntries = await budget.log.list({ limit });
  success(logEntries);
}

// ============================================================
// MAIN
// ============================================================

export async function main(): Promise<void> {
  const argv = process.argv.slice(2);

  // Global help check
  if (argv.length === 0 || argv.includes("--help") || argv.includes("-h")) {
    console.log(HELP_TEXT);
    process.exit(0);
  }

  const parsed = parseArgs(argv);

  // Command-level help
  if (!parsed.command || parsed.command === "help") {
    console.log(HELP_TEXT);
    process.exit(0);
  }

  try {
    switch (parsed.command) {
      // Execution
      case "exec":
        await handleExec(parsed.flags);
        break;

      // Debts
      case "list-debts":
        await handleListDebts(parsed.flags);
        break;
      case "update-balance":
        await handleUpdateBalance(parsed.flags);
        break;
      case "add-debt":
        await handleAddDebt(parsed.flags);
        break;
      case "payoff-plan":
        await handlePayoffPlan(parsed.flags);
        break;

      // Income
      case "list-income":
        await handleListIncome(parsed.flags);
        break;

      // Expenses
      case "list-expenses":
        await handleListExpenses(parsed.flags);
        break;
      case "expense-summary":
        await handleExpenseSummary(parsed.flags);
        break;
      case "add-expense":
        await handleAddExpense(parsed.flags);
        break;

      // Goals
      case "list-goals":
        await handleListGoals(parsed.flags);
        break;
      case "add-goal":
        await handleAddGoal(parsed.flags);
        break;

      // Transactions
      case "add-transaction":
        await handleAddTransaction(parsed.flags);
        break;

      // Analysis
      case "health":
        await handleHealth(parsed.flags);
        break;
      case "snapshot":
        await handleSnapshot(parsed.flags);
        break;
      case "strategy":
        await handleStrategy(parsed.flags);
        break;
      case "validate":
        await handleValidate(parsed.flags);
        break;
      case "audit":
        await handleAudit(parsed.flags);
        break;
      case "log":
        await handleLog(parsed.flags);
        break;

      default:
        error(`Unknown command: ${parsed.command}\n\nRun 'help' to see available commands.`);
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    error(message);
  }
}

// Self-invoke when run directly (bundled script)
if (process.argv[1] && import.meta.url === `file://${process.argv[1]}`) {
  main().catch((err) => {
    console.error("Fatal error:", err);
    process.exit(1);
  });
}

export { parseArgs };
