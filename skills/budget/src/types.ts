// ─── Budget MCP Server — Core Types ───────────────────────────────────────

// ── Entity ID brands ──────────────────────────────────────────────────────
// We keep IDs as plain strings but document expected patterns.
//   DEBT-001, INC-001, EXP-001, CAT-001, GOAL-001, M-001, TXN-001

// ── Config ────────────────────────────────────────────────────────────────

export interface FamilyMember {
  member_id: string;
  name: string;
  role: string;
  birth_year: string;
  notes: string;
}

export interface Setting {
  key: string;
  value: string;
  updated: string;
}

export type Bucket = "needs" | "wants" | "debt" | "savings";

export interface ExpenseCategory {
  category_id: string;
  category: string;
  subcategory: string;
  bucket: Bucket;
  is_four_wall: string;         // "yes" | "no"
  default_priority: string;
  notes: string;
}

// ── Income ────────────────────────────────────────────────────────────────

export type IncomeType = "salary" | "espp" | "rsu" | "rental" | "bonus" | "other";
export type Frequency = "semi-monthly" | "monthly" | "quarterly" | "annual" | "irregular";

export interface IncomeSource {
  source_id: string;
  member_id: string;
  description: string;
  type: IncomeType;
  gross_monthly: number;
  net_monthly: number;
  frequency: Frequency;
  start_date: string;
  end_date: string;
  notes: string;
}

export interface PaystubLine {
  line_item: string;
  per_period: number;
  jan_total: number;
  type: string;           // gross | deduction | tax
  notes: string;
}

// ── Budget Allocations ────────────────────────────────────────────────────

export interface BudgetAnnualRow {
  category_id: string;
  category: string;
  subcategory: string;
  bucket: Bucket;
  monthly_budget: number;
  annual_budget: number;
  priority: number;
  notes: string;
}

export interface BudgetMonthlyRow {
  category_id: string;
  category: string;
  jan: number; feb: number; mar: number; apr: number;
  may: number; jun: number; jul: number; aug: number;
  sep: number; oct: number; nov: number; dec: number;
  annual_total: number;
}

export const MONTHS = ["jan", "feb", "mar", "apr", "may", "jun",
  "jul", "aug", "sep", "oct", "nov", "dec"] as const;
export type Month = typeof MONTHS[number];

// ── Debts ─────────────────────────────────────────────────────────────────

export type DebtType = "credit_card" | "mortgage" | "auto_loan" | "student_loan" | "personal" | "other";

export interface Debt {
  debt_id: string;
  description: string;
  type: DebtType;
  original_amount: string;       // may be empty
  current_balance: number;
  interest_rate_annual: number;
  minimum_payment: number;
  due_day: string;
  start_date: string;
  term_months: string;
  lender: string;
  priority_snowball: number;
  priority_avalanche: number;
  notes: string;
}

export interface PayoffEntry {
  month: string;                 // YYYY-MM
  debt_id: string;
  description: string;
  payment: number;
  extra_payment: number;
  remaining_balance: number;
  interest_paid: number;
  cumulative_interest: number;
  notes: string;
}

// ── Expenses ──────────────────────────────────────────────────────────────

export interface RecurringExpense {
  expense_id: string;
  description: string;
  category_id: string;
  amount: number;
  frequency: string;
  due_day: string;
  auto_pay: string;
  vendor: string;
  notes: string;
}

// ── Goals ─────────────────────────────────────────────────────────────────

export type GoalStatus = "active" | "on-hold" | "completed" | "cancelled";

export interface SavingsGoal {
  goal_id: string;
  description: string;
  target_amount: number;
  current_amount: number;
  monthly_contribution: number;
  start_date: string;
  target_date: string;
  priority: number;
  status: GoalStatus;
}

// ── Analysis ──────────────────────────────────────────────────────────────

export interface FinancialHealth {
  date: string;
  dti_ratio: number;
  dti_status: string;
  savings_rate: number;
  savings_status: string;
  emergency_ratio: number;
  emergency_status: string;
  housing_ratio: number;
  housing_status: string;
  net_worth_estimate: number;
  data_source: string;
  notes: string;
}

// Key-value pair format used in snapshot, strategy, car_affordability, house_affordability
export interface KVRow {
  [key: string]: string;
}

// ── Actuals ───────────────────────────────────────────────────────────────

export interface LedgerEntry {
  txn_id: string;
  date: string;
  type: string;                  // income | expense | transfer | debt_payment
  category_id: string;
  category: string;
  source_or_dest: string;
  description: string;
  amount: number;
  payment_method: string;
  debt_id: string;
  goal_id: string;
  notes: string;
}

// ── Log ───────────────────────────────────────────────────────────────────

export interface LogEntry {
  timestamp: string;
  action: string;
  task_type: string;
  details: string;
  files_modified: string;
}

// ── Cascade Events ────────────────────────────────────────────────────────

export type CascadeEvent =
  | "debt_balance_changed"
  | "debt_added"
  | "debt_removed"
  | "income_changed"
  | "expense_changed"
  | "expense_added"
  | "expense_removed"
  | "allocation_changed"
  | "goal_changed"
  | "config_changed";

export interface CascadeResult {
  event: CascadeEvent;
  filesUpdated: string[];
  changes: Array<{ file: string; description: string }>;
}

// ── API Response Wrappers ─────────────────────────────────────────────────

export interface MutationResult<T = unknown> {
  success: boolean;
  data?: T;
  cascade?: CascadeResult;
  logged?: boolean;
  error?: string;
}
