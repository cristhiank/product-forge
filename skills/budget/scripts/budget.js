// dist/engine/amortization.js
function round2(n) {
  return Math.round(n * 100) / 100;
}
function monthlyInterest(balance, annualRate) {
  return round2(balance * annualRate / 12);
}
function calculatePayoffSchedule(startBalance, annualRate, startMonth, plan, maxMonths = 360) {
  const entries = [];
  let balance = round2(startBalance);
  let cumInterest = 0;
  let [year, month] = startMonth.split("-").map(Number);
  for (let i = 0; i < maxMonths && balance > 0; i++) {
    const monthStr = `${year}-${String(month).padStart(2, "0")}`;
    const interest = monthlyInterest(balance, annualRate);
    const scheduledPayment = plan.monthlyPayments.get(monthStr) ?? plan.regularPayment;
    const actualPayment = round2(Math.min(scheduledPayment, balance + interest));
    const principal = round2(actualPayment - interest);
    balance = round2(balance - principal);
    cumInterest = round2(cumInterest + interest);
    const extra = round2(Math.max(0, actualPayment - plan.regularPayment));
    entries.push({
      month: monthStr,
      payment: actualPayment,
      extraPayment: extra,
      interest,
      principal,
      remainingBalance: Math.max(0, balance),
      cumulativeInterest: cumInterest
    });
    if (balance <= 0)
      break;
    month++;
    if (month > 12) {
      month = 1;
      year++;
    }
  }
  return entries;
}
function calculateBaselineInterest(balance, annualRate, monthlyPayment, maxMonths = 360) {
  let remaining = balance;
  let totalInterest = 0;
  let months = 0;
  for (let i = 0; i < maxMonths && remaining > 0; i++) {
    const interest = monthlyInterest(remaining, annualRate);
    const payment = Math.min(monthlyPayment, remaining + interest);
    const principal = payment - interest;
    remaining = round2(remaining - principal);
    totalInterest = round2(totalInterest + interest);
    months++;
    if (principal <= 0) {
      return { totalInterest: Infinity, months: Infinity };
    }
  }
  return { totalInterest, months };
}
function projectSavings(startBalance, monthlyContribution, startMonth, months, annualYield = 0, extraContributions) {
  const entries = [];
  let balance = startBalance;
  let [year, month] = startMonth.split("-").map(Number);
  for (let i = 0; i < months; i++) {
    const monthStr = `${year}-${String(month).padStart(2, "0")}`;
    const yieldAmount = round2(balance * annualYield / 12);
    const extra = extraContributions?.get(monthStr) ?? 0;
    const contribution = round2(monthlyContribution + extra);
    balance = round2(balance + contribution + yieldAmount);
    entries.push({
      month: monthStr,
      balance,
      contribution,
      interest: yieldAmount
    });
    month++;
    if (month > 12) {
      month = 1;
      year++;
    }
  }
  return entries;
}

// dist/engine/budget-validator.js
function validateZeroBased(monthlyRows, netMonthlyIncome, incomeRowIds) {
  const issues = [];
  const months = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"];
  for (const month of months) {
    let totalAllocated = 0;
    let totalIncome = 0;
    for (const row of monthlyRows) {
      if (row.category_id === "TOTAL")
        continue;
      const val = parseFloat(row[month] || "0");
      if (isNaN(val))
        continue;
      if (incomeRowIds.includes(row.category_id ?? "")) {
        totalIncome += val;
      } else {
        totalAllocated += val;
      }
    }
    const effectiveIncome = round2(netMonthlyIncome + totalIncome);
    const diff = round2(effectiveIncome - totalAllocated);
    if (Math.abs(diff) > 0.5) {
      issues.push({
        severity: "error",
        file: "budget_monthly",
        message: `${month}: income ($${effectiveIncome}) \u2260 allocations ($${totalAllocated}). Unallocated: $${diff}`,
        expected: String(effectiveIncome),
        actual: String(totalAllocated)
      });
    }
  }
  return issues;
}
function calculateHealthMetrics(opts) {
  const dti = round2(opts.monthlyDebtPayments / opts.grossMonthlyIncome);
  const savings = round2(opts.monthlySavings / opts.netMonthlyIncome);
  const emergency = round2(opts.emergencyFund / opts.monthlyExpenses);
  const housing = round2(opts.housingCost / opts.grossMonthlyIncome);
  return {
    dti_ratio: dti,
    dti_status: dti <= 0.36 ? "\u2705" : dti <= 0.43 ? "\u{1F7E1}" : "\u{1F534}",
    savings_rate: savings,
    savings_status: savings >= 0.2 ? "\u2705" : savings >= 0.1 ? "\u{1F7E1}" : "\u{1F534}",
    emergency_ratio: emergency,
    emergency_status: emergency >= 6 ? "\u2705" : emergency >= 3 ? "\u{1F7E1}" : "\u{1F534}",
    housing_ratio: housing,
    housing_status: housing <= 0.28 ? "\u2705" : housing <= 0.36 ? "\u{1F7E1}" : "\u{1F534}"
  };
}
function validateDebtPayoffSync(debts, payoffRows) {
  const issues = [];
  for (const debt of debts) {
    const debtId = debt.debt_id;
    const debtPayoffs = payoffRows.filter((r) => r.debt_id === debtId);
    if (debtPayoffs.length === 0) {
      issues.push({
        severity: "warning",
        file: "payoff_plan",
        message: `No payoff plan entries for ${debtId} (${debt.description})`
      });
    }
  }
  return issues;
}
function validateAnnualMath(annualRows) {
  const issues = [];
  for (const row of annualRows) {
    const monthly = parseFloat(row.monthly_budget || "0");
    const annual = parseFloat(row.annual_budget || "0");
    if (monthly > 0 && annual > 0) {
      const expected = round2(monthly * 12);
      if (Math.abs(expected - annual) > 1) {
        issues.push({
          severity: "info",
          file: "budget_annual",
          message: `${row.category_id} ${row.category}: monthly $${monthly} \xD7 12 = $${expected} \u2260 annual $${annual}`,
          expected: String(expected),
          actual: String(annual)
        });
      }
    }
  }
  return issues;
}
function validateExpenseBudgetSync(expenses, annual) {
  const issues = [];
  const budgetByCategory = new Map(annual.map((r) => [r.category_id, parseFloat(r.monthly_budget || "0")]));
  for (const exp of expenses) {
    const catId = exp.category_id;
    const expAmount = parseFloat(exp.amount || "0");
    const budgetAmount = budgetByCategory.get(catId);
    if (budgetAmount !== void 0 && Math.abs(budgetAmount - expAmount) > 0.01) {
      issues.push({
        severity: "info",
        file: "recurring_expenses",
        message: `${exp.expense_id} (${exp.description}): expense $${expAmount} vs budget $${budgetAmount} for ${catId}`
      });
    }
  }
  return issues;
}

// dist/engine/cascade.js
var handlers = {
  debt_balance_changed: cascadeDebtBalanceChanged,
  debt_added: cascadeDebtChanged,
  debt_removed: cascadeDebtChanged,
  income_changed: cascadeIncomeChanged,
  expense_changed: cascadeExpenseChanged,
  expense_added: cascadeExpenseChanged,
  expense_removed: cascadeExpenseChanged,
  allocation_changed: cascadeAllocationChanged,
  goal_changed: cascadeGoalChanged,
  config_changed: cascadeConfigChanged
};
async function runCascade(store, event, detail = {}) {
  const handler = handlers[event];
  if (!handler) {
    return { event, filesUpdated: [], changes: [] };
  }
  return handler({ store, event, detail });
}
function today() {
  return (/* @__PURE__ */ new Date()).toISOString().slice(0, 10);
}
async function getNetMonthlyIncome(store) {
  const income = await store.readTable("income_sources");
  return round2(income.filter((r) => r.frequency === "semi-monthly" || r.frequency === "bi-weekly").reduce((sum, r) => sum + parseFloat(r.net_monthly || "0"), 0));
}
async function getGrossMonthlyIncome(store) {
  const income = await store.readTable("income_sources");
  return round2(income.reduce((sum, r) => sum + parseFloat(r.gross_monthly || "0"), 0));
}
async function updateSnapshotMetric(store, metric, value, notes) {
  const dateStr = today();
  return store.updateRow("snapshot", { metric }, {
    value,
    as_of_date: dateStr,
    ...notes !== void 0 ? { notes } : {}
  });
}
async function recalcFinancialHealth(store) {
  const changes = [];
  try {
    const debts = await store.readTable("debts");
    const annual = await store.readTable("budget_annual");
    const netIncome = await getNetMonthlyIncome(store);
    const grossIncome = await getGrossMonthlyIncome(store);
    const monthlyDebtPayments = debts.reduce((sum, d) => {
      return sum + parseFloat(d.minimum_payment || "0");
    }, 0);
    const savingsCats = annual.filter((r) => r.bucket === "savings");
    const monthlySavings = savingsCats.reduce((sum, r) => sum + parseFloat(r.monthly_budget || "0"), 0);
    const housingRow = annual.find((r) => r.category_id === "CAT-001");
    const housingCost = housingRow ? parseFloat(housingRow.monthly_budget || "0") : 0;
    const snapshot = await store.readTable("snapshot");
    const emergencyRow = snapshot.find((r) => r.metric === "total_savings");
    const emergencyFund = emergencyRow ? parseFloat(emergencyRow.value || "0") : 0;
    const needsCats = annual.filter((r) => r.bucket === "needs");
    const monthlyExpenses = needsCats.reduce((sum, r) => sum + parseFloat(r.monthly_budget || "0"), 0);
    const metrics = calculateHealthMetrics({
      monthlyDebtPayments,
      grossMonthlyIncome: grossIncome,
      monthlySavings,
      netMonthlyIncome: netIncome,
      emergencyFund,
      monthlyExpenses,
      housingCost
    });
    const healthRow = {
      date: today(),
      dti_ratio: String(metrics.dti_ratio),
      dti_status: `${metrics.dti_status} (\u22640.36)`,
      savings_rate: String(metrics.savings_rate),
      savings_status: `${metrics.savings_status} (<0.20)`,
      emergency_ratio: String(metrics.emergency_ratio),
      emergency_status: `${metrics.emergency_status} (<6.0)`,
      housing_ratio: String(metrics.housing_ratio),
      housing_status: `${metrics.housing_status} (\u22640.28)`,
      net_worth_estimate: String(0),
      // Will be calculated below
      data_source: "budget",
      notes: `Auto-calculated by cascade engine. DTI=${metrics.dti_ratio}, Savings=${metrics.savings_rate}, Housing=${metrics.housing_ratio}`
    };
    const totalDebt = debts.reduce((sum, d) => sum + parseFloat(d.current_balance || "0"), 0);
    healthRow.net_worth_estimate = String(round2(emergencyFund - totalDebt));
    await store.writeTable("financial_health", [healthRow]);
    changes.push(`financial_health: DTI=${metrics.dti_ratio}, savings=${metrics.savings_rate}, housing=${metrics.housing_ratio}`);
  } catch {
    changes.push("financial_health: skipped (missing data)");
  }
  return changes;
}
async function cascadeDebtBalanceChanged(ctx) {
  const { store, event, detail } = ctx;
  const debtId = detail.debtId;
  const filesUpdated = ["debts"];
  const changes = [];
  const debt = await store.getRow("debts", { debt_id: debtId });
  if (!debt)
    throw new Error(`Debt not found: ${debtId}`);
  const balance = parseFloat(debt.current_balance);
  const rate = parseFloat(debt.interest_rate_annual) / 100;
  const minPayment = parseFloat(debt.minimum_payment);
  changes.push({ file: "debts", description: `${debtId} balance \u2192 $${balance}` });
  if (await store.exists("payoff_plan")) {
    const allPayoff = await store.readTable("payoff_plan");
    const otherDebtRows = allPayoff.filter((r) => r.debt_id !== debtId);
    const existingPayoffs = allPayoff.filter((r) => r.debt_id === debtId);
    const paymentPlan = {
      regularPayment: minPayment,
      monthlyPayments: /* @__PURE__ */ new Map()
    };
    for (const row of existingPayoffs) {
      const total = parseFloat(row.payment || "0");
      if (total > 0) {
        paymentPlan.monthlyPayments.set(row.month, total);
      }
    }
    const startMonth = existingPayoffs.length > 0 ? existingPayoffs[0].month : `${store.getYear()}-02`;
    const schedule = calculatePayoffSchedule(balance, rate, startMonth, paymentPlan);
    const description = debt.description;
    const newPayoffRows = schedule.map((entry, _idx) => ({
      month: entry.month,
      debt_id: debtId,
      description,
      payment: String(round2(entry.payment)),
      extra_payment: String(round2(entry.extraPayment)),
      remaining_balance: String(round2(entry.remainingBalance)),
      interest_paid: String(round2(entry.interest)),
      cumulative_interest: String(round2(entry.cumulativeInterest)),
      notes: entry.remainingBalance <= 0 ? `PAID OFF! Total interest: $${round2(entry.cumulativeInterest)}` : ""
    }));
    const merged = [...otherDebtRows, ...newPayoffRows].sort((a, b) => {
      const monthCmp = a.month.localeCompare(b.month);
      return monthCmp !== 0 ? monthCmp : a.debt_id.localeCompare(b.debt_id);
    });
    await store.writeTable("payoff_plan", merged);
    filesUpdated.push("payoff_plan");
    const totalInterest = schedule.length > 0 ? round2(schedule[schedule.length - 1].cumulativeInterest) : 0;
    const payoffMonth = schedule.length > 0 ? schedule[schedule.length - 1].month : "unknown";
    changes.push({
      file: "payoff_plan",
      description: `${debtId}: ${schedule.length} months, total interest $${totalInterest}, payoff ${payoffMonth}`
    });
    const baseline = calculateBaselineInterest(balance, rate, minPayment);
    const interestSaved = round2(baseline.totalInterest - totalInterest);
    detail._totalInterest = totalInterest;
    detail._interestSaved = interestSaved;
    detail._payoffMonth = payoffMonth;
    detail._yearEndBalance = 0;
    const decRow = schedule.find((e) => e.month === `${store.getYear()}-12`);
    if (decRow) {
      detail._yearEndBalance = round2(decRow.remainingBalance);
    }
    const payoffEntry = schedule.find((e) => e.remainingBalance <= 0);
    if (payoffEntry) {
      const scheduledPayment = paymentPlan.monthlyPayments.get(payoffEntry.month) ?? paymentPlan.regularPayment;
      detail._surplus = round2(scheduledPayment - payoffEntry.payment);
    }
  }
  try {
    const debts = await store.readTable("debts");
    const totalDebt = debts.reduce((sum, d) => sum + parseFloat(d.current_balance || "0"), 0);
    await updateSnapshotMetric(store, "total_debt_balance", String(round2(totalDebt)), debts.map((d) => `${d.description} $${d.current_balance}`).join(" + "));
    const snapshot = await store.readTable("snapshot");
    const savingsRow = snapshot.find((r) => r.metric === "total_savings");
    const totalSavings = savingsRow ? parseFloat(savingsRow.value || "0") : 0;
    await updateSnapshotMetric(store, "estimated_net_worth", String(round2(totalSavings - totalDebt)), "Savings - Debt (excludes Colombia home equity)");
    filesUpdated.push("snapshot");
    changes.push({ file: "snapshot", description: `total_debt=$${round2(totalDebt)}` });
  } catch {
    changes.push({ file: "snapshot", description: "skipped (file missing)" });
  }
  try {
    if (await store.exists("goal_allocation_strategy")) {
      const totalInterest = detail._totalInterest;
      const interestSaved = detail._interestSaved;
      const yearEndBal = detail._yearEndBalance;
      if (totalInterest !== void 0) {
        await store.updateRow("goal_allocation_strategy", { section: "COLOMBIA", parameter: "starting_balance" }, { scenario_a_colombia_first: String(balance), notes: `Updated ${today()}` });
        await store.updateRow("goal_allocation_strategy", { section: "COLOMBIA", parameter: "balance_dec_2026" }, { scenario_a_colombia_first: String(yearEndBal) });
        await store.updateRow("goal_allocation_strategy", { section: "COLOMBIA", parameter: "total_interest_paid" }, { scenario_a_colombia_first: String(totalInterest) });
        await store.updateRow("goal_allocation_strategy", { section: "COLOMBIA", parameter: "interest_saved_vs_baseline" }, { scenario_a_colombia_first: String(interestSaved) });
        filesUpdated.push("goal_allocation_strategy");
        changes.push({ file: "goal_allocation_strategy", description: `Colombia projections updated` });
      }
    }
  } catch {
    changes.push({ file: "goal_allocation_strategy", description: "skipped (file missing)" });
  }
  const healthChanges = await recalcFinancialHealth(store);
  if (healthChanges.length > 0) {
    filesUpdated.push("financial_health");
    changes.push(...healthChanges.map((c) => ({ file: "financial_health", description: c })));
  }
  return { event, filesUpdated, changes };
}
async function cascadeDebtChanged(ctx) {
  const result = await cascadeDebtBalanceChanged(ctx);
  return result;
}
async function cascadeIncomeChanged(ctx) {
  const { store, event } = ctx;
  const filesUpdated = [];
  const changes = [];
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
  const healthChanges = await recalcFinancialHealth(store);
  if (healthChanges.length > 0) {
    filesUpdated.push("financial_health");
    changes.push(...healthChanges.map((c) => ({ file: "financial_health", description: c })));
  }
  return { event, filesUpdated, changes };
}
async function cascadeExpenseChanged(ctx) {
  const { store, event } = ctx;
  const filesUpdated = [];
  const changes = [];
  const healthChanges = await recalcFinancialHealth(store);
  if (healthChanges.length > 0) {
    filesUpdated.push("financial_health");
    changes.push(...healthChanges.map((c) => ({ file: "financial_health", description: c })));
  }
  return { event, filesUpdated, changes };
}
async function cascadeAllocationChanged(ctx) {
  const { store, event } = ctx;
  const filesUpdated = [];
  const changes = [];
  try {
    const annual = await store.readTable("budget_annual");
    const buckets = { needs: 0, wants: 0, debt: 0, savings: 0 };
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
      description: `Buckets: needs=$${round2(buckets.needs)}, wants=$${round2(buckets.wants)}, debt=$${round2(buckets.debt)}, savings=$${round2(buckets.savings)}`
    });
  } catch {
    changes.push({ file: "snapshot", description: "skipped" });
  }
  const healthChanges = await recalcFinancialHealth(store);
  if (healthChanges.length > 0) {
    filesUpdated.push("financial_health");
    changes.push(...healthChanges.map((c) => ({ file: "financial_health", description: c })));
  }
  return { event, filesUpdated, changes };
}
async function cascadeGoalChanged(ctx) {
  const { store, event } = ctx;
  const filesUpdated = [];
  const changes = [];
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
async function cascadeConfigChanged(ctx) {
  const { event, detail } = ctx;
  const filesUpdated = [];
  const changes = [];
  const key = detail.key;
  if (key === "cop_usd_rate") {
    const newRate = detail.value;
    changes.push({ file: "settings", description: `COP/USD rate \u2192 ${newRate}` });
  }
  return { event, filesUpdated, changes };
}

// dist/budget-api.js
async function autoLog(store, action, taskType, details, filesModified) {
  try {
    await store.appendRows("planner_log", [{
      timestamp: (/* @__PURE__ */ new Date()).toISOString(),
      action,
      task_type: taskType,
      details,
      files_modified: filesModified.join(";")
    }]);
  } catch {
  }
}
function createBudgetAPI(store) {
  async function nextId(table, column, prefix) {
    const rows = await store.readTable(table);
    let max = 0;
    for (const row of rows) {
      const id = row[column] ?? "";
      if (id.startsWith(prefix)) {
        const num = parseInt(id.slice(prefix.length), 10);
        if (!isNaN(num) && num > max)
          max = num;
      }
    }
    return `${prefix}${String(max + 1).padStart(3, "0")}`;
  }
  async function validateCategoryId(categoryId) {
    const row = await store.getRow("expense_categories", { category_id: categoryId });
    return row !== void 0;
  }
  const config = {
    async get() {
      const [settings, family, categories] = await Promise.all([
        store.readTable("settings"),
        store.readTable("family_profile"),
        store.readTable("expense_categories")
      ]);
      return { settings, family, categories };
    },
    async getSetting(key) {
      const row = await store.getRow("settings", { key });
      return row?.value;
    },
    async setSetting(key, value) {
      const updated = await store.updateRow("settings", { key }, {
        value,
        updated: (/* @__PURE__ */ new Date()).toISOString().slice(0, 10)
      });
      if (!updated) {
        const settings = await store.readTable("settings");
        settings.push({ key, value, updated: (/* @__PURE__ */ new Date()).toISOString().slice(0, 10) });
        await store.writeTable("settings", settings);
      }
      const cascade = await runCascade(store, "config_changed", { key, value });
      await autoLog(store, "config_updated", "config", `${key} = ${value}`, ["settings", ...cascade.filesUpdated]);
      return { success: true, data: { key, value }, cascade, logged: true };
    },
    async getCopRate() {
      const val = await config.getSetting("cop_usd_rate");
      return val ? parseFloat(val) : 3600;
    },
    async setCopRate(rate) {
      return config.setSetting("cop_usd_rate", String(rate));
    }
  };
  const income = {
    async list() {
      return store.readTable("income_sources");
    },
    async get(opts) {
      return store.getRow("income_sources", { source_id: opts.id });
    },
    async update(opts) {
      const updated = await store.updateRow("income_sources", { source_id: opts.id }, {
        [opts.field]: opts.value
      });
      if (!updated)
        return { success: false, error: `Income source not found: ${opts.id}` };
      const cascade = await runCascade(store, "income_changed", { sourceId: opts.id });
      await autoLog(store, "income_updated", "income", `${opts.id}.${opts.field} = ${opts.value}`, ["income_sources", ...cascade.filesUpdated]);
      return { success: true, data: { id: opts.id, field: opts.field, value: opts.value }, cascade, logged: true };
    },
    async add(opts) {
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
        notes: opts.notes ?? ""
      });
      await store.writeTable("income_sources", rows);
      const cascade = await runCascade(store, "income_changed", { sourceId: opts.id });
      await autoLog(store, "income_added", "income", `${opts.id}: ${opts.description} $${opts.net_monthly}/mo`, ["income_sources", ...cascade.filesUpdated]);
      return { success: true, data: { id: opts.id }, cascade, logged: true };
    }
  };
  const debts = {
    async list() {
      return store.readTable("debts");
    },
    async get(opts) {
      return store.getRow("debts", { debt_id: opts.id });
    },
    /**
     * Update a debt's balance and cascade to all dependents.
     * This is the operation that used to require editing 6 files manually.
     */
    async updateBalance(opts) {
      const updated = await store.updateRow("debts", { debt_id: opts.id }, {
        current_balance: String(opts.balance),
        ...opts.note ? { notes: opts.note } : {}
      });
      if (!updated)
        return { success: false, error: `Debt not found: ${opts.id}` };
      const cascade = await runCascade(store, "debt_balance_changed", {
        debtId: opts.id,
        newBalance: opts.balance
      });
      await autoLog(store, "debt_balance_updated", "debt", `${opts.id} balance \u2192 $${opts.balance}${opts.note ? `. ${opts.note}` : ""}`, ["debts", ...cascade.filesUpdated]);
      return { success: true, data: { id: opts.id, balance: opts.balance }, cascade, logged: true };
    },
    async update(opts) {
      const updated = await store.updateRow("debts", { debt_id: opts.id }, {
        [opts.field]: opts.value
      });
      if (!updated)
        return { success: false, error: `Debt not found: ${opts.id}` };
      const cascade = await runCascade(store, "debt_balance_changed", { debtId: opts.id });
      await autoLog(store, "debt_updated", "debt", `${opts.id}.${opts.field} = ${opts.value}`, ["debts", ...cascade.filesUpdated]);
      return { success: true, cascade, logged: true };
    },
    /**
     * Recalculate the payoff plan for a specific debt.
     * Uses the current balance and payment schedule from payoff_plan.csv.
     */
    async recalculatePayoff(opts) {
      const allDebts = await store.readTable("debts");
      const targetDebts = opts?.id ? allDebts.filter((d) => d.debt_id === opts.id) : allDebts;
      const results = [];
      for (const debt of targetDebts) {
        await runCascade(store, "debt_balance_changed", { debtId: debt.debt_id });
        results.push({
          debtId: debt.debt_id,
          months: 0,
          // filled by cascade
          totalInterest: 0
        });
      }
      await autoLog(store, "payoff_recalculated", "debt", `Recalculated payoff for ${targetDebts.map((d) => d.debt_id).join(", ")}`, ["payoff_plan", "snapshot", "goal_allocation_strategy", "financial_health"]);
      return { success: true, data: results, logged: true };
    },
    /** Get the current payoff plan for all debts or a specific one. */
    async getPayoffPlan(opts) {
      const rows = await store.readTable("payoff_plan");
      if (opts?.id)
        return rows.filter((r) => r.debt_id === opts.id);
      return rows;
    },
    /** Add a new debt. ID is auto-generated if omitted. */
    async add(opts) {
      const id = opts.id ?? await nextId("debts", "debt_id", "DEBT-");
      const existing = await store.getRow("debts", { debt_id: id });
      if (existing)
        return { success: false, error: `Debt already exists: ${id}` };
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
        start_date: opts.start_date ?? (/* @__PURE__ */ new Date()).toISOString().slice(0, 10),
        term_months: String(opts.term_months ?? ""),
        lender: opts.lender ?? "",
        priority_snowball: String(opts.priority_snowball ?? rows.length + 1),
        priority_avalanche: String(opts.priority_avalanche ?? rows.length + 1),
        notes: opts.notes ?? ""
      });
      await store.writeTable("debts", rows);
      const cascade = await runCascade(store, "debt_added", { debtId: id });
      await autoLog(store, "debt_added", "debt", `${id}: ${opts.description} $${opts.current_balance} @ ${opts.interest_rate_annual}%`, ["debts", ...cascade.filesUpdated]);
      return { success: true, data: { id }, cascade, logged: true };
    }
  };
  const expenses = {
    async list() {
      return store.readTable("recurring_expenses");
    },
    async get(opts) {
      return store.getRow("recurring_expenses", { expense_id: opts.id });
    },
    async add(opts) {
      if (!await validateCategoryId(opts.category_id)) {
        return { success: false, error: `Unknown category_id: ${opts.category_id}. Check expense_categories.csv.` };
      }
      const id = opts.id ?? await nextId("recurring_expenses", "expense_id", "EXP-");
      const existing = await store.getRow("recurring_expenses", { expense_id: id });
      if (existing)
        return { success: false, error: `Expense already exists: ${id}` };
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
        notes: opts.notes ?? ""
      });
      await store.writeTable("recurring_expenses", rows);
      const cascade = await runCascade(store, "expense_added", { expenseId: id });
      await autoLog(store, "expense_added", "expense", `${id}: ${opts.description} $${opts.amount}/mo`, ["recurring_expenses", ...cascade.filesUpdated]);
      return { success: true, data: { id }, cascade, logged: true };
    },
    async update(opts) {
      const updated = await store.updateRow("recurring_expenses", { expense_id: opts.id }, {
        [opts.field]: opts.value
      });
      if (!updated)
        return { success: false, error: `Expense not found: ${opts.id}` };
      const cascade = await runCascade(store, "expense_changed", { expenseId: opts.id });
      await autoLog(store, "expense_updated", "expense", `${opts.id}.${opts.field} = ${opts.value}`, ["recurring_expenses", ...cascade.filesUpdated]);
      return { success: true, cascade, logged: true };
    },
    async remove(opts) {
      const deleted = await store.deleteRows("recurring_expenses", { expense_id: opts.id });
      if (deleted === 0)
        return { success: false, error: `Expense not found: ${opts.id}` };
      const cascade = await runCascade(store, "expense_removed", { expenseId: opts.id });
      await autoLog(store, "expense_removed", "expense", `${opts.id} deleted`, ["recurring_expenses", ...cascade.filesUpdated]);
      return { success: true, cascade, logged: true };
    },
    /** Group expenses by category_id and return sums. */
    async summary() {
      const rows = await store.readTable("recurring_expenses");
      const categories = await store.readTable("expense_categories");
      const catMap = new Map(categories.map((c) => [c.category_id, c.category]));
      const groups = /* @__PURE__ */ new Map();
      for (const row of rows) {
        const catId = row.category_id;
        const entry = groups.get(catId) ?? { count: 0, total: 0 };
        entry.count++;
        entry.total = round2(entry.total + parseFloat(row.amount || "0"));
        groups.set(catId, entry);
      }
      return Array.from(groups.entries()).map(([catId, { count, total }]) => ({
        category_id: catId,
        category: catMap.get(catId) ?? "Unknown",
        count,
        monthly_total: total
      })).sort((a, b) => b.monthly_total - a.monthly_total);
    }
  };
  const allocations = {
    async listAnnual() {
      return store.readTable("budget_annual");
    },
    async listMonthly() {
      return store.readTable("budget_monthly");
    },
    async getAnnual(opts) {
      return store.getRow("budget_annual", { category_id: opts.categoryId });
    },
    async setAnnual(opts) {
      const updated = await store.updateRow("budget_annual", { category_id: opts.categoryId }, {
        monthly_budget: String(opts.amount),
        annual_budget: String(round2(opts.amount * 12)),
        ...opts.notes ? { notes: opts.notes } : {}
      });
      if (!updated)
        return { success: false, error: `Category not found: ${opts.categoryId}` };
      const cascade = await runCascade(store, "allocation_changed", { categoryId: opts.categoryId });
      await autoLog(store, "allocation_updated", "budget", `${opts.categoryId} \u2192 $${opts.amount}/mo ($${round2(opts.amount * 12)}/yr)`, ["budget_annual", ...cascade.filesUpdated]);
      return { success: true, cascade, logged: true };
    },
    async setMonthly(opts) {
      const updated = await store.updateRow("budget_monthly", { category_id: opts.categoryId }, {
        [opts.month]: String(opts.amount)
      });
      if (!updated)
        return { success: false, error: `Category not found in monthly: ${opts.categoryId}` };
      await store.transformTable("budget_monthly", (rows) => rows.map((row) => {
        if (row.category_id !== opts.categoryId)
          return row;
        const months = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"];
        const total = months.reduce((sum, m) => sum + parseFloat(row[m] || "0"), 0);
        return { ...row, annual_total: String(round2(total)) };
      }));
      const cascade = await runCascade(store, "allocation_changed", { categoryId: opts.categoryId });
      await autoLog(store, "monthly_allocation_updated", "budget", `${opts.categoryId}.${opts.month} \u2192 $${opts.amount}`, ["budget_monthly", ...cascade.filesUpdated]);
      return { success: true, cascade, logged: true };
    },
    /** Validate zero-based balance for all months. */
    async validate() {
      const monthly = await store.readTable("budget_monthly");
      const netIncome = await getNetMonthlyIncome2(store);
      const annual = await store.readTable("budget_annual");
      const incomeCategoryIds = annual.filter((r) => r.bucket === "income" || r.notes?.toLowerCase().includes("income")).map((r) => r.category_id);
      const expenseCatIds = new Set(annual.map((r) => r.category_id));
      const monthlyOnlyIds = monthly.filter((r) => !expenseCatIds.has(r.category_id)).map((r) => r.category_id);
      const incomeRowIds = [.../* @__PURE__ */ new Set([...incomeCategoryIds, ...monthlyOnlyIds])];
      const issues = validateZeroBased(monthly, netIncome, incomeRowIds);
      const annualIssues = validateAnnualMath(await store.readTable("budget_annual"));
      const allIssues = [...issues, ...annualIssues];
      return {
        ok: allIssues.filter((i) => i.severity === "error").length === 0,
        issues: allIssues,
        summary: {
          errors: allIssues.filter((i) => i.severity === "error").length,
          warnings: allIssues.filter((i) => i.severity === "warning").length,
          infos: allIssues.filter((i) => i.severity === "info").length
        }
      };
    }
  };
  async function getNetMonthlyIncome2(st) {
    const inc = await st.readTable("income_sources");
    return round2(inc.filter((r) => r.frequency === "semi-monthly" || r.frequency === "bi-weekly").reduce((sum, r) => sum + parseFloat(r.net_monthly || "0"), 0));
  }
  const goals = {
    async list() {
      return store.readTable("savings_goals");
    },
    async get(opts) {
      return store.getRow("savings_goals", { goal_id: opts.id });
    },
    async update(opts) {
      const updated = await store.updateRow("savings_goals", { goal_id: opts.id }, {
        [opts.field]: opts.value
      });
      if (!updated)
        return { success: false, error: `Goal not found: ${opts.id}` };
      const cascade = await runCascade(store, "goal_changed", { goalId: opts.id });
      await autoLog(store, "goal_updated", "goals", `${opts.id}.${opts.field} = ${opts.value}`, ["savings_goals", ...cascade.filesUpdated]);
      return { success: true, cascade, logged: true };
    },
    /** Add a new savings goal. ID is auto-generated if omitted. */
    async add(opts) {
      const id = opts.id ?? await nextId("savings_goals", "goal_id", "GOAL-");
      const existing = await store.getRow("savings_goals", { goal_id: id });
      if (existing)
        return { success: false, error: `Goal already exists: ${id}` };
      const rows = await store.readTable("savings_goals");
      rows.push({
        goal_id: id,
        description: opts.description,
        target_amount: String(opts.target_amount),
        current_amount: String(opts.current_amount ?? 0),
        monthly_contribution: String(opts.monthly_contribution ?? 0),
        start_date: opts.start_date ?? (/* @__PURE__ */ new Date()).toISOString().slice(0, 10),
        target_date: opts.target_date ?? "",
        priority: String(opts.priority ?? rows.length + 1),
        status: opts.status ?? "active"
      });
      await store.writeTable("savings_goals", rows);
      const cascade = await runCascade(store, "goal_changed", { goalId: id });
      await autoLog(store, "goal_added", "goals", `${id}: ${opts.description} target $${opts.target_amount}`, ["savings_goals", ...cascade.filesUpdated]);
      return { success: true, data: { id }, cascade, logged: true };
    }
  };
  const analysis = {
    async snapshot() {
      return store.readTable("snapshot");
    },
    async snapshotGet(opts) {
      const row = await store.getRow("snapshot", { metric: opts.metric });
      return row?.value;
    },
    async snapshotSet(opts) {
      const dateStr = (/* @__PURE__ */ new Date()).toISOString().slice(0, 10);
      const updated = await store.updateRow("snapshot", { metric: opts.metric }, {
        value: opts.value,
        as_of_date: dateStr,
        ...opts.notes ? { notes: opts.notes } : {}
      });
      if (!updated) {
        const rows = await store.readTable("snapshot");
        rows.push({
          metric: opts.metric,
          value: opts.value,
          as_of_date: dateStr,
          notes: opts.notes ?? ""
        });
        await store.writeTable("snapshot", rows);
      }
      await autoLog(store, "snapshot_updated", "analysis", `${opts.metric} = ${opts.value}`, ["snapshot"]);
      return { success: true, logged: true };
    },
    async health() {
      return store.readTable("financial_health");
    },
    async strategy() {
      return store.readTable("goal_allocation_strategy");
    },
    async carAffordability() {
      return store.readTable("car_affordability");
    },
    async houseAffordability() {
      return store.readTable("us_house_affordability");
    },
    /** Forward projection on savings balance. */
    async projectHouseFund(opts) {
      const extraMap = opts.extras ? new Map(Object.entries(opts.extras)) : void 0;
      const entries = projectSavings(opts.startBalance, opts.monthlyContribution, opts.startMonth, opts.months, opts.annualYield ?? 0, extraMap);
      return {
        entries,
        finalBalance: entries.length > 0 ? entries[entries.length - 1].balance : opts.startBalance
      };
    }
  };
  async function audit() {
    const issues = [];
    try {
      const budgetValidation = await allocations.validate();
      issues.push(...budgetValidation.issues);
    } catch (err) {
      issues.push({ severity: "error", file: "budget", message: `Budget validation failed: ${err}` });
    }
    try {
      const debtRows = await store.readTable("debts");
      const payoffRows = await store.readTable("payoff_plan");
      issues.push(...validateDebtPayoffSync(debtRows, payoffRows));
    } catch (err) {
      issues.push({ severity: "warning", file: "debts", message: `Debt sync check failed: ${err}` });
    }
    try {
      const expRows = await store.readTable("recurring_expenses");
      const annualRows = await store.readTable("budget_annual");
      issues.push(...validateExpenseBudgetSync(expRows, annualRows));
    } catch (err) {
      issues.push({ severity: "warning", file: "expenses", message: `Expense sync check failed: ${err}` });
    }
    try {
      const snapshot = await store.readTable("snapshot");
      const today2 = (/* @__PURE__ */ new Date()).toISOString().slice(0, 10);
      for (const row of snapshot) {
        const asOf = row.as_of_date;
        if (asOf && asOf < today2) {
          const daysDiff = Math.floor((Date.now() - new Date(asOf).getTime()) / 864e5);
          if (daysDiff > 30) {
            issues.push({
              severity: "warning",
              file: "snapshot",
              message: `Metric "${row.metric}" last updated ${asOf} (${daysDiff} days ago)`
            });
          }
        }
      }
    } catch {
    }
    const errors = issues.filter((i) => i.severity === "error").length;
    const warnings = issues.filter((i) => i.severity === "warning").length;
    const infos = issues.filter((i) => i.severity === "info").length;
    return {
      ok: errors === 0,
      issues,
      summary: { errors, warnings, infos }
    };
  }
  const actuals = {
    async list(opts) {
      const rows = await store.readTable("ledger");
      if (opts?.month) {
        const month = opts.month;
        return rows.filter((r) => r.date?.startsWith(month ?? ""));
      }
      return rows;
    },
    /** Record a transaction. txn_id is auto-generated if omitted. category_id is validated. */
    async add(entry) {
      if (!entry.txn_id) {
        entry.txn_id = await nextId("ledger", "txn_id", "TXN-");
      }
      if (entry.category_id && !await validateCategoryId(entry.category_id)) {
        return { success: false, error: `Unknown category_id: ${entry.category_id}. Check expense_categories.csv.` };
      }
      await store.appendRows("ledger", [entry]);
      await autoLog(store, "transaction_recorded", "actuals", `${entry.txn_id}: ${entry.description} $${entry.amount}`, ["ledger"]);
      return { success: true, data: entry, logged: true };
    },
    /** Record multiple transactions in one call. Auto-generates txn_ids as needed. */
    async addMany(entries) {
      const results = [];
      const existingRows = await store.readTable("ledger");
      let maxNum = 0;
      for (const row of existingRows) {
        const id = row.txn_id ?? "";
        if (id.startsWith("TXN-")) {
          const num = parseInt(id.slice(4), 10);
          if (!isNaN(num) && num > maxNum)
            maxNum = num;
        }
      }
      for (const entry of entries) {
        if (!entry.txn_id) {
          maxNum++;
          entry.txn_id = `TXN-${String(maxNum).padStart(3, "0")}`;
        }
        if (entry.category_id && !await validateCategoryId(entry.category_id)) {
          return { success: false, error: `Unknown category_id: ${entry.category_id} in ${entry.txn_id}` };
        }
        results.push(entry.txn_id);
      }
      await store.appendRows("ledger", entries);
      await autoLog(store, "transactions_recorded", "actuals", `${entries.length} transactions: ${results.join(", ")}`, ["ledger"]);
      return { success: true, data: { txn_ids: results, count: entries.length }, logged: true };
    },
    /** Update a field on an existing ledger entry. */
    async update(opts) {
      const updated = await store.updateRow("ledger", { txn_id: opts.txnId }, {
        [opts.field]: opts.value
      });
      if (!updated)
        return { success: false, error: `Transaction not found: ${opts.txnId}` };
      await autoLog(store, "transaction_updated", "actuals", `${opts.txnId}.${opts.field} = ${opts.value}`, ["ledger"]);
      return { success: true, logged: true };
    },
    /** Remove a ledger entry by txn_id. */
    async remove(opts) {
      const deleted = await store.deleteRows("ledger", { txn_id: opts.txnId });
      if (deleted === 0)
        return { success: false, error: `Transaction not found: ${opts.txnId}` };
      await autoLog(store, "transaction_removed", "actuals", `${opts.txnId} deleted`, ["ledger"]);
      return { success: true, logged: true };
    }
  };
  const log = {
    async list(opts) {
      const rows = await store.readTable("planner_log");
      const sorted = rows.reverse();
      return opts?.limit ? sorted.slice(0, opts.limit) : sorted;
    }
  };
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
        "debts.updateBalance({ id, balance, note? })": "\u2B50 Update balance + CASCADE to 6 files",
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
        "log.list({ limit? })": "Planner activity log"
      },
      cascade_graph: {
        "debts.updateBalance()": "debts \u2192 payoff_plan \u2192 snapshot \u2192 strategy \u2192 financial_health \u2192 log",
        "income.update()": "income_sources \u2192 snapshot \u2192 financial_health \u2192 log",
        "expenses.add/update/remove()": "recurring_expenses \u2192 financial_health \u2192 log",
        "allocations.setAnnual/setMonthly()": "budget_annual/monthly \u2192 snapshot \u2192 financial_health \u2192 log",
        "goals.update()": "savings_goals \u2192 snapshot \u2192 log",
        "config.setCopRate()": "settings \u2192 log"
      },
      examples: [
        {
          title: "Update Colombia loan balance",
          code: `return budget.debts.updateBalance({ id: "DEBT-002", balance: 78378, note: "Actual balance 282163272 COP" })`
        },
        {
          title: "List all debts",
          code: `return budget.debts.list()`
        },
        {
          title: "Run full audit",
          code: `return budget.audit()`
        },
        {
          title: "Project house fund to Dec 2027",
          code: `return budget.analysis.projectHouseFund({ startBalance: 0, monthlyContribution: 908, startMonth: "2026-02", months: 23, annualYield: 0.04 })`
        },
        {
          title: "Set COP/USD rate",
          code: `return budget.config.setCopRate(3700)`
        }
      ]
    };
  }
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
    log
  };
}

// dist/sandbox/index.js
import { runInNewContext } from "node:vm";
async function executeCode(budgetApi, request) {
  const startTime = Date.now();
  const timeout = request.timeout || 1e4;
  try {
    const consoleOutput = [];
    const context = {
      budget: budgetApi,
      console: {
        log: (...args) => {
          consoleOutput.push(args.map(String).join(" "));
        },
        warn: (...args) => {
          consoleOutput.push(`[warn] ${args.map(String).join(" ")}`);
        },
        error: (...args) => {
          consoleOutput.push(`[error] ${args.map(String).join(" ")}`);
        }
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
      undefined: void 0,
      NaN: NaN,
      Infinity: Infinity
    };
    const wrappedCode = `
      (async () => {
        ${request.code}
      })()
    `;
    const result = await runInNewContext(wrappedCode, context, {
      timeout,
      displayErrors: false
    });
    return {
      success: true,
      result,
      execution_time_ms: Date.now() - startTime,
      console_output: consoleOutput.length > 0 ? consoleOutput : void 0
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
      execution_time_ms: Date.now() - startTime
    };
  }
}

// dist/storage/fs-store.js
import * as fs2 from "node:fs/promises";
import * as path2 from "node:path";

// dist/csv/csv-parser.js
import * as fs from "node:fs/promises";
import * as path from "node:path";
function parseFields(line) {
  const fields = [];
  let i = 0;
  while (i <= line.length) {
    if (i === line.length) {
      fields.push("");
      break;
    }
    if (line[i] === '"') {
      let value = "";
      i++;
      while (i < line.length) {
        if (line[i] === '"') {
          if (i + 1 < line.length && line[i + 1] === '"') {
            value += '"';
            i += 2;
          } else {
            i++;
            break;
          }
        } else {
          value += line[i];
          i++;
        }
      }
      fields.push(value);
      if (i < line.length && line[i] === ",")
        i++;
    } else {
      const nextComma = line.indexOf(",", i);
      if (nextComma === -1) {
        fields.push(line.substring(i));
        break;
      } else {
        fields.push(line.substring(i, nextComma));
        i = nextComma + 1;
      }
    }
  }
  return fields;
}
function parseCSV(text) {
  const lines = text.split(/\r?\n/).filter((l) => l.trim().length > 0);
  if (lines.length === 0)
    return [];
  const headers = parseFields(lines[0]);
  const rows = [];
  for (let i = 1; i < lines.length; i++) {
    const fields = parseFields(lines[i]);
    const row = {};
    for (let j = 0; j < headers.length; j++) {
      row[headers[j]] = fields[j] ?? "";
    }
    rows.push(row);
  }
  return rows;
}
function parseCSVHeaders(text) {
  const firstLine = text.split(/\r?\n/)[0] ?? "";
  return parseFields(firstLine);
}
function quoteField(value) {
  if (value.includes(",") || value.includes('"') || value.includes("\n")) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}
function serializeCSV(rows, columns) {
  if (rows.length === 0)
    return "";
  const cols = columns ?? Object.keys(rows[0]);
  const lines = [];
  lines.push(cols.map(quoteField).join(","));
  for (const row of rows) {
    const fields = cols.map((col) => quoteField(row[col] ?? ""));
    lines.push(fields.join(","));
  }
  return lines.join("\n") + "\n";
}
async function readCSVFile(filePath) {
  const text = await fs.readFile(filePath, "utf8");
  return parseCSV(text);
}
async function writeCSVFile(filePath, rows, columns) {
  const text = serializeCSV(rows, columns);
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  const tmp = filePath + ".tmp";
  await fs.writeFile(tmp, text, "utf8");
  await fs.rename(tmp, filePath);
}

// dist/csv/schemas.js
var FAMILY_PROFILE = {
  name: "family_profile",
  columns: ["member_id", "name", "role", "birth_year", "notes"],
  primaryKey: ["member_id"],
  numericColumns: []
};
var SETTINGS = {
  name: "settings",
  columns: ["key", "value", "updated"],
  primaryKey: ["key"],
  numericColumns: []
};
var EXPENSE_CATEGORIES = {
  name: "expense_categories",
  columns: ["category_id", "category", "subcategory", "bucket", "is_four_wall", "default_priority", "notes"],
  primaryKey: ["category_id"],
  numericColumns: ["default_priority"]
};
var INCOME_SOURCES = {
  name: "income_sources",
  columns: ["source_id", "member_id", "description", "type", "gross_monthly", "net_monthly", "frequency", "start_date", "end_date", "notes"],
  primaryKey: ["source_id"],
  numericColumns: ["gross_monthly", "net_monthly"]
};
var PAYSTUB_BREAKDOWN = {
  name: "paystub_breakdown",
  columns: ["line_item", "per_period", "jan_total", "type", "notes"],
  primaryKey: ["line_item"],
  numericColumns: ["per_period", "jan_total"]
};
var BUDGET_ANNUAL = {
  name: "budget_annual",
  columns: ["category_id", "category", "subcategory", "bucket", "monthly_budget", "annual_budget", "priority", "notes"],
  primaryKey: ["category_id"],
  numericColumns: ["monthly_budget", "annual_budget", "priority"]
};
var BUDGET_MONTHLY = {
  name: "budget_monthly",
  columns: ["category_id", "category", "jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec", "annual_total"],
  primaryKey: ["category_id"],
  numericColumns: ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec", "annual_total"]
};
var DEBTS = {
  name: "debts",
  columns: ["debt_id", "description", "type", "original_amount", "current_balance", "interest_rate_annual", "minimum_payment", "due_day", "start_date", "term_months", "lender", "priority_snowball", "priority_avalanche", "notes"],
  primaryKey: ["debt_id"],
  numericColumns: ["current_balance", "interest_rate_annual", "minimum_payment", "priority_snowball", "priority_avalanche"]
};
var PAYOFF_PLAN = {
  name: "payoff_plan",
  columns: ["month", "debt_id", "description", "payment", "extra_payment", "remaining_balance", "interest_paid", "cumulative_interest", "notes"],
  primaryKey: ["month", "debt_id"],
  numericColumns: ["payment", "extra_payment", "remaining_balance", "interest_paid", "cumulative_interest"]
};
var RECURRING_EXPENSES = {
  name: "recurring_expenses",
  columns: ["expense_id", "description", "category_id", "amount", "frequency", "due_day", "auto_pay", "vendor", "notes"],
  primaryKey: ["expense_id"],
  numericColumns: ["amount"]
};
var SAVINGS_GOALS = {
  name: "savings_goals",
  columns: ["goal_id", "description", "target_amount", "current_amount", "monthly_contribution", "start_date", "target_date", "priority", "status"],
  primaryKey: ["goal_id"],
  numericColumns: ["target_amount", "current_amount", "monthly_contribution", "priority"]
};
var FINANCIAL_HEALTH = {
  name: "financial_health",
  columns: ["date", "dti_ratio", "dti_status", "savings_rate", "savings_status", "emergency_ratio", "emergency_status", "housing_ratio", "housing_status", "net_worth_estimate", "data_source", "notes"],
  primaryKey: ["date"],
  numericColumns: ["dti_ratio", "savings_rate", "emergency_ratio", "housing_ratio", "net_worth_estimate"]
};
var SNAPSHOT = {
  name: "snapshot",
  columns: ["metric", "value", "as_of_date", "notes"],
  primaryKey: ["metric"],
  numericColumns: []
  // value field is polymorphic — parsed contextually
};
var GOAL_STRATEGY = {
  name: "goal_allocation_strategy",
  columns: ["section", "parameter", "scenario_a_colombia_first", "scenario_b_house_first", "scenario_c_balanced", "notes"],
  primaryKey: ["section", "parameter"],
  numericColumns: []
};
var CAR_AFFORDABILITY = {
  name: "car_affordability",
  columns: ["parameter", "scenario_1_conservative", "scenario_2_recommended", "scenario_3_stretch", "explorer_requested", "rule", "notes"],
  primaryKey: ["parameter"],
  numericColumns: []
};
var HOUSE_AFFORDABILITY = {
  name: "us_house_affordability",
  columns: ["parameter", "value", "rule", "status", "notes"],
  primaryKey: ["parameter"],
  numericColumns: []
};
var LEDGER = {
  name: "ledger",
  columns: ["txn_id", "date", "type", "category_id", "category", "source_or_dest", "description", "amount", "payment_method", "debt_id", "goal_id", "notes"],
  primaryKey: ["txn_id"],
  numericColumns: ["amount"]
};
var PLANNER_LOG = {
  name: "planner_log",
  columns: ["timestamp", "action", "task_type", "details", "files_modified"],
  primaryKey: [],
  // append-only, no primary key
  numericColumns: []
};
var ALL_SCHEMAS = {
  family_profile: FAMILY_PROFILE,
  settings: SETTINGS,
  expense_categories: EXPENSE_CATEGORIES,
  income_sources: INCOME_SOURCES,
  paystub_breakdown: PAYSTUB_BREAKDOWN,
  budget_annual: BUDGET_ANNUAL,
  budget_monthly: BUDGET_MONTHLY,
  debts: DEBTS,
  payoff_plan: PAYOFF_PLAN,
  recurring_expenses: RECURRING_EXPENSES,
  savings_goals: SAVINGS_GOALS,
  financial_health: FINANCIAL_HEALTH,
  snapshot: SNAPSHOT,
  goal_allocation_strategy: GOAL_STRATEGY,
  car_affordability: CAR_AFFORDABILITY,
  us_house_affordability: HOUSE_AFFORDABILITY,
  ledger: LEDGER,
  planner_log: PLANNER_LOG
};

// dist/storage/fs-store.js
var PATH_MAP = {
  // Config (global)
  family_profile: "config/family_profile.csv",
  settings: "config/settings.csv",
  expense_categories: "config/expense_categories.csv",
  // Year-scoped
  income_sources: "{year}/income/income_sources.csv",
  paystub_breakdown: "{year}/income/paystub_breakdown_01.csv",
  budget_annual: "{year}/budget/budget_annual.csv",
  budget_monthly: "{year}/budget/budget_monthly.csv",
  debts: "{year}/debt/debts.csv",
  payoff_plan: "{year}/debt/payoff_plan.csv",
  recurring_expenses: "{year}/expenses/recurring_expenses.csv",
  savings_goals: "{year}/goals/savings_goals.csv",
  financial_health: "{year}/analysis/financial_health.csv",
  snapshot: "{year}/snapshot_{year}.csv",
  goal_allocation_strategy: "{year}/analysis/goal_allocation_strategy.csv",
  car_affordability: "{year}/analysis/car_affordability.csv",
  us_house_affordability: "{year}/analysis/us_house_affordability.csv",
  ledger: "{year}/actuals/ledger_01.csv",
  planner_log: "{year}/logs/planner_log.csv"
};
var FileSystemBudgetStore = class {
  rootAbs;
  year;
  constructor(opts) {
    this.rootAbs = path2.resolve(opts.root);
    this.year = opts.year;
  }
  getRoot() {
    return this.rootAbs;
  }
  getYear() {
    return this.year;
  }
  // ── Path resolution ───────────────────────────────────────────────────
  resolvePath(name) {
    const template = PATH_MAP[name];
    if (!template)
      throw new Error(`Unknown table: ${name}. Available: ${Object.keys(PATH_MAP).join(", ")}`);
    const relPath = template.replace(/\{year\}/g, this.year);
    const abs = path2.resolve(this.rootAbs, relPath);
    const rootWithSep = this.rootAbs.endsWith(path2.sep) ? this.rootAbs : this.rootAbs + path2.sep;
    if (abs !== this.rootAbs && !abs.startsWith(rootWithSep)) {
      throw new Error("Path traversal detected");
    }
    return abs;
  }
  getPath(name) {
    return this.resolvePath(name);
  }
  getSchema(name) {
    const schema = ALL_SCHEMAS[name];
    if (!schema)
      throw new Error(`No schema for table: ${name}`);
    return schema;
  }
  async exists(name) {
    try {
      await fs2.access(this.resolvePath(name));
      return true;
    } catch {
      return false;
    }
  }
  // ── Generic CSV operations ────────────────────────────────────────────
  async readTable(name) {
    const filePath = this.resolvePath(name);
    return readCSVFile(filePath);
  }
  async writeTable(name, rows) {
    const filePath = this.resolvePath(name);
    const schema = this.getSchema(name);
    await writeCSVFile(filePath, rows, schema.columns);
  }
  async appendRows(name, rows) {
    const filePath = this.resolvePath(name);
    const schema = this.getSchema(name);
    let existing;
    try {
      existing = await fs2.readFile(filePath, "utf8");
    } catch {
      await writeCSVFile(filePath, rows, schema.columns);
      return;
    }
    const appendText = rows.map((row) => schema.columns.map((col) => {
      const val = row[col] ?? "";
      return val.includes(",") || val.includes('"') || val.includes("\n") ? `"${val.replace(/"/g, '""')}"` : val;
    }).join(",")).join("\n");
    const needsNewline = existing.length > 0 && !existing.endsWith("\n");
    await fs2.appendFile(filePath, (needsNewline ? "\n" : "") + appendText + "\n", "utf8");
  }
  async transformTable(name, transform) {
    const rows = await this.readTable(name);
    const transformed = transform(rows);
    const schema = this.getSchema(name);
    let columns;
    try {
      const text = await fs2.readFile(this.resolvePath(name), "utf8");
      columns = parseCSVHeaders(text);
    } catch {
      columns = schema.columns;
    }
    await writeCSVFile(this.resolvePath(name), transformed, columns);
    return transformed;
  }
  // ── Row-level helpers ─────────────────────────────────────────────────
  async getRow(name, key) {
    const rows = await this.readTable(name);
    return rows.find((row) => Object.entries(key).every(([k, v]) => row[k] === v));
  }
  async updateRow(name, key, updates) {
    let found = false;
    await this.transformTable(name, (rows) => rows.map((row) => {
      const matches = Object.entries(key).every(([k, v]) => row[k] === v);
      if (matches) {
        found = true;
        return { ...row, ...updates };
      }
      return row;
    }));
    return found;
  }
  async deleteRows(name, key) {
    const before = await this.readTable(name);
    const after = before.filter((row) => !Object.entries(key).every(([k, v]) => row[k] === v));
    const deleted = before.length - after.length;
    if (deleted > 0) {
      await this.writeTable(name, after);
    }
    return deleted;
  }
};

// dist/skill-cli.js
import * as path3 from "node:path";
import * as os from "node:os";
function parseArgs(argv) {
  const flags = /* @__PURE__ */ new Map();
  const positional = [];
  let command = "";
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg.startsWith("--")) {
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
function getFlag(flags, key) {
  return flags.get(key);
}
function requireFlag(flags, key) {
  const value = flags.get(key);
  if (!value) {
    throw new Error(`Missing required flag: --${key}`);
  }
  return value;
}
function success(data) {
  console.log(JSON.stringify({ success: true, data }, null, 2));
  process.exit(0);
}
function error(message) {
  console.error(JSON.stringify({ success: false, error: message }, null, 2));
  process.exit(1);
}
var HELP_TEXT = `
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
function createStore(flags) {
  const root = getFlag(flags, "root") || process.env.BUDGET_ROOT || path3.join(os.homedir(), "budget", "finance");
  const year = getFlag(flags, "year") || process.env.BUDGET_YEAR || String((/* @__PURE__ */ new Date()).getFullYear());
  return new FileSystemBudgetStore({ root, year });
}
async function handleExec(flags) {
  const code = requireFlag(flags, "code");
  const timeoutStr = getFlag(flags, "timeout");
  const timeout = timeoutStr ? parseInt(timeoutStr, 10) : 5e3;
  const store = createStore(flags);
  const budget = createBudgetAPI(store);
  const result = await executeCode(budget, { code, timeout });
  success(result);
}
async function handleListDebts(flags) {
  const store = createStore(flags);
  const budget = createBudgetAPI(store);
  const debts = await budget.debts.list();
  success(debts);
}
async function handleUpdateBalance(flags) {
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
async function handleAddDebt(flags) {
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
    notes
  });
  success(result);
}
async function handlePayoffPlan(flags) {
  const id = requireFlag(flags, "id");
  const store = createStore(flags);
  const budget = createBudgetAPI(store);
  const plan = await budget.debts.getPayoffPlan({ id });
  success(plan);
}
async function handleListIncome(flags) {
  const store = createStore(flags);
  const budget = createBudgetAPI(store);
  const income = await budget.income.list();
  success(income);
}
async function handleListExpenses(flags) {
  const store = createStore(flags);
  const budget = createBudgetAPI(store);
  const expenses = await budget.expenses.list();
  success(expenses);
}
async function handleExpenseSummary(flags) {
  const store = createStore(flags);
  const budget = createBudgetAPI(store);
  const summary = await budget.expenses.summary();
  success(summary);
}
async function handleAddExpense(flags) {
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
    notes
  });
  success(result);
}
async function handleListGoals(flags) {
  const store = createStore(flags);
  const budget = createBudgetAPI(store);
  const goals = await budget.goals.list();
  success(goals);
}
async function handleAddGoal(flags) {
  const description = requireFlag(flags, "description");
  const targetStr = requireFlag(flags, "target");
  const contributionStr = requireFlag(flags, "contribution");
  const target = parseFloat(targetStr);
  const contribution = parseFloat(contributionStr);
  if (isNaN(target) || isNaN(contribution)) {
    error("Invalid numeric values for target or contribution");
  }
  const priorityStr = getFlag(flags, "priority");
  const priority = priorityStr ? parseInt(priorityStr, 10) : void 0;
  const store = createStore(flags);
  const budget = createBudgetAPI(store);
  const result = await budget.goals.add({
    description,
    target_amount: target,
    monthly_contribution: contribution,
    priority
  });
  success(result);
}
async function handleAddTransaction(flags) {
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
    notes: notes || ""
  });
  success(result);
}
async function handleHealth(flags) {
  const store = createStore(flags);
  const budget = createBudgetAPI(store);
  const health = await budget.analysis.health();
  success(health);
}
async function handleSnapshot(flags) {
  const store = createStore(flags);
  const budget = createBudgetAPI(store);
  const snapshot = await budget.analysis.snapshot();
  success(snapshot);
}
async function handleStrategy(flags) {
  const store = createStore(flags);
  const budget = createBudgetAPI(store);
  const strategy = await budget.analysis.strategy();
  success(strategy);
}
async function handleValidate(flags) {
  const store = createStore(flags);
  const budget = createBudgetAPI(store);
  const validation = await budget.allocations.validate();
  success(validation);
}
async function handleAudit(flags) {
  const store = createStore(flags);
  const budget = createBudgetAPI(store);
  const auditResult = await budget.audit();
  success(auditResult);
}
async function handleLog(flags) {
  const limitStr = getFlag(flags, "limit");
  const limit = limitStr ? parseInt(limitStr, 10) : 20;
  const store = createStore(flags);
  const budget = createBudgetAPI(store);
  const logEntries = await budget.log.list({ limit });
  success(logEntries);
}
async function main() {
  const argv = process.argv.slice(2);
  if (argv.length === 0 || argv.includes("--help") || argv.includes("-h")) {
    console.log(HELP_TEXT);
    process.exit(0);
  }
  const parsed = parseArgs(argv);
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
        error(`Unknown command: ${parsed.command}

Run 'help' to see available commands.`);
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    error(message);
  }
}
if (process.argv[1] && import.meta.url === `file://${process.argv[1]}`) {
  main().catch((err) => {
    console.error("Fatal error:", err);
    process.exit(1);
  });
}
export {
  main,
  parseArgs
};
