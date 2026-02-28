// ─── CSV Schema Registry ──────────────────────────────────────────────────
// Column definitions for every CSV file in the budget filesystem.
// Used by the storage layer to validate and serialize rows.

export interface CSVSchema {
  /** Descriptive name */
  name: string;
  /** Ordered column names (determines serialization order) */
  columns: string[];
  /** Primary key column(s) — for lookups and updates */
  primaryKey: string[];
  /** Columns that hold numeric values (parsed as numbers in typed accessors) */
  numericColumns: string[];
}

// ── Config files ──────────────────────────────────────────────────────────

export const FAMILY_PROFILE: CSVSchema = {
  name: "family_profile",
  columns: ["member_id", "name", "role", "birth_year", "notes"],
  primaryKey: ["member_id"],
  numericColumns: [],
};

export const SETTINGS: CSVSchema = {
  name: "settings",
  columns: ["key", "value", "updated"],
  primaryKey: ["key"],
  numericColumns: [],
};

export const EXPENSE_CATEGORIES: CSVSchema = {
  name: "expense_categories",
  columns: ["category_id", "category", "subcategory", "bucket", "is_four_wall", "default_priority", "notes"],
  primaryKey: ["category_id"],
  numericColumns: ["default_priority"],
};

// ── Income ────────────────────────────────────────────────────────────────

export const INCOME_SOURCES: CSVSchema = {
  name: "income_sources",
  columns: ["source_id", "member_id", "description", "type", "gross_monthly", "net_monthly", "frequency", "start_date", "end_date", "notes"],
  primaryKey: ["source_id"],
  numericColumns: ["gross_monthly", "net_monthly"],
};

export const PAYSTUB_BREAKDOWN: CSVSchema = {
  name: "paystub_breakdown",
  columns: ["line_item", "per_period", "jan_total", "type", "notes"],
  primaryKey: ["line_item"],
  numericColumns: ["per_period", "jan_total"],
};

// ── Budget ────────────────────────────────────────────────────────────────

export const BUDGET_ANNUAL: CSVSchema = {
  name: "budget_annual",
  columns: ["category_id", "category", "subcategory", "bucket", "monthly_budget", "annual_budget", "priority", "notes"],
  primaryKey: ["category_id"],
  numericColumns: ["monthly_budget", "annual_budget", "priority"],
};

export const BUDGET_MONTHLY: CSVSchema = {
  name: "budget_monthly",
  columns: ["category_id", "category", "jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec", "annual_total"],
  primaryKey: ["category_id"],
  numericColumns: ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec", "annual_total"],
};

// ── Debts ─────────────────────────────────────────────────────────────────

export const DEBTS: CSVSchema = {
  name: "debts",
  columns: ["debt_id", "description", "type", "original_amount", "current_balance", "interest_rate_annual", "minimum_payment", "due_day", "start_date", "term_months", "lender", "priority_snowball", "priority_avalanche", "notes"],
  primaryKey: ["debt_id"],
  numericColumns: ["current_balance", "interest_rate_annual", "minimum_payment", "priority_snowball", "priority_avalanche"],
};

export const PAYOFF_PLAN: CSVSchema = {
  name: "payoff_plan",
  columns: ["month", "debt_id", "description", "payment", "extra_payment", "remaining_balance", "interest_paid", "cumulative_interest", "notes"],
  primaryKey: ["month", "debt_id"],
  numericColumns: ["payment", "extra_payment", "remaining_balance", "interest_paid", "cumulative_interest"],
};

// ── Expenses ──────────────────────────────────────────────────────────────

export const RECURRING_EXPENSES: CSVSchema = {
  name: "recurring_expenses",
  columns: ["expense_id", "description", "category_id", "amount", "frequency", "due_day", "auto_pay", "vendor", "notes"],
  primaryKey: ["expense_id"],
  numericColumns: ["amount"],
};

// ── Goals ─────────────────────────────────────────────────────────────────

export const SAVINGS_GOALS: CSVSchema = {
  name: "savings_goals",
  columns: ["goal_id", "description", "target_amount", "current_amount", "monthly_contribution", "start_date", "target_date", "priority", "status"],
  primaryKey: ["goal_id"],
  numericColumns: ["target_amount", "current_amount", "monthly_contribution", "priority"],
};

// ── Analysis ──────────────────────────────────────────────────────────────

export const FINANCIAL_HEALTH: CSVSchema = {
  name: "financial_health",
  columns: ["date", "dti_ratio", "dti_status", "savings_rate", "savings_status", "emergency_ratio", "emergency_status", "housing_ratio", "housing_status", "net_worth_estimate", "data_source", "notes"],
  primaryKey: ["date"],
  numericColumns: ["dti_ratio", "savings_rate", "emergency_ratio", "housing_ratio", "net_worth_estimate"],
};

// Snapshot, strategy, car_affordability, house_affordability are key-value format
export const SNAPSHOT: CSVSchema = {
  name: "snapshot",
  columns: ["metric", "value", "as_of_date", "notes"],
  primaryKey: ["metric"],
  numericColumns: [],    // value field is polymorphic — parsed contextually
};

export const GOAL_STRATEGY: CSVSchema = {
  name: "goal_allocation_strategy",
  columns: ["section", "parameter", "scenario_a_colombia_first", "scenario_b_house_first", "scenario_c_balanced", "notes"],
  primaryKey: ["section", "parameter"],
  numericColumns: [],
};

export const CAR_AFFORDABILITY: CSVSchema = {
  name: "car_affordability",
  columns: ["parameter", "scenario_1_conservative", "scenario_2_recommended", "scenario_3_stretch", "explorer_requested", "rule", "notes"],
  primaryKey: ["parameter"],
  numericColumns: [],
};

export const HOUSE_AFFORDABILITY: CSVSchema = {
  name: "us_house_affordability",
  columns: ["parameter", "value", "rule", "status", "notes"],
  primaryKey: ["parameter"],
  numericColumns: [],
};

// ── Actuals ───────────────────────────────────────────────────────────────

export const LEDGER: CSVSchema = {
  name: "ledger",
  columns: ["txn_id", "date", "type", "category_id", "category", "source_or_dest", "description", "amount", "payment_method", "debt_id", "goal_id", "notes"],
  primaryKey: ["txn_id"],
  numericColumns: ["amount"],
};

// ── Logs ──────────────────────────────────────────────────────────────────

export const PLANNER_LOG: CSVSchema = {
  name: "planner_log",
  columns: ["timestamp", "action", "task_type", "details", "files_modified"],
  primaryKey: [],         // append-only, no primary key
  numericColumns: [],
};

// ── Registry ──────────────────────────────────────────────────────────────

export const ALL_SCHEMAS: Record<string, CSVSchema> = {
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
  planner_log: PLANNER_LOG,
};
