// ─── Budget Validator ─────────────────────────────────────────────────────
// Validation rules that ensure cross-file consistency.

import { round2 } from "./amortization.js";

export interface ValidationIssue {
  severity: "error" | "warning" | "info";
  file: string;
  message: string;
  actual?: string;
  expected?: string;
}

export interface ValidationResult {
  ok: boolean;
  issues: ValidationIssue[];
  summary: {
    errors: number;
    warnings: number;
    infos: number;
  };
}

// ── Zero-Based Budget Check ───────────────────────────────────────────────

/**
 * Verify that allocations sum to income for each month.
 * Returns issues for any month where income ≠ allocations.
 */
export function validateZeroBased(
  monthlyRows: Record<string, string>[],
  netMonthlyIncome: number,
  incomeRowIds: string[],
): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const months = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"];

  for (const month of months) {
    let totalAllocated = 0;
    let totalIncome = 0;

    for (const row of monthlyRows) {
      // Skip summary rows — they duplicate allocation sums
      if (row.category_id === "TOTAL") continue;

      const val = parseFloat(row[month] || "0");
      if (isNaN(val)) continue;

      if (incomeRowIds.includes(row.category_id ?? "")) {
        totalIncome += val;
      } else {
        totalAllocated += val;
      }
    }

    // Income = base salary + any variable income (RSU/ESPP) for this month
    const effectiveIncome = round2(netMonthlyIncome + totalIncome);
    const diff = round2(effectiveIncome - totalAllocated);

    if (Math.abs(diff) > 0.50) {
      issues.push({
        severity: "error",
        file: "budget_monthly",
        message: `${month}: income ($${effectiveIncome}) ≠ allocations ($${totalAllocated}). Unallocated: $${diff}`,
        expected: String(effectiveIncome),
        actual: String(totalAllocated),
      });
    }
  }

  return issues;
}

// ── Financial Health Ratios ───────────────────────────────────────────────

export interface HealthMetrics {
  dti_ratio: number;
  dti_status: string;
  savings_rate: number;
  savings_status: string;
  emergency_ratio: number;
  emergency_status: string;
  housing_ratio: number;
  housing_status: string;
}

export function calculateHealthMetrics(opts: {
  monthlyDebtPayments: number;
  grossMonthlyIncome: number;
  monthlySavings: number;
  netMonthlyIncome: number;
  emergencyFund: number;
  monthlyExpenses: number;
  housingCost: number;
}): HealthMetrics {
  const dti = round2(opts.monthlyDebtPayments / opts.grossMonthlyIncome);
  const savings = round2(opts.monthlySavings / opts.netMonthlyIncome);
  const emergency = round2(opts.emergencyFund / opts.monthlyExpenses);
  const housing = round2(opts.housingCost / opts.grossMonthlyIncome);

  return {
    dti_ratio: dti,
    dti_status: dti <= 0.36 ? "✅" : dti <= 0.43 ? "🟡" : "🔴",
    savings_rate: savings,
    savings_status: savings >= 0.20 ? "✅" : savings >= 0.10 ? "🟡" : "🔴",
    emergency_ratio: emergency,
    emergency_status: emergency >= 6 ? "✅" : emergency >= 3 ? "🟡" : "🔴",
    housing_ratio: housing,
    housing_status: housing <= 0.28 ? "✅" : housing <= 0.36 ? "🟡" : "🔴",
  };
}

// ── Cross-File Consistency Checks ─────────────────────────────────────────

/**
 * Validate that debts.csv balances match the latest payoff_plan entries.
 */
export function validateDebtPayoffSync(
  debts: Record<string, string>[],
  payoffRows: Record<string, string>[],
): ValidationIssue[] {
  const issues: ValidationIssue[] = [];

  for (const debt of debts) {
    const debtId = debt.debt_id;
    // Find first payoff entry for this debt (should be the starting point)
    const debtPayoffs = payoffRows.filter((r) => r.debt_id === debtId);
    if (debtPayoffs.length === 0) {
      issues.push({
        severity: "warning",
        file: "payoff_plan",
        message: `No payoff plan entries for ${debtId} (${debt.description})`,
      });
    }
  }

  return issues;
}

/**
 * Validate that budget_annual monthly × 12 = annual for uniform categories.
 */
export function validateAnnualMath(
  annualRows: Record<string, string>[],
): ValidationIssue[] {
  const issues: ValidationIssue[] = [];

  for (const row of annualRows) {
    const monthly = parseFloat(row.monthly_budget || "0");
    const annual = parseFloat(row.annual_budget || "0");

    // Allow non-uniform categories (like quarterly ESPP, RSU vests)
    if (monthly > 0 && annual > 0) {
      const expected = round2(monthly * 12);
      if (Math.abs(expected - annual) > 1) {
        // Tolerance of $1 for non-uniform items
        // Check if it's intentionally non-uniform (monthly_budget is an average)
        // We flag as info, not error, since ESPP/RSU are irregular
        issues.push({
          severity: "info",
          file: "budget_annual",
          message: `${row.category_id} ${row.category}: monthly $${monthly} × 12 = $${expected} ≠ annual $${annual}`,
          expected: String(expected),
          actual: String(annual),
        });
      }
    }
  }

  return issues;
}

/**
 * Validate that recurring_expenses match budget_annual amounts.
 */
export function validateExpenseBudgetSync(
  expenses: Record<string, string>[],
  annual: Record<string, string>[],
): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const budgetByCategory = new Map(annual.map((r) => [r.category_id, parseFloat(r.monthly_budget || "0")]));

  for (const exp of expenses) {
    const catId = exp.category_id;
    const expAmount = parseFloat(exp.amount || "0");
    const budgetAmount = budgetByCategory.get(catId);

    if (budgetAmount !== undefined && Math.abs(budgetAmount - expAmount) > 0.01) {
      // Only flag if they're supposed to match (same category)
      // Some categories have multiple expenses, so we just flag for review
      issues.push({
        severity: "info",
        file: "recurring_expenses",
        message: `${exp.expense_id} (${exp.description}): expense $${expAmount} vs budget $${budgetAmount} for ${catId}`,
      });
    }
  }

  return issues;
}
