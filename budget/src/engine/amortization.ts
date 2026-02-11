// ─── Amortization & Loan Math ─────────────────────────────────────────────
// Deterministic financial calculations. No floating point surprises — we
// round to 2 decimals at each step (same as banks).

export function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

// ── Interest ──────────────────────────────────────────────────────────────

/** Monthly interest on a balance at an annual rate (e.g. 11.12% → 0.1112). */
export function monthlyInterest(balance: number, annualRate: number): number {
  return round2(balance * annualRate / 12);
}

// ── Payoff Schedule ───────────────────────────────────────────────────────

export interface PaymentScheduleEntry {
  month: string;          // YYYY-MM
  payment: number;        // Total payment this month
  extraPayment: number;   // Portion above regular payment
  interest: number;       // Interest accrued this month
  principal: number;      // Principal paid this month
  remainingBalance: number;
  cumulativeInterest: number;
}

export interface PaymentPlan {
  /** The payment for each specific month. If a month is missing, regularPayment is used. */
  monthlyPayments: Map<string, number>;
  /** Default monthly payment when no override exists */
  regularPayment: number;
}

/**
 * Generate a complete payoff schedule.
 *
 * @param startBalance  Current loan balance
 * @param annualRate    Annual interest rate as decimal (11.12% → 0.1112)
 * @param startMonth    First month of payments (YYYY-MM)
 * @param plan          Payment plan with regular + per-month overrides
 * @param maxMonths     Safety cap (default 360 = 30 years)
 * @returns Array of monthly entries. Last entry has remainingBalance ≈ 0.
 */
export function calculatePayoffSchedule(
  startBalance: number,
  annualRate: number,
  startMonth: string,
  plan: PaymentPlan,
  maxMonths = 360,
): PaymentScheduleEntry[] {
  const entries: PaymentScheduleEntry[] = [];
  let balance = round2(startBalance);
  let cumInterest = 0;
  let [year, month] = startMonth.split("-").map(Number);

  for (let i = 0; i < maxMonths && balance > 0; i++) {
    const monthStr = `${year}-${String(month).padStart(2, "0")}`;
    const interest = monthlyInterest(balance, annualRate);
    const scheduledPayment = plan.monthlyPayments.get(monthStr) ?? plan.regularPayment;

    // Clamp payment to balance + interest (don't overpay beyond what's owed)
    const actualPayment = round2(Math.min(scheduledPayment, balance + interest));
    const principal = round2(actualPayment - interest);
    balance = round2(balance - principal);
    cumInterest = round2(cumInterest + interest);

    // Extra is whatever exceeds the regular payment
    const extra = round2(Math.max(0, actualPayment - plan.regularPayment));

    entries.push({
      month: monthStr,
      payment: actualPayment,
      extraPayment: extra,
      interest,
      principal,
      remainingBalance: Math.max(0, balance),
      cumulativeInterest: cumInterest,
    });

    if (balance <= 0) break;

    // Advance month
    month++;
    if (month > 12) {
      month = 1;
      year++;
    }
  }

  return entries;
}

/**
 * Calculate total interest paid over the full life of a loan
 * at minimum payments only (baseline for savings comparison).
 */
export function calculateBaselineInterest(
  balance: number,
  annualRate: number,
  monthlyPayment: number,
  maxMonths = 360,
): { totalInterest: number; months: number } {
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
      // Payment doesn't cover interest — loan will never pay off
      return { totalInterest: Infinity, months: Infinity };
    }
  }

  return { totalInterest, months };
}

// ── Forward Projections ───────────────────────────────────────────────────

export interface ProjectionEntry {
  month: string;
  balance: number;
  contribution: number;
  interest: number;       // yield on savings (HYSA, etc.)
}

/**
 * Project a savings balance forward with monthly contributions and optional yield.
 */
export function projectSavings(
  startBalance: number,
  monthlyContribution: number,
  startMonth: string,
  months: number,
  annualYield = 0,
  /** Per-month overrides (e.g. ESPP quarters, RSU vests, payoff surplus) */
  extraContributions?: Map<string, number>,
): ProjectionEntry[] {
  const entries: ProjectionEntry[] = [];
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
      interest: yieldAmount,
    });

    month++;
    if (month > 12) {
      month = 1;
      year++;
    }
  }

  return entries;
}
