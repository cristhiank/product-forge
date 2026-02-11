// ─── Budget API ───────────────────────────────────────────────────────────
// The API surface exposed through the `budget` sandbox.
// Every mutation triggers cascades + auto-logging.

import {
  projectSavings,
  round2,
} from "./engine/amortization.js";
import {
  validateAnnualMath,
  validateDebtPayoffSync,
  validateExpenseBudgetSync,
  validateZeroBased,
  type ValidationIssue,
  type ValidationResult,
} from "./engine/budget-validator.js";
import { runCascade } from "./engine/cascade.js";
import type { BudgetStore } from "./storage/budget-store.js";
import type { MutationResult } from "./types.js";

// ── Auto-Logging ──────────────────────────────────────────────────────────

async function autoLog(
  store: BudgetStore,
  action: string,
  taskType: string,
  details: string,
  filesModified: string[],
): Promise<void> {
  try {
    await store.appendRows("planner_log", [{
      timestamp: new Date().toISOString(),
      action,
      task_type: taskType,
      details,
      files_modified: filesModified.join(";"),
    }]);
  } catch {
    // Logging is best-effort
  }
}

// ── API Factory ───────────────────────────────────────────────────────────

export function createBudgetAPI(store: BudgetStore) {

  // ── Helpers ────────────────────────────────────────────────────────────

  /** Generate the next sequential ID for a table. Reads existing rows, finds max, increments. */
  async function nextId(table: string, column: string, prefix: string): Promise<string> {
    const rows = await store.readTable(table);
    let max = 0;
    for (const row of rows) {
      const id = row[column] ?? "";
      if (id.startsWith(prefix)) {
        const num = parseInt(id.slice(prefix.length), 10);
        if (!isNaN(num) && num > max) max = num;
      }
    }
    return `${prefix}${String(max + 1).padStart(3, "0")}`;
  }

  /** Validate that a category_id exists in expense_categories. */
  async function validateCategoryId(categoryId: string): Promise<boolean> {
    const row = await store.getRow("expense_categories", { category_id: categoryId });
    return row !== undefined;
  }

  // ══════════════════════════════════════════════════════════════════════
  // CONFIG
  // ══════════════════════════════════════════════════════════════════════

  const config = {
    async get(): Promise<{
      settings: Record<string, string>[];
      family: Record<string, string>[];
      categories: Record<string, string>[];
    }> {
      const [settings, family, categories] = await Promise.all([
        store.readTable("settings"),
        store.readTable("family_profile"),
        store.readTable("expense_categories"),
      ]);
      return { settings, family, categories };
    },

    async getSetting(key: string): Promise<string | undefined> {
      const row = await store.getRow("settings", { key });
      return row?.value;
    },

    async setSetting(key: string, value: string): Promise<MutationResult> {
      const updated = await store.updateRow("settings", { key }, {
        value,
        updated: new Date().toISOString().slice(0, 10),
      });

      if (!updated) {
        // Insert new setting
        const settings = await store.readTable("settings");
        settings.push({ key, value, updated: new Date().toISOString().slice(0, 10) });
        await store.writeTable("settings", settings);
      }

      const cascade = await runCascade(store, "config_changed", { key, value });
      await autoLog(store, "config_updated", "config", `${key} = ${value}`, ["settings", ...cascade.filesUpdated]);

      return { success: true, data: { key, value }, cascade, logged: true };
    },

    async getCopRate(): Promise<number> {
      const val = await config.getSetting("cop_usd_rate");
      return val ? parseFloat(val) : 3600;
    },

    async setCopRate(rate: number): Promise<MutationResult> {
      return config.setSetting("cop_usd_rate", String(rate));
    },
  };

  // ══════════════════════════════════════════════════════════════════════
  // INCOME
  // ══════════════════════════════════════════════════════════════════════

  const income = {
    async list(): Promise<Record<string, string>[]> {
      return store.readTable("income_sources");
    },

    async get(opts: { id: string }): Promise<Record<string, string> | undefined> {
      return store.getRow("income_sources", { source_id: opts.id });
    },

    async update(opts: { id: string; field: string; value: string }): Promise<MutationResult> {
      const updated = await store.updateRow("income_sources", { source_id: opts.id }, {
        [opts.field]: opts.value,
      });

      if (!updated) return { success: false, error: `Income source not found: ${opts.id}` };

      const cascade = await runCascade(store, "income_changed", { sourceId: opts.id });
      await autoLog(store, "income_updated", "income", `${opts.id}.${opts.field} = ${opts.value}`,
        ["income_sources", ...cascade.filesUpdated]);

      return { success: true, data: { id: opts.id, field: opts.field, value: opts.value }, cascade, logged: true };
    },

    async add(opts: {
      id: string; member_id: string; description: string; type: string;
      gross_monthly: number; net_monthly: number; frequency: string; notes?: string;
    }): Promise<MutationResult> {
      const rows = await store.readTable("income_sources");
      rows.push({
        source_id: opts.id,
        member_id: opts.member_id,
        description: opts.description,
        type: opts.type,
        gross_monthly: String(opts.gross_monthly),
        net_monthly: String(opts.net_monthly),
        frequency: opts.frequency,
        start_date: "",
        end_date: "",
        notes: opts.notes ?? "",
      });
      await store.writeTable("income_sources", rows);

      const cascade = await runCascade(store, "income_changed", { sourceId: opts.id });
      await autoLog(store, "income_added", "income", `${opts.id}: ${opts.description} $${opts.net_monthly}/mo`,
        ["income_sources", ...cascade.filesUpdated]);

      return { success: true, data: { id: opts.id }, cascade, logged: true };
    },
  };

  // ══════════════════════════════════════════════════════════════════════
  // DEBTS
  // ══════════════════════════════════════════════════════════════════════

  const debts = {
    async list(): Promise<Record<string, string>[]> {
      return store.readTable("debts");
    },

    async get(opts: { id: string }): Promise<Record<string, string> | undefined> {
      return store.getRow("debts", { debt_id: opts.id });
    },

    /**
     * Update a debt's balance and cascade to all dependents.
     * This is the operation that used to require editing 6 files manually.
     */
    async updateBalance(opts: { id: string; balance: number; note?: string }): Promise<MutationResult> {
      const updated = await store.updateRow("debts", { debt_id: opts.id }, {
        current_balance: String(opts.balance),
        ...(opts.note ? { notes: opts.note } : {}),
      });

      if (!updated) return { success: false, error: `Debt not found: ${opts.id}` };

      const cascade = await runCascade(store, "debt_balance_changed", {
        debtId: opts.id,
        newBalance: opts.balance,
      });

      await autoLog(store, "debt_balance_updated", "debt",
        `${opts.id} balance → $${opts.balance}${opts.note ? `. ${opts.note}` : ""}`,
        ["debts", ...cascade.filesUpdated]);

      return { success: true, data: { id: opts.id, balance: opts.balance }, cascade, logged: true };
    },

    async update(opts: { id: string; field: string; value: string }): Promise<MutationResult> {
      const updated = await store.updateRow("debts", { debt_id: opts.id }, {
        [opts.field]: opts.value,
      });

      if (!updated) return { success: false, error: `Debt not found: ${opts.id}` };

      const cascade = await runCascade(store, "debt_balance_changed", { debtId: opts.id });
      await autoLog(store, "debt_updated", "debt", `${opts.id}.${opts.field} = ${opts.value}`,
        ["debts", ...cascade.filesUpdated]);

      return { success: true, cascade, logged: true };
    },

    /**
     * Recalculate the payoff plan for a specific debt.
     * Uses the current balance and payment schedule from payoff_plan.csv.
     */
    async recalculatePayoff(opts?: { id?: string }): Promise<MutationResult> {
      const allDebts = await store.readTable("debts");
      const targetDebts = opts?.id
        ? allDebts.filter((d) => d.debt_id === opts.id)
        : allDebts;

      const results: Array<{ debtId: string; months: number; totalInterest: number }> = [];

      for (const debt of targetDebts) {
        await runCascade(store, "debt_balance_changed", { debtId: debt.debt_id });
        results.push({
          debtId: debt.debt_id,
          months: 0,  // filled by cascade
          totalInterest: 0,
        });
      }

      await autoLog(store, "payoff_recalculated", "debt",
        `Recalculated payoff for ${targetDebts.map((d) => d.debt_id).join(", ")}`,
        ["payoff_plan", "snapshot", "goal_allocation_strategy", "financial_health"]);

      return { success: true, data: results, logged: true };
    },

    /** Get the current payoff plan for all debts or a specific one. */
    async getPayoffPlan(opts?: { id?: string }): Promise<Record<string, string>[]> {
      const rows = await store.readTable("payoff_plan");
      if (opts?.id) return rows.filter((r) => r.debt_id === opts.id);
      return rows;
    },

    /** Add a new debt. ID is auto-generated if omitted. */
    async add(opts: {
      id?: string; description: string; type: string;
      original_amount?: number; current_balance: number;
      interest_rate_annual: number; minimum_payment: number;
      due_day?: string; start_date?: string; term_months?: number;
      lender?: string; priority_snowball?: number; priority_avalanche?: number;
      notes?: string;
    }): Promise<MutationResult> {
      const id = opts.id ?? await nextId("debts", "debt_id", "DEBT-");

      // Check for duplicate
      const existing = await store.getRow("debts", { debt_id: id });
      if (existing) return { success: false, error: `Debt already exists: ${id}` };

      const rows = await store.readTable("debts");
      rows.push({
        debt_id: id,
        description: opts.description,
        type: opts.type,
        original_amount: String(opts.original_amount ?? opts.current_balance),
        current_balance: String(opts.current_balance),
        interest_rate_annual: String(opts.interest_rate_annual),
        minimum_payment: String(opts.minimum_payment),
        due_day: opts.due_day ?? "",
        start_date: opts.start_date ?? new Date().toISOString().slice(0, 10),
        term_months: String(opts.term_months ?? ""),
        lender: opts.lender ?? "",
        priority_snowball: String(opts.priority_snowball ?? rows.length + 1),
        priority_avalanche: String(opts.priority_avalanche ?? rows.length + 1),
        notes: opts.notes ?? "",
      });
      await store.writeTable("debts", rows);

      const cascade = await runCascade(store, "debt_added", { debtId: id });
      await autoLog(store, "debt_added", "debt",
        `${id}: ${opts.description} $${opts.current_balance} @ ${opts.interest_rate_annual}%`,
        ["debts", ...cascade.filesUpdated]);

      return { success: true, data: { id }, cascade, logged: true };
    },
  };

  // ══════════════════════════════════════════════════════════════════════
  // EXPENSES
  // ══════════════════════════════════════════════════════════════════════

  const expenses = {
    async list(): Promise<Record<string, string>[]> {
      return store.readTable("recurring_expenses");
    },

    async get(opts: { id: string }): Promise<Record<string, string> | undefined> {
      return store.getRow("recurring_expenses", { expense_id: opts.id });
    },

    async add(opts: {
      id?: string; description: string; category_id: string; amount: number;
      frequency?: string; due_day?: string; auto_pay?: string;
      vendor?: string; notes?: string;
    }): Promise<MutationResult> {
      // Validate category
      if (!(await validateCategoryId(opts.category_id))) {
        return { success: false, error: `Unknown category_id: ${opts.category_id}. Check expense_categories.csv.` };
      }

      const id = opts.id ?? await nextId("recurring_expenses", "expense_id", "EXP-");

      // Check for duplicate
      const existing = await store.getRow("recurring_expenses", { expense_id: id });
      if (existing) return { success: false, error: `Expense already exists: ${id}` };

      const rows = await store.readTable("recurring_expenses");
      rows.push({
        expense_id: id,
        description: opts.description,
        category_id: opts.category_id,
        amount: String(opts.amount),
        frequency: opts.frequency ?? "monthly",
        due_day: opts.due_day ?? "",
        auto_pay: opts.auto_pay ?? "no",
        vendor: opts.vendor ?? "",
        notes: opts.notes ?? "",
      });
      await store.writeTable("recurring_expenses", rows);

      const cascade = await runCascade(store, "expense_added", { expenseId: id });
      await autoLog(store, "expense_added", "expense",
        `${id}: ${opts.description} $${opts.amount}/mo`,
        ["recurring_expenses", ...cascade.filesUpdated]);

      return { success: true, data: { id }, cascade, logged: true };
    },

    async update(opts: { id: string; field: string; value: string }): Promise<MutationResult> {
      const updated = await store.updateRow("recurring_expenses", { expense_id: opts.id }, {
        [opts.field]: opts.value,
      });

      if (!updated) return { success: false, error: `Expense not found: ${opts.id}` };

      const cascade = await runCascade(store, "expense_changed", { expenseId: opts.id });
      await autoLog(store, "expense_updated", "expense", `${opts.id}.${opts.field} = ${opts.value}`,
        ["recurring_expenses", ...cascade.filesUpdated]);

      return { success: true, cascade, logged: true };
    },

    async remove(opts: { id: string }): Promise<MutationResult> {
      const deleted = await store.deleteRows("recurring_expenses", { expense_id: opts.id });
      if (deleted === 0) return { success: false, error: `Expense not found: ${opts.id}` };

      const cascade = await runCascade(store, "expense_removed", { expenseId: opts.id });
      await autoLog(store, "expense_removed", "expense", `${opts.id} deleted`,
        ["recurring_expenses", ...cascade.filesUpdated]);

      return { success: true, cascade, logged: true };
    },

    /** Group expenses by category_id and return sums. */
    async summary(): Promise<Array<{ category_id: string; category: string; count: number; monthly_total: number }>> {
      const rows = await store.readTable("recurring_expenses");
      const categories = await store.readTable("expense_categories");
      const catMap = new Map(categories.map((c) => [c.category_id, c.category]));
      const groups = new Map<string, { count: number; total: number }>();

      for (const row of rows) {
        const catId = row.category_id;
        const entry = groups.get(catId) ?? { count: 0, total: 0 };
        entry.count++;
        entry.total = round2(entry.total + parseFloat(row.amount || "0"));
        groups.set(catId, entry);
      }

      return Array.from(groups.entries())
        .map(([catId, { count, total }]) => ({
          category_id: catId,
          category: catMap.get(catId) ?? "Unknown",
          count,
          monthly_total: total,
        }))
        .sort((a, b) => b.monthly_total - a.monthly_total);
    },
  };

  // ══════════════════════════════════════════════════════════════════════
  // ALLOCATIONS (budget_annual + budget_monthly)
  // ══════════════════════════════════════════════════════════════════════

  const allocations = {
    async listAnnual(): Promise<Record<string, string>[]> {
      return store.readTable("budget_annual");
    },

    async listMonthly(): Promise<Record<string, string>[]> {
      return store.readTable("budget_monthly");
    },

    async getAnnual(opts: { categoryId: string }): Promise<Record<string, string> | undefined> {
      return store.getRow("budget_annual", { category_id: opts.categoryId });
    },

    async setAnnual(opts: { categoryId: string; amount: number; notes?: string }): Promise<MutationResult> {
      const updated = await store.updateRow("budget_annual", { category_id: opts.categoryId }, {
        monthly_budget: String(opts.amount),
        annual_budget: String(round2(opts.amount * 12)),
        ...(opts.notes ? { notes: opts.notes } : {}),
      });

      if (!updated) return { success: false, error: `Category not found: ${opts.categoryId}` };

      const cascade = await runCascade(store, "allocation_changed", { categoryId: opts.categoryId });
      await autoLog(store, "allocation_updated", "budget",
        `${opts.categoryId} → $${opts.amount}/mo ($${round2(opts.amount * 12)}/yr)`,
        ["budget_annual", ...cascade.filesUpdated]);

      return { success: true, cascade, logged: true };
    },

    async setMonthly(opts: {
      categoryId: string;
      month: string;    // "jan", "feb", etc.
      amount: number;
    }): Promise<MutationResult> {
      const updated = await store.updateRow("budget_monthly", { category_id: opts.categoryId }, {
        [opts.month]: String(opts.amount),
      });

      if (!updated) return { success: false, error: `Category not found in monthly: ${opts.categoryId}` };

      // Recalculate annual_total for this row
      await store.transformTable("budget_monthly", (rows) =>
        rows.map((row) => {
          if (row.category_id !== opts.categoryId) return row;
          const months = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"];
          const total = months.reduce((sum, m) => sum + parseFloat(row[m] || "0"), 0);
          return { ...row, annual_total: String(round2(total)) };
        })
      );

      const cascade = await runCascade(store, "allocation_changed", { categoryId: opts.categoryId });
      await autoLog(store, "monthly_allocation_updated", "budget",
        `${opts.categoryId}.${opts.month} → $${opts.amount}`,
        ["budget_monthly", ...cascade.filesUpdated]);

      return { success: true, cascade, logged: true };
    },

    /** Validate zero-based balance for all months. */
    async validate(): Promise<ValidationResult> {
      const monthly = await store.readTable("budget_monthly");
      const netIncome = await getNetMonthlyIncome(store);

      // Dynamically identify income rows — any category_id in budget_annual with bucket !== needs/wants/debt/savings
      // that has positive values likely represents income offsets (ESPP, RSU, rental, etc.)
      const annual = await store.readTable("budget_annual");
      const incomeCategoryIds = annual
        .filter((r) => r.bucket === "income" || r.notes?.toLowerCase().includes("income"))
        .map((r) => r.category_id);

      // Also detect from monthly: rows where category_id is not in expense_categories
      const expenseCatIds = new Set(annual.map((r) => r.category_id));
      const monthlyOnlyIds = monthly
        .filter((r) => !expenseCatIds.has(r.category_id))
        .map((r) => r.category_id);

      const incomeRowIds = [...new Set([...incomeCategoryIds, ...monthlyOnlyIds])];

      const issues = validateZeroBased(monthly, netIncome, incomeRowIds);
      const annualIssues = validateAnnualMath(await store.readTable("budget_annual"));

      const allIssues = [...issues, ...annualIssues];

      return {
        ok: allIssues.filter((i) => i.severity === "error").length === 0,
        issues: allIssues,
        summary: {
          errors: allIssues.filter((i) => i.severity === "error").length,
          warnings: allIssues.filter((i) => i.severity === "warning").length,
          infos: allIssues.filter((i) => i.severity === "info").length,
        },
      };
    },
  };

  // Helper — base recurring salary income (excludes RSU/ESPP/one-time which are tracked in budget_monthly income rows)
  async function getNetMonthlyIncome(st: BudgetStore): Promise<number> {
    const inc = await st.readTable("income_sources");
    return round2(inc
      .filter((r) => r.frequency === "semi-monthly" || r.frequency === "bi-weekly")
      .reduce((sum, r) => sum + parseFloat(r.net_monthly || "0"), 0));
  }

  // ══════════════════════════════════════════════════════════════════════
  // GOALS
  // ══════════════════════════════════════════════════════════════════════

  const goals = {
    async list(): Promise<Record<string, string>[]> {
      return store.readTable("savings_goals");
    },

    async get(opts: { id: string }): Promise<Record<string, string> | undefined> {
      return store.getRow("savings_goals", { goal_id: opts.id });
    },

    async update(opts: { id: string; field: string; value: string }): Promise<MutationResult> {
      const updated = await store.updateRow("savings_goals", { goal_id: opts.id }, {
        [opts.field]: opts.value,
      });

      if (!updated) return { success: false, error: `Goal not found: ${opts.id}` };

      const cascade = await runCascade(store, "goal_changed", { goalId: opts.id });
      await autoLog(store, "goal_updated", "goals",
        `${opts.id}.${opts.field} = ${opts.value}`,
        ["savings_goals", ...cascade.filesUpdated]);

      return { success: true, cascade, logged: true };
    },

    /** Add a new savings goal. ID is auto-generated if omitted. */
    async add(opts: {
      id?: string; description: string; target_amount: number;
      current_amount?: number; monthly_contribution?: number;
      start_date?: string; target_date?: string;
      priority?: number; status?: string;
    }): Promise<MutationResult> {
      const id = opts.id ?? await nextId("savings_goals", "goal_id", "GOAL-");

      const existing = await store.getRow("savings_goals", { goal_id: id });
      if (existing) return { success: false, error: `Goal already exists: ${id}` };

      const rows = await store.readTable("savings_goals");
      rows.push({
        goal_id: id,
        description: opts.description,
        target_amount: String(opts.target_amount),
        current_amount: String(opts.current_amount ?? 0),
        monthly_contribution: String(opts.monthly_contribution ?? 0),
        start_date: opts.start_date ?? new Date().toISOString().slice(0, 10),
        target_date: opts.target_date ?? "",
        priority: String(opts.priority ?? rows.length + 1),
        status: opts.status ?? "active",
      });
      await store.writeTable("savings_goals", rows);

      const cascade = await runCascade(store, "goal_changed", { goalId: id });
      await autoLog(store, "goal_added", "goals",
        `${id}: ${opts.description} target $${opts.target_amount}`,
        ["savings_goals", ...cascade.filesUpdated]);

      return { success: true, data: { id }, cascade, logged: true };
    },
  };

  // ══════════════════════════════════════════════════════════════════════
  // SNAPSHOT & ANALYSIS
  // ══════════════════════════════════════════════════════════════════════

  const analysis = {
    async snapshot(): Promise<Record<string, string>[]> {
      return store.readTable("snapshot");
    },

    async snapshotGet(opts: { metric: string }): Promise<string | undefined> {
      const row = await store.getRow("snapshot", { metric: opts.metric });
      return row?.value;
    },

    async snapshotSet(opts: { metric: string; value: string; notes?: string }): Promise<MutationResult> {
      const dateStr = new Date().toISOString().slice(0, 10);
      const updated = await store.updateRow("snapshot", { metric: opts.metric }, {
        value: opts.value,
        as_of_date: dateStr,
        ...(opts.notes ? { notes: opts.notes } : {}),
      });

      if (!updated) {
        // Append new metric
        const rows = await store.readTable("snapshot");
        rows.push({
          metric: opts.metric,
          value: opts.value,
          as_of_date: dateStr,
          notes: opts.notes ?? "",
        });
        await store.writeTable("snapshot", rows);
      }

      await autoLog(store, "snapshot_updated", "analysis",
        `${opts.metric} = ${opts.value}`,
        ["snapshot"]);

      return { success: true, logged: true };
    },

    async health(): Promise<Record<string, string>[]> {
      return store.readTable("financial_health");
    },

    async strategy(): Promise<Record<string, string>[]> {
      return store.readTable("goal_allocation_strategy");
    },

    async carAffordability(): Promise<Record<string, string>[]> {
      return store.readTable("car_affordability");
    },

    async houseAffordability(): Promise<Record<string, string>[]> {
      return store.readTable("us_house_affordability");
    },

    /** Forward projection on savings balance. */
    async projectHouseFund(opts: {
      startBalance: number;
      monthlyContribution: number;
      startMonth: string;
      months: number;
      annualYield?: number;
      extras?: Record<string, number>;
    }): Promise<{
      entries: Array<{ month: string; balance: number; contribution: number; interest: number }>;
      finalBalance: number;
    }> {
      const extraMap = opts.extras ? new Map(Object.entries(opts.extras)) : undefined;
      const entries = projectSavings(
        opts.startBalance, opts.monthlyContribution, opts.startMonth,
        opts.months, opts.annualYield ?? 0, extraMap,
      );
      return {
        entries,
        finalBalance: entries.length > 0 ? entries[entries.length - 1].balance : opts.startBalance,
      };
    },
  };

  // ══════════════════════════════════════════════════════════════════════
  // AUDIT (full cross-file validation)
  // ══════════════════════════════════════════════════════════════════════

  async function audit(): Promise<ValidationResult> {
    const issues: ValidationIssue[] = [];

    // 1. Budget zero-based validation
    try {
      const budgetValidation = await allocations.validate();
      issues.push(...budgetValidation.issues);
    } catch (err) {
      issues.push({ severity: "error", file: "budget", message: `Budget validation failed: ${err}` });
    }

    // 2. Debt-payoff sync
    try {
      const debtRows = await store.readTable("debts");
      const payoffRows = await store.readTable("payoff_plan");
      issues.push(...validateDebtPayoffSync(debtRows, payoffRows));
    } catch (err) {
      issues.push({ severity: "warning", file: "debts", message: `Debt sync check failed: ${err}` });
    }

    // 3. Expense-budget sync
    try {
      const expRows = await store.readTable("recurring_expenses");
      const annualRows = await store.readTable("budget_annual");
      issues.push(...validateExpenseBudgetSync(expRows, annualRows));
    } catch (err) {
      issues.push({ severity: "warning", file: "expenses", message: `Expense sync check failed: ${err}` });
    }

    // 4. Snapshot staleness check
    try {
      const snapshot = await store.readTable("snapshot");
      const today = new Date().toISOString().slice(0, 10);
      for (const row of snapshot) {
        const asOf = row.as_of_date;
        if (asOf && asOf < today) {
          // Only flag if > 30 days old
          const daysDiff = Math.floor((Date.now() - new Date(asOf).getTime()) / 86400000);
          if (daysDiff > 30) {
            issues.push({
              severity: "warning",
              file: "snapshot",
              message: `Metric "${row.metric}" last updated ${asOf} (${daysDiff} days ago)`,
            });
          }
        }
      }
    } catch {
      // Skip if no snapshot
    }

    const errors = issues.filter((i) => i.severity === "error").length;
    const warnings = issues.filter((i) => i.severity === "warning").length;
    const infos = issues.filter((i) => i.severity === "info").length;

    return {
      ok: errors === 0,
      issues,
      summary: { errors, warnings, infos },
    };
  }

  // ══════════════════════════════════════════════════════════════════════
  // ACTUALS (ledger)
  // ══════════════════════════════════════════════════════════════════════

  const actuals = {
    async list(opts?: { month?: string }): Promise<Record<string, string>[]> {
      const rows = await store.readTable("ledger");
      if (opts?.month) {
        const month = opts.month;
        return rows.filter((r) => r.date?.startsWith(month ?? ""));
      }
      return rows;
    },

    /** Record a transaction. txn_id is auto-generated if omitted. category_id is validated. */
    async add(entry: Record<string, string>): Promise<MutationResult> {
      // Auto-generate txn_id if missing
      if (!entry.txn_id) {
        entry.txn_id = await nextId("ledger", "txn_id", "TXN-");
      }

      // Validate category_id if provided
      if (entry.category_id && !(await validateCategoryId(entry.category_id))) {
        return { success: false, error: `Unknown category_id: ${entry.category_id}. Check expense_categories.csv.` };
      }

      await store.appendRows("ledger", [entry]);
      await autoLog(store, "transaction_recorded", "actuals",
        `${entry.txn_id}: ${entry.description} $${entry.amount}`,
        ["ledger"]);
      return { success: true, data: entry, logged: true };
    },

    /** Record multiple transactions in one call. Auto-generates txn_ids as needed. */
    async addMany(entries: Record<string, string>[]): Promise<MutationResult> {
      const results: string[] = [];

      // Pre-read ledger to find current max, then increment locally to avoid duplicates
      const existingRows = await store.readTable("ledger");
      let maxNum = 0;
      for (const row of existingRows) {
        const id = row.txn_id ?? "";
        if (id.startsWith("TXN-")) {
          const num = parseInt(id.slice(4), 10);
          if (!isNaN(num) && num > maxNum) maxNum = num;
        }
      }

      for (const entry of entries) {
        if (!entry.txn_id) {
          maxNum++;
          entry.txn_id = `TXN-${String(maxNum).padStart(3, "0")}`;
        }
        if (entry.category_id && !(await validateCategoryId(entry.category_id))) {
          return { success: false, error: `Unknown category_id: ${entry.category_id} in ${entry.txn_id}` };
        }
        results.push(entry.txn_id);
      }

      await store.appendRows("ledger", entries);
      await autoLog(store, "transactions_recorded", "actuals",
        `${entries.length} transactions: ${results.join(", ")}`,
        ["ledger"]);
      return { success: true, data: { txn_ids: results, count: entries.length }, logged: true };
    },

    /** Update a field on an existing ledger entry. */
    async update(opts: { txnId: string; field: string; value: string }): Promise<MutationResult> {
      const updated = await store.updateRow("ledger", { txn_id: opts.txnId }, {
        [opts.field]: opts.value,
      });

      if (!updated) return { success: false, error: `Transaction not found: ${opts.txnId}` };

      await autoLog(store, "transaction_updated", "actuals",
        `${opts.txnId}.${opts.field} = ${opts.value}`,
        ["ledger"]);
      return { success: true, logged: true };
    },

    /** Remove a ledger entry by txn_id. */
    async remove(opts: { txnId: string }): Promise<MutationResult> {
      const deleted = await store.deleteRows("ledger", { txn_id: opts.txnId });
      if (deleted === 0) return { success: false, error: `Transaction not found: ${opts.txnId}` };

      await autoLog(store, "transaction_removed", "actuals",
        `${opts.txnId} deleted`,
        ["ledger"]);
      return { success: true, logged: true };
    },
  };

  // ══════════════════════════════════════════════════════════════════════
  // LOG
  // ══════════════════════════════════════════════════════════════════════

  const log = {
    async list(opts?: { limit?: number }): Promise<Record<string, string>[]> {
      const rows = await store.readTable("planner_log");
      const sorted = rows.reverse();  // newest first
      return opts?.limit ? sorted.slice(0, opts.limit) : sorted;
    },
  };

  // ══════════════════════════════════════════════════════════════════════
  // HELP
  // ══════════════════════════════════════════════════════════════════════

  function help() {
    return {
      name: "budget",
      description: "Family finance engine with cascade updates. Single entry point for all budget operations.",
      root: store.getRoot(),
      year: store.getYear(),
      api: {
        // Config
        "config.get()": "All settings, family, categories",
        "config.getSetting(key)": "Get a single setting",
        "config.setSetting(key, value)": "Set a setting + cascade",
        "config.getCopRate()": "Get COP/USD exchange rate",
        "config.setCopRate(rate)": "Set COP/USD rate + cascade",

        // Income
        "income.list()": "All income sources",
        "income.get({ id })": "Single income source",
        "income.update({ id, field, value })": "Update income field + cascade",
        "income.add({ id, member_id, description, type, gross_monthly, net_monthly, frequency })": "Add income source",

        // Debts
        "debts.list()": "All debts",
        "debts.get({ id })": "Single debt",
        "debts.add({ id?, description, type, current_balance, interest_rate_annual, minimum_payment, ... })": "Add new debt (auto-ID) + cascade",
        "debts.updateBalance({ id, balance, note? })": "⭐ Update balance + CASCADE to 6 files",
        "debts.update({ id, field, value })": "Update any debt field + cascade",
        "debts.recalculatePayoff({ id? })": "Recalculate payoff plan",
        "debts.getPayoffPlan({ id? })": "Get payoff schedule",

        // Expenses
        "expenses.list()": "All recurring expenses",
        "expenses.get({ id })": "Single expense",
        "expenses.add({ id?, description, category_id, amount, frequency?, auto_pay?, vendor?, notes? })": "Add expense (auto-ID, validates category) + cascade",
        "expenses.update({ id, field, value })": "Update expense + cascade",
        "expenses.remove({ id })": "Remove expense + cascade",
        "expenses.summary()": "Group expenses by category with sums",

        // Allocations
        "allocations.listAnnual()": "Annual budget",
        "allocations.listMonthly()": "Monthly budget",
        "allocations.getAnnual({ categoryId })": "Annual row for category",
        "allocations.setAnnual({ categoryId, amount, notes? })": "Set annual allocation + cascade",
        "allocations.setMonthly({ categoryId, month, amount })": "Set specific month amount",
        "allocations.validate()": "Zero-based budget check",

        // Goals
        "goals.list()": "All savings goals",
        "goals.get({ id })": "Single goal",
        "goals.add({ id?, description, target_amount, monthly_contribution?, ... })": "Add goal (auto-ID) + cascade",
        "goals.update({ id, field, value })": "Update goal + cascade",

        // Analysis
        "analysis.snapshot()": "Current financial snapshot",
        "analysis.snapshotGet({ metric })": "Get one snapshot metric",
        "analysis.snapshotSet({ metric, value, notes? })": "Set snapshot metric",
        "analysis.health()": "Financial health metrics",
        "analysis.strategy()": "Goal allocation strategy",
        "analysis.carAffordability()": "Car affordability scenarios",
        "analysis.houseAffordability()": "US house affordability",
        "analysis.projectHouseFund({ startBalance, monthlyContribution, startMonth, months, annualYield?, extras? })": "Forward savings projection",

        // Audit
        "audit()": "Full cross-file validation",

        // Actuals
        "actuals.list({ month? })": "Ledger entries",
        "actuals.add(entry)": "Record a transaction (auto txn_id, validates category_id)",
        "actuals.addMany(entries[])": "Batch-record transactions",
        "actuals.update({ txnId, field, value })": "Fix a ledger entry",
        "actuals.remove({ txnId })": "Delete a ledger entry",

        // Log
        "log.list({ limit? })": "Planner activity log",
      },
      cascade_graph: {
        "debts.updateBalance()": "debts → payoff_plan → snapshot → strategy → financial_health → log",
        "income.update()": "income_sources → snapshot → financial_health → log",
        "expenses.add/update/remove()": "recurring_expenses → financial_health → log",
        "allocations.setAnnual/setMonthly()": "budget_annual/monthly → snapshot → financial_health → log",
        "goals.update()": "savings_goals → snapshot → log",
        "config.setCopRate()": "settings → log",
      },
      examples: [
        {
          title: "Update Colombia loan balance",
          code: `return budget.debts.updateBalance({ id: "DEBT-002", balance: 78378, note: "Actual balance 282163272 COP" })`,
        },
        {
          title: "List all debts",
          code: `return budget.debts.list()`,
        },
        {
          title: "Run full audit",
          code: `return budget.audit()`,
        },
        {
          title: "Project house fund to Dec 2027",
          code: `return budget.analysis.projectHouseFund({ startBalance: 0, monthlyContribution: 908, startMonth: "2026-02", months: 23, annualYield: 0.04 })`,
        },
        {
          title: "Set COP/USD rate",
          code: `return budget.config.setCopRate(3700)`,
        },
      ],
    };
  }

  // ══════════════════════════════════════════════════════════════════════
  // RETURN THE API
  // ══════════════════════════════════════════════════════════════════════

  return {
    help,
    config,
    income,
    debts,
    expenses,
    allocations,
    goals,
    analysis,
    audit,
    actuals,
    log,
  };
}
