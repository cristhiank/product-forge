import { afterEach, beforeEach, describe, expect, test } from "vitest";

import { createBudgetAPI } from "../src/budget-api.js";
import { executeCode } from "../src/sandbox/index.js";
import { FileSystemBudgetStore } from "../src/storage/fs-store.js";
import { makeTempFixture } from "./test-helpers.js";

describe("Budget API", () => {
  let root: string;
  let cleanup: () => Promise<void>;
  let store: FileSystemBudgetStore;
  let budget: ReturnType<typeof createBudgetAPI>;

  beforeEach(async () => {
    const fixture = await makeTempFixture();
    root = fixture.root;
    cleanup = fixture.cleanup;
    store = new FileSystemBudgetStore({ root, year: "2026" });
    budget = createBudgetAPI(store);
  });

  afterEach(async () => {
    await cleanup();
  });

  // ── Config ──────────────────────────────────────────────────────────

  test("config.get() returns settings, family, categories", async () => {
    const cfg = await budget.config.get();
    expect(cfg.settings.length).toBeGreaterThan(0);
    expect(cfg.family.length).toBe(1);
    expect(cfg.categories.length).toBeGreaterThan(0);
  });

  test("config.getCopRate() returns rate from settings", async () => {
    const rate = await budget.config.getCopRate();
    expect(rate).toBe(3600);
  });

  test("config.setCopRate() updates setting", async () => {
    const result = await budget.config.setCopRate(3700);
    expect(result.success).toBe(true);

    const newRate = await budget.config.getCopRate();
    expect(newRate).toBe(3700);
  });

  // ── Income ──────────────────────────────────────────────────────────

  test("income.list() returns all income sources", async () => {
    const sources = await budget.income.list();
    expect(sources.length).toBe(1);
    expect(sources[0].source_id).toBe("INC-001");
  });

  test("income.get() returns a specific source", async () => {
    const source = await budget.income.get({ id: "INC-001" });
    expect(source).toBeDefined();
    expect(source!.type).toBe("salary");
  });

  test("income.update() changes a field and cascades", async () => {
    const result = await budget.income.update({
      id: "INC-001",
      field: "net_monthly",
      value: "10000",
    });
    expect(result.success).toBe(true);
    expect(result.cascade).toBeDefined();
    expect(result.logged).toBe(true);

    // Verify the change persisted
    const source = await budget.income.get({ id: "INC-001" });
    expect(source!.net_monthly).toBe("10000");
  });

  // ── Debts ───────────────────────────────────────────────────────────

  test("debts.list() returns all debts", async () => {
    const debtList = await budget.debts.list();
    expect(debtList.length).toBe(2);
  });

  test("debts.updateBalance() cascades to multiple files", async () => {
    const result = await budget.debts.updateBalance({
      id: "DEBT-002",
      balance: 78378,
      note: "Abono a capital — 282163272 COP",
    });

    expect(result.success).toBe(true);
    expect(result.cascade).toBeDefined();
    expect(result.cascade!.filesUpdated.length).toBeGreaterThan(0);
    expect(result.logged).toBe(true);

    // Verify debts.csv updated
    const debt = await budget.debts.get({ id: "DEBT-002" });
    expect(debt!.current_balance).toBe("78378");

    // Verify snapshot updated
    const snapshot = await store.readTable("snapshot");
    const debtTotal = snapshot.find((r) => r.metric === "total_debt_balance");
    expect(parseFloat(debtTotal!.value)).toBe(82878);  // 4500 + 78378

    // Verify strategy updated
    const strategy = await store.readTable("goal_allocation_strategy");
    const startBal = strategy.find((r) => r.parameter === "starting_balance");
    expect(startBal!.scenario_a_colombia_first).toBe("78378");
  });

  test("debts.getPayoffPlan() filters by debt", async () => {
    const ccPlan = await budget.debts.getPayoffPlan({ id: "DEBT-001" });
    expect(ccPlan.every((r) => r.debt_id === "DEBT-001")).toBe(true);
  });

  // ── Expenses ────────────────────────────────────────────────────────

  test("expenses.list() returns all expenses", async () => {
    const exps = await budget.expenses.list();
    expect(exps.length).toBe(2);
  });

  test("expenses.add() creates and cascades", async () => {
    const result = await budget.expenses.add({
      id: "EXP-010",
      description: "Vitamins",
      category_id: "CAT-003",
      amount: 100,
    });
    expect(result.success).toBe(true);

    const exps = await budget.expenses.list();
    expect(exps.length).toBe(3);
  });

  test("expenses.remove() deletes and cascades", async () => {
    const result = await budget.expenses.remove({ id: "EXP-002" });
    expect(result.success).toBe(true);

    const exps = await budget.expenses.list();
    expect(exps.length).toBe(1);
  });

  // ── Allocations ─────────────────────────────────────────────────────

  test("allocations.listAnnual() returns budget", async () => {
    const annual = await budget.allocations.listAnnual();
    expect(annual.length).toBeGreaterThan(0);
  });

  test("allocations.setAnnual() updates amount and cascades", async () => {
    const result = await budget.allocations.setAnnual({
      categoryId: "CAT-001",
      amount: 3600,
    });
    expect(result.success).toBe(true);

    const row = await budget.allocations.getAnnual({ categoryId: "CAT-001" });
    expect(row!.monthly_budget).toBe("3600");
    expect(row!.annual_budget).toBe("43200");
  });

  // ── Goals ───────────────────────────────────────────────────────────

  test("goals.list() returns all goals", async () => {
    const goalList = await budget.goals.list();
    expect(goalList.length).toBe(1);
  });

  test("goals.update() changes field and cascades", async () => {
    const result = await budget.goals.update({
      id: "GOAL-001",
      field: "current_amount",
      value: "5000",
    });
    expect(result.success).toBe(true);
  });

  // ── Analysis ────────────────────────────────────────────────────────

  test("analysis.snapshot() returns snapshot", async () => {
    const snap = await budget.analysis.snapshot();
    expect(snap.length).toBeGreaterThan(0);
  });

  test("analysis.projectHouseFund() projects savings", async () => {
    const proj = await budget.analysis.projectHouseFund({
      startBalance: 0,
      monthlyContribution: 908,
      startMonth: "2026-02",
      months: 12,
    });
    expect(proj.entries).toHaveLength(12);
    expect(proj.finalBalance).toBeGreaterThan(10000);
  });

  // ── Audit ───────────────────────────────────────────────────────────

  test("audit() runs without crashing", async () => {
    const result = await budget.audit();
    expect(result).toBeDefined();
    expect(result.summary).toBeDefined();
  });

  // ── Log ─────────────────────────────────────────────────────────────

  test("log.list() returns entries", async () => {
    const entries = await budget.log.list();
    expect(entries.length).toBeGreaterThan(0);
  });

  // ── Sandbox ─────────────────────────────────────────────────────────

  test("sandbox executes code against budget API", async () => {
    const resp = await executeCode(budget, {
      code: "return budget.debts.list()",
      timeout: 10000,
    });

    expect(resp.success).toBe(true);
    expect(Array.isArray(resp.result)).toBe(true);
    expect((resp.result as unknown[]).length).toBe(2);
  });

  test("sandbox: budget.help() returns API reference", async () => {
    const resp = await executeCode(budget, {
      code: "return budget.help()",
      timeout: 5000,
    });

    expect(resp.success).toBe(true);
    expect((resp.result as Record<string, unknown>).name).toBe("budget");
  });

  test("sandbox handles errors gracefully", async () => {
    const resp = await executeCode(budget, {
      code: "throw new Error('test error')",
      timeout: 5000,
    });

    expect(resp.success).toBe(false);
    expect(resp.error).toContain("test error");
  });

  // ══════════════════════════════════════════════════════════════════════
  // NEW TESTS — Auto-ID, validation, new methods
  // ══════════════════════════════════════════════════════════════════════

  // ── Expenses: auto-ID ───────────────────────────────────────────────

  test("expenses.add() auto-generates ID when omitted", async () => {
    const result = await budget.expenses.add({
      description: "Spotify",
      category_id: "CAT-010",
      amount: 10.99,
    });
    expect(result.success).toBe(true);
    expect(result.data!.id).toBe("EXP-003");  // fixture has EXP-001, EXP-002
  });

  test("expenses.add() rejects duplicate ID", async () => {
    const result = await budget.expenses.add({
      id: "EXP-001",
      description: "Duplicate",
      category_id: "CAT-001",
      amount: 50,
    });
    expect(result.success).toBe(false);
    expect(result.error).toContain("already exists");
  });

  test("expenses.add() validates category_id", async () => {
    const result = await budget.expenses.add({
      description: "Bad Category",
      category_id: "CAT-999",
      amount: 50,
    });
    expect(result.success).toBe(false);
    expect(result.error).toContain("Unknown category_id");
  });

  test("expenses.add() accepts auto_pay field", async () => {
    const result = await budget.expenses.add({
      description: "Internet",
      category_id: "CAT-002",
      amount: 79.99,
      auto_pay: "yes",
      vendor: "Xfinity",
    });
    expect(result.success).toBe(true);

    const exp = await budget.expenses.get({ id: result.data!.id as string });
    expect(exp!.auto_pay).toBe("yes");
  });

  // ── Expenses: summary ──────────────────────────────────────────────

  test("expenses.summary() groups by category with sums", async () => {
    // Add a second expense in CAT-001
    await budget.expenses.add({
      description: "Parking",
      category_id: "CAT-001",
      amount: 200,
    });

    const summary = await budget.expenses.summary();
    expect(summary.length).toBeGreaterThan(0);

    const cat1 = summary.find((s) => s.category_id === "CAT-001");
    expect(cat1).toBeDefined();
    expect(cat1!.count).toBe(2);
    expect(cat1!.monthly_total).toBe(3757);  // 3557 + 200
  });

  // ── Debts: add ─────────────────────────────────────────────────────

  test("debts.add() creates a new debt with auto-ID", async () => {
    const result = await budget.debts.add({
      description: "Car Loan",
      type: "auto_loan",
      current_balance: 25000,
      interest_rate_annual: 5.99,
      minimum_payment: 450,
      lender: "Chase Auto",
    });
    expect(result.success).toBe(true);
    expect(result.data!.id).toBe("DEBT-003");
    expect(result.cascade).toBeDefined();

    const debt = await budget.debts.get({ id: "DEBT-003" });
    expect(debt).toBeDefined();
    expect(debt!.current_balance).toBe("25000");
  });

  test("debts.add() rejects duplicate ID", async () => {
    const result = await budget.debts.add({
      id: "DEBT-001",
      description: "Duplicate",
      type: "credit_card",
      current_balance: 1000,
      interest_rate_annual: 20,
      minimum_payment: 50,
    });
    expect(result.success).toBe(false);
    expect(result.error).toContain("already exists");
  });

  // ── Goals: add ─────────────────────────────────────────────────────

  test("goals.add() creates a new goal with auto-ID", async () => {
    const result = await budget.goals.add({
      description: "Vacation Fund",
      target_amount: 5000,
      monthly_contribution: 200,
    });
    expect(result.success).toBe(true);
    expect(result.data!.id).toBe("GOAL-002");
    expect(result.cascade).toBeDefined();

    const goal = await budget.goals.get({ id: "GOAL-002" });
    expect(goal).toBeDefined();
    expect(goal!.target_amount).toBe("5000");
    expect(goal!.status).toBe("active");
  });

  test("goals.add() rejects duplicate ID", async () => {
    const result = await budget.goals.add({
      id: "GOAL-001",
      description: "Duplicate",
      target_amount: 1000,
    });
    expect(result.success).toBe(false);
    expect(result.error).toContain("already exists");
  });

  // ── Actuals: auto-ID ──────────────────────────────────────────────

  test("actuals.add() auto-generates txn_id", async () => {
    const result = await budget.actuals.add({
      date: "2026-02-08",
      type: "expense",
      category_id: "CAT-001",
      category: "Rent",
      source_or_dest: "Landlord",
      description: "February rent",
      amount: "3557",
      payment_method: "checking",
      debt_id: "",
      goal_id: "",
      notes: "",
    });
    expect(result.success).toBe(true);
    expect(result.data!.txn_id).toBe("TXN-001");
  });

  test("actuals.add() validates category_id", async () => {
    const result = await budget.actuals.add({
      date: "2026-02-08",
      type: "expense",
      category_id: "CAT-999",
      category: "Bad",
      description: "Invalid",
      amount: "10",
    });
    expect(result.success).toBe(false);
    expect(result.error).toContain("Unknown category_id");
  });

  // ── Actuals: update ───────────────────────────────────────────────

  test("actuals.update() fixes a ledger entry", async () => {
    // Add an entry first
    await budget.actuals.add({
      txn_id: "TXN-050",
      date: "2026-02-08",
      type: "expense",
      category_id: "CAT-001",
      category: "Rent",
      source_or_dest: "",
      description: "Wrong description",
      amount: "100",
      payment_method: "checking",
      debt_id: "",
      goal_id: "",
      notes: "",
    });

    const result = await budget.actuals.update({
      txnId: "TXN-050",
      field: "description",
      value: "Corrected description",
    });
    expect(result.success).toBe(true);

    // Verify
    const rows = await budget.actuals.list();
    const txn = rows.find((r) => r.txn_id === "TXN-050");
    expect(txn!.description).toBe("Corrected description");
  });

  test("actuals.update() returns error for non-existent txn", async () => {
    const result = await budget.actuals.update({
      txnId: "TXN-999",
      field: "description",
      value: "Nope",
    });
    expect(result.success).toBe(false);
    expect(result.error).toContain("not found");
  });

  // ── Actuals: remove ───────────────────────────────────────────────

  test("actuals.remove() deletes a ledger entry", async () => {
    await budget.actuals.add({
      txn_id: "TXN-060",
      date: "2026-02-08",
      type: "expense",
      category_id: "CAT-001",
      category: "Rent",
      description: "To be deleted",
      amount: "50",
    });

    const before = await budget.actuals.list();
    expect(before.some((r) => r.txn_id === "TXN-060")).toBe(true);

    const result = await budget.actuals.remove({ txnId: "TXN-060" });
    expect(result.success).toBe(true);

    const after = await budget.actuals.list();
    expect(after.some((r) => r.txn_id === "TXN-060")).toBe(false);
  });

  test("actuals.remove() returns error for non-existent txn", async () => {
    const result = await budget.actuals.remove({ txnId: "TXN-999" });
    expect(result.success).toBe(false);
    expect(result.error).toContain("not found");
  });

  // ── Actuals: addMany ──────────────────────────────────────────────

  test("actuals.addMany() batch-records with auto-IDs", async () => {
    const result = await budget.actuals.addMany([
      {
        date: "2026-02-08",
        type: "expense",
        category_id: "CAT-001",
        category: "Rent",
        description: "Rent Feb",
        amount: "3557",
      },
      {
        date: "2026-02-08",
        type: "expense",
        category_id: "CAT-003",
        category: "Groceries",
        description: "Costco run",
        amount: "200",
      },
    ]);

    expect(result.success).toBe(true);
    expect((result.data as Record<string, unknown>).count).toBe(2);
    expect((result.data as Record<string, unknown>).txn_ids).toEqual(["TXN-001", "TXN-002"]);

    const rows = await budget.actuals.list();
    expect(rows.length).toBe(2);
  });

  // ── Sandbox: console.log capture ──────────────────────────────────

  test("sandbox captures console.log output", async () => {
    const resp = await executeCode(budget, {
      code: `
        console.log("hello from sandbox");
        console.warn("a warning");
        return 42;
      `,
      timeout: 5000,
    });

    expect(resp.success).toBe(true);
    expect(resp.result).toBe(42);
    expect(resp.console_output).toBeDefined();
    expect(resp.console_output).toContain("hello from sandbox");
    expect(resp.console_output).toContain("[warn] a warning");
  });

  test("sandbox console_output is undefined when no logs", async () => {
    const resp = await executeCode(budget, {
      code: "return 1 + 1",
      timeout: 5000,
    });

    expect(resp.success).toBe(true);
    expect(resp.console_output).toBeUndefined();
  });
});
