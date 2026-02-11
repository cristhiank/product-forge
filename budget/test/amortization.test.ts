import { describe, expect, test } from "vitest";
import {
    calculateBaselineInterest,
    calculatePayoffSchedule,
    monthlyInterest,
    projectSavings,
    round2,
    type PaymentPlan,
} from "../src/engine/amortization.js";

describe("Amortization Engine", () => {
  test("round2 rounds to 2 decimal places", () => {
    expect(round2(1.006)).toBe(1.01);    // above .005 rounds up
    expect(round2(1.234)).toBe(1.23);
    expect(round2(1.999)).toBe(2);
    expect(round2(100)).toBe(100);
  });

  test("monthlyInterest calculates correctly", () => {
    // $80,000 at 11.12% annual
    const interest = monthlyInterest(80000, 0.1112);
    expect(interest).toBe(741.33);

    // $4,500 at 11.75%
    const ccInterest = monthlyInterest(4500, 0.1175);
    expect(ccInterest).toBe(44.06);
  });

  test("calculateBaselineInterest for Colombia loan", () => {
    // $80K at 11.12%, $1,027/mo — should take about 136+ months
    const baseline = calculateBaselineInterest(80000, 0.1112, 1027);
    expect(baseline.totalInterest).toBeGreaterThan(50000);
    expect(baseline.months).toBeGreaterThan(100);
  });

  test("calculateBaselineInterest detects impossible payoff", () => {
    // Payment less than monthly interest = never pays off
    const baseline = calculateBaselineInterest(80000, 0.1112, 500);
    expect(baseline.totalInterest).toBe(Infinity);
  });

  test("calculatePayoffSchedule with aggressive payments", () => {
    const plan: PaymentPlan = {
      regularPayment: 1000,
      monthlyPayments: new Map(),
    };

    const schedule = calculatePayoffSchedule(4500, 0.1175, "2026-02", plan);

    // Should be paid off in about 5 months
    expect(schedule.length).toBeLessThanOrEqual(6);

    // Last entry should have 0 remaining
    const last = schedule[schedule.length - 1];
    expect(last.remainingBalance).toBe(0);

    // Total interest should be small
    expect(last.cumulativeInterest).toBeLessThan(200);
  });

  test("calculatePayoffSchedule with per-month overrides", () => {
    // Simulate RSU months getting extra payments
    const plan: PaymentPlan = {
      regularPayment: 1027,
      monthlyPayments: new Map([
        ["2026-02", 5038],   // regular + RSU
        ["2026-03", 14666],  // regular + big RSU
      ]),
    };

    const schedule = calculatePayoffSchedule(78378, 0.1112, "2026-02", plan);

    // After Feb, balance should be significantly lower
    expect(schedule[0].remainingBalance).toBeLessThan(75000);

    // After Mar, even lower from the big payment
    expect(schedule[1].remainingBalance).toBeLessThan(65000);
  });

  test("projectSavings basic projection", () => {
    const entries = projectSavings(0, 908, "2026-02", 12);
    expect(entries).toHaveLength(12);

    // After 12 months of $908/mo, should be ~$10,896
    const last = entries[entries.length - 1];
    expect(last.balance).toBe(10896);
  });

  test("projectSavings with yield", () => {
    const entries = projectSavings(10000, 500, "2026-01", 12, 0.04);
    const last = entries[entries.length - 1];

    // Should be > 16000 (10000 + 6000 contributions + some yield)
    expect(last.balance).toBeGreaterThan(16000);
  });

  test("projectSavings with extra contributions", () => {
    const extras = new Map([
      ["2026-04", 2684],  // ESPP quarter
      ["2026-07", 2684],
    ]);

    const entries = projectSavings(0, 908, "2026-01", 12, 0, extras);

    // Should include the ESPP bumps
    const apr = entries.find((e) => e.month === "2026-04");
    expect(apr!.contribution).toBe(908 + 2684);
  });
});
