// ─── Cascade Engine ───────────────────────────────────────────────────────
// When a file changes, propagate updates to all downstream dependents.
// This is the "killer feature" — no more stale data across 6 files.

import type { BudgetStore } from "../storage/budget-store.js";
import type { CascadeEvent, CascadeResult } from "../types.js";
import {
    calculateBaselineInterest,
    calculatePayoffSchedule,
    round2,
    type PaymentPlan,
} from "./amortization.js";
import { calculateHealthMetrics } from "./budget-validator.js";

interface CascadeContext {
  store: BudgetStore;
  event: CascadeEvent;
  detail: Record<string, unknown>;
}

type CascadeHandler = (ctx: CascadeContext) => Promise<CascadeResult>;

// ── Handler Registry ──────────────────────────────────────────────────────

const handlers: Record<CascadeEvent, CascadeHandler> = {
  debt_balance_changed: cascadeDebtBalanceChanged,
  debt_added: cascadeDebtChanged,
  debt_removed: cascadeDebtChanged,
  income_changed: cascadeIncomeChanged,
  expense_changed: cascadeExpenseChanged,
  expense_added: cascadeExpenseChanged,
  expense_removed: cascadeExpenseChanged,
  allocation_changed: cascadeAllocationChanged,
  goal_changed: cascadeGoalChanged,
  config_changed: cascadeConfigChanged,
};

export async function runCascade(
  store: BudgetStore,
  event: CascadeEvent,
  detail: Record<string, unknown> = {},
): Promise<CascadeResult> {
  const handler = handlers[event];
  if (!handler) {
    return { event, filesUpdated: [], changes: [] };
  }
  return handler({ store, event, detail });
}

// ── Helpers ───────────────────────────────────────────────────────────────

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

async function getNetMonthlyIncome(store: BudgetStore): Promise<number> {
  const income = await store.readTable("income_sources");
  // Only count recurring salary — RSU/ESPP/one-time are tracked separately
  return round2(income
    .filter((r) => r.frequency === "semi-monthly" || r.frequency === "bi-weekly")
    .reduce((sum, r) => sum + parseFloat(r.net_monthly || "0"), 0));
}

async function getGrossMonthlyIncome(store: BudgetStore): Promise<number> {
  const income = await store.readTable("income_sources");
  return round2(income.reduce((sum, r) => sum + parseFloat(r.gross_monthly || "0"), 0));
}

// ── Update Snapshot Metric ────────────────────────────────────────────────

async function updateSnapshotMetric(
  store: BudgetStore,
  metric: string,
  value: string,
  notes?: string,
): Promise<boolean> {
  const dateStr = today();
  return store.updateRow("snapshot", { metric }, {
    value,
    as_of_date: dateStr,
    ...(notes !== undefined ? { notes } : {}),
  });
}

// ── Update Financial Health ───────────────────────────────────────────────

async function recalcFinancialHealth(store: BudgetStore): Promise<string[]> {
  const changes: string[] = [];

  try {
    const debts = await store.readTable("debts");
    const annual = await store.readTable("budget_annual");
    const netIncome = await getNetMonthlyIncome(store);
    const grossIncome = await getGrossMonthlyIncome(store);

    // Sum debt minimum payments for DTI calculation
    const monthlyDebtPayments = debts.reduce((sum, d) => {
      return sum + parseFloat(d.minimum_payment || "0");
    }, 0);

    // Sum savings allocations
    const savingsCats = annual.filter((r) => r.bucket === "savings");
    const monthlySavings = savingsCats.reduce((sum, r) => sum + parseFloat(r.monthly_budget || "0"), 0);

    // Housing cost
    const housingRow = annual.find((r) => r.category_id === "CAT-001");
    const housingCost = housingRow ? parseFloat(housingRow.monthly_budget || "0") : 0;

    // Emergency fund (from snapshot)
    const snapshot = await store.readTable("snapshot");
    const emergencyRow = snapshot.find((r) => r.metric === "total_savings");
    const emergencyFund = emergencyRow ? parseFloat(emergencyRow.value || "0") : 0;

    // Monthly expenses (needs bucket)
    const needsCats = annual.filter((r) => r.bucket === "needs");
    const monthlyExpenses = needsCats.reduce((sum, r) => sum + parseFloat(r.monthly_budget || "0"), 0);

    const metrics = calculateHealthMetrics({
      monthlyDebtPayments,
      grossMonthlyIncome: grossIncome,
      monthlySavings,
      netMonthlyIncome: netIncome,
      emergencyFund,
      monthlyExpenses,
      housingCost,
    });

    // Build the financial health row
    const healthRow: Record<string, string> = {
      date: today(),
      dti_ratio: String(metrics.dti_ratio),
      dti_status: `${metrics.dti_status} (≤0.36)`,
      savings_rate: String(metrics.savings_rate),
      savings_status: `${metrics.savings_status} (<0.20)`,
      emergency_ratio: String(metrics.emergency_ratio),
      emergency_status: `${metrics.emergency_status} (<6.0)`,
      housing_ratio: String(metrics.housing_ratio),
      housing_status: `${metrics.housing_status} (≤0.28)`,
      net_worth_estimate: String(0), // Will be calculated below
      data_source: "budget",
      notes: `Auto-calculated by cascade engine. DTI=${metrics.dti_ratio}, Savings=${metrics.savings_rate}, Housing=${metrics.housing_ratio}`,
    };

    // Net worth
    const totalDebt = debts.reduce((sum, d) => sum + parseFloat(d.current_balance || "0"), 0);
    healthRow.net_worth_estimate = String(round2(emergencyFund - totalDebt));

    await store.writeTable("financial_health", [healthRow]);
    changes.push(`financial_health: DTI=${metrics.dti_ratio}, savings=${metrics.savings_rate}, housing=${metrics.housing_ratio}`);
  } catch {
    changes.push("financial_health: skipped (missing data)");
  }

  return changes;
}

// ── Cascade: Debt Balance Changed ─────────────────────────────────────────
// This is the most complex cascade and the one that burned us most.
// Triggered when: debts.csv current_balance changes
// Cascades to: payoff_plan → snapshot → strategy → financial_health → log

async function cascadeDebtBalanceChanged(ctx: CascadeContext): Promise<CascadeResult> {
  const { store, event, detail } = ctx;
  const debtId = detail.debtId as string;
  const filesUpdated: string[] = ["debts"];
  const changes: Array<{ file: string; description: string }> = [];

  // 1. Read the updated debt
  const debt = await store.getRow("debts", { debt_id: debtId });
  if (!debt) throw new Error(`Debt not found: ${debtId}`);

  const balance = parseFloat(debt.current_balance);
  const rate = parseFloat(debt.interest_rate_annual) / 100;
  const minPayment = parseFloat(debt.minimum_payment);

  changes.push({ file: "debts", description: `${debtId} balance → $${balance}` });

  // 2. Recalculate payoff plan for this debt
  if (await store.exists("payoff_plan")) {
    const allPayoff = await store.readTable("payoff_plan");
    const otherDebtRows = allPayoff.filter((r) => r.debt_id !== debtId);
    // otherDebtRows already holds rows for other debts

    // Build payment plan from existing payoff entries (preserves RSU + freed CC overrides)
    const existingPayoffs = allPayoff.filter((r) => r.debt_id === debtId);
    const paymentPlan: PaymentPlan = {
      regularPayment: minPayment,
      monthlyPayments: new Map(),
    };

    for (const row of existingPayoffs) {
      const total = parseFloat(row.payment || "0");
      if (total > 0) {
        paymentPlan.monthlyPayments.set(row.month, total);
      }
    }

    // Determine start month
    const startMonth = existingPayoffs.length > 0
      ? existingPayoffs[0].month
      : `${store.getYear()}-02`;

    // Calculate new schedule
    const schedule = calculatePayoffSchedule(balance, rate, startMonth, paymentPlan);

    // Convert to CSV rows
    const description = debt.description;
    const newPayoffRows = schedule.map((entry, _idx) => ({
      month: entry.month,
      debt_id: debtId,
      description: description,
      payment: String(round2(entry.payment)),
      extra_payment: String(round2(entry.extraPayment)),
      remaining_balance: String(round2(entry.remainingBalance)),
      interest_paid: String(round2(entry.interest)),
      cumulative_interest: String(round2(entry.cumulativeInterest)),
      notes: entry.remainingBalance <= 0
        ? `PAID OFF! Total interest: $${round2(entry.cumulativeInterest)}`
        : "",
    }));

    // Merge with other debt rows, sorted by month then debt_id
    const merged = [...otherDebtRows, ...newPayoffRows].sort((a, b) => {
      const monthCmp = a.month.localeCompare(b.month);
      return monthCmp !== 0 ? monthCmp : a.debt_id.localeCompare(b.debt_id);
    });

    await store.writeTable("payoff_plan", merged);
    filesUpdated.push("payoff_plan");

    const totalInterest = schedule.length > 0
      ? round2(schedule[schedule.length - 1].cumulativeInterest)
      : 0;
    const payoffMonth = schedule.length > 0
      ? schedule[schedule.length - 1].month
      : "unknown";

    changes.push({
      file: "payoff_plan",
      description: `${debtId}: ${schedule.length} months, total interest $${totalInterest}, payoff ${payoffMonth}`,
    });

    // 2b. Calculate interest savings vs baseline
    const baseline = calculateBaselineInterest(balance, rate, minPayment);
    const interestSaved = round2(baseline.totalInterest - totalInterest);

    // Store for strategy update
    detail._totalInterest = totalInterest;
    detail._interestSaved = interestSaved;
    detail._payoffMonth = payoffMonth;
    detail._yearEndBalance = 0;

    // Find year-end balance
    const decRow = schedule.find((e) => e.month === `${store.getYear()}-12`);
    if (decRow) {
      detail._yearEndBalance = round2(decRow.remainingBalance);
    }

    // Find surplus at payoff
    const payoffEntry = schedule.find((e) => e.remainingBalance <= 0);
    if (payoffEntry) {
      const scheduledPayment = paymentPlan.monthlyPayments.get(payoffEntry.month) ?? paymentPlan.regularPayment;
      detail._surplus = round2(scheduledPayment - payoffEntry.payment);
    }
  }

  // 3. Update snapshot
  try {
    const debts = await store.readTable("debts");
    const totalDebt = debts.reduce((sum, d) => sum + parseFloat(d.current_balance || "0"), 0);
    await updateSnapshotMetric(store, "total_debt_balance", String(round2(totalDebt)),
      debts.map((d) => `${d.description} $${d.current_balance}`).join(" + "));

    const snapshot = await store.readTable("snapshot");
    const savingsRow = snapshot.find((r) => r.metric === "total_savings");
    const totalSavings = savingsRow ? parseFloat(savingsRow.value || "0") : 0;
    await updateSnapshotMetric(store, "estimated_net_worth", String(round2(totalSavings - totalDebt)),
      "Savings - Debt (excludes Colombia home equity)");

    filesUpdated.push("snapshot");
    changes.push({ file: "snapshot", description: `total_debt=$${round2(totalDebt)}` });
  } catch {
    changes.push({ file: "snapshot", description: "skipped (file missing)" });
  }

  // 4. Update strategy projections
  try {
    if (await store.exists("goal_allocation_strategy")) {
      const totalInterest = detail._totalInterest as number | undefined;
      const interestSaved = detail._interestSaved as number | undefined;
      const yearEndBal = detail._yearEndBalance as number | undefined;
      if (totalInterest !== undefined) {
        await store.updateRow("goal_allocation_strategy",
          { section: "COLOMBIA", parameter: "starting_balance" },
          { scenario_a_colombia_first: String(balance), notes: `Updated ${today()}` });

        await store.updateRow("goal_allocation_strategy",
          { section: "COLOMBIA", parameter: "balance_dec_2026" },
          { scenario_a_colombia_first: String(yearEndBal) });

        await store.updateRow("goal_allocation_strategy",
          { section: "COLOMBIA", parameter: "total_interest_paid" },
          { scenario_a_colombia_first: String(totalInterest) });

        await store.updateRow("goal_allocation_strategy",
          { section: "COLOMBIA", parameter: "interest_saved_vs_baseline" },
          { scenario_a_colombia_first: String(interestSaved) });

        filesUpdated.push("goal_allocation_strategy");
        changes.push({ file: "goal_allocation_strategy", description: `Colombia projections updated` });
      }
    }
  } catch {
    changes.push({ file: "goal_allocation_strategy", description: "skipped (file missing)" });
  }

  // 5. Recalculate financial health
  const healthChanges = await recalcFinancialHealth(store);
  if (healthChanges.length > 0) {
    filesUpdated.push("financial_health");
    changes.push(...healthChanges.map((c) => ({ file: "financial_health", description: c })));
  }

  return { event, filesUpdated, changes };
}

// ── Cascade: Debt Added/Removed ───────────────────────────────────────────

async function cascadeDebtChanged(ctx: CascadeContext): Promise<CascadeResult> {
  // For simplicity, re-run the same cascade as balance changed for the specific debt
  // Plus update total debt in snapshot
  const result = await cascadeDebtBalanceChanged(ctx);
  return result;
}

// ── Cascade: Income Changed ───────────────────────────────────────────────

async function cascadeIncomeChanged(ctx: CascadeContext): Promise<CascadeResult> {
  const { store, event } = ctx;
  const filesUpdated: string[] = [];
  const changes: Array<{ file: string; description: string }> = [];

  // Update snapshot with new income
  try {
    const netIncome = await getNetMonthlyIncome(store);
    const grossIncome = await getGrossMonthlyIncome(store);

    await updateSnapshotMetric(store, "total_net_monthly_income", String(netIncome));
    await updateSnapshotMetric(store, "total_gross_monthly_income", String(grossIncome));
    filesUpdated.push("snapshot");
    changes.push({ file: "snapshot", description: `income: net=$${netIncome}, gross=$${grossIncome}` });
  } catch {
    changes.push({ file: "snapshot", description: "skipped" });
  }

  // Recalculate financial health
  const healthChanges = await recalcFinancialHealth(store);
  if (healthChanges.length > 0) {
    filesUpdated.push("financial_health");
    changes.push(...healthChanges.map((c) => ({ file: "financial_health", description: c })));
  }

  return { event, filesUpdated, changes };
}

// ── Cascade: Expense Changed ──────────────────────────────────────────────

async function cascadeExpenseChanged(ctx: CascadeContext): Promise<CascadeResult> {
  const { store, event } = ctx;
  const filesUpdated: string[] = [];
  const changes: Array<{ file: string; description: string }> = [];

  // Recalculate financial health (expenses affect DTI, savings rate)
  const healthChanges = await recalcFinancialHealth(store);
  if (healthChanges.length > 0) {
    filesUpdated.push("financial_health");
    changes.push(...healthChanges.map((c) => ({ file: "financial_health", description: c })));
  }

  return { event, filesUpdated, changes };
}

// ── Cascade: Allocation Changed ───────────────────────────────────────────

async function cascadeAllocationChanged(ctx: CascadeContext): Promise<CascadeResult> {
  const { store, event } = ctx;
  const filesUpdated: string[] = [];
  const changes: Array<{ file: string; description: string }> = [];

  // Update snapshot totals per bucket
  try {
    const annual = await store.readTable("budget_annual");
    const buckets: Record<string, number> = { needs: 0, wants: 0, debt: 0, savings: 0 };

    for (const row of annual) {
      const bucket = row.bucket;
      const amount = parseFloat(row.monthly_budget || "0");
      if (bucket in buckets) {
        buckets[bucket] += amount;
      }
    }

    for (const [bucket, total] of Object.entries(buckets)) {
      await updateSnapshotMetric(store, `monthly_${bucket}`, String(round2(total)));
    }

    filesUpdated.push("snapshot");
    changes.push({
      file: "snapshot",
      description: `Buckets: needs=$${round2(buckets.needs)}, wants=$${round2(buckets.wants)}, debt=$${round2(buckets.debt)}, savings=$${round2(buckets.savings)}`,
    });
  } catch {
    changes.push({ file: "snapshot", description: "skipped" });
  }

  // Recalculate financial health
  const healthChanges = await recalcFinancialHealth(store);
  if (healthChanges.length > 0) {
    filesUpdated.push("financial_health");
    changes.push(...healthChanges.map((c) => ({ file: "financial_health", description: c })));
  }

  return { event, filesUpdated, changes };
}

// ── Cascade: Goal Changed ─────────────────────────────────────────────────

async function cascadeGoalChanged(ctx: CascadeContext): Promise<CascadeResult> {
  const { store, event } = ctx;
  const filesUpdated: string[] = [];
  const changes: Array<{ file: string; description: string }> = [];

  // Light cascade — just update snapshot
  try {
    const goals = await store.readTable("savings_goals");
    const activeGoals = goals.filter((g) => g.status === "active");
    const totalMonthly = activeGoals.reduce((s, g) => s + parseFloat(g.monthly_contribution || "0"), 0);
    await updateSnapshotMetric(store, "active_goals_count", String(activeGoals.length));
    await updateSnapshotMetric(store, "total_goal_contributions", String(round2(totalMonthly)));
    filesUpdated.push("snapshot");
    changes.push({ file: "snapshot", description: `${activeGoals.length} active goals, $${round2(totalMonthly)}/mo` });
  } catch {
    changes.push({ file: "snapshot", description: "skipped" });
  }

  return { event, filesUpdated, changes };
}

// ── Cascade: Config Changed ───────────────────────────────────────────────

async function cascadeConfigChanged(ctx: CascadeContext): Promise<CascadeResult> {
  const { event, detail } = ctx;
  const filesUpdated: string[] = [];
  const changes: Array<{ file: string; description: string }> = [];

  const key = detail.key as string | undefined;

  if (key === "cop_usd_rate") {
    const newRate = detail.value as number;
    changes.push({ file: "settings", description: `COP/USD rate → ${newRate}` });
    // Could cascade to recalculate all COP-denominated values
    // For now just log — user can trigger recalculations manually
  }

  return { event, filesUpdated, changes };
}
