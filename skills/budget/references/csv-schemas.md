# CSV Schema Reference

All budget data lives in CSV files under `/Users/crilopez/budget/finance/`.
The `budget` MCP tool uses logical table names — this maps names → columns.

## Table of Contents

- [Config tables](#config-tables) — settings, family_profile, expense_categories
- [Income tables](#income-tables) — income_sources, paystub_breakdown
- [Budget tables](#budget-tables) — budget_annual, budget_monthly
- [Debt tables](#debt-tables) — debts, payoff_plan
- [Expense tables](#expense-tables) — recurring_expenses
- [Goal tables](#goal-tables) — savings_goals
- [Analysis tables](#analysis-tables) — financial_health, snapshot, goal_allocation_strategy, car_affordability, us_house_affordability
- [Actuals tables](#actuals-tables) — ledger
- [Log tables](#log-tables) — planner_log

---

## Config tables

### settings
**Path:** `config/settings.csv` | **Key:** `key`

| Column | Type | Notes |
|--------|------|-------|
| key | string | Setting name (e.g. `cop_usd_rate`, `budget_method`) |
| value | string | Setting value |
| updated | string | Date last changed |

### family_profile
**Path:** `config/family_profile.csv` | **Key:** `member_id`

| Column | Type | Notes |
|--------|------|-------|
| member_id | string | M-001, M-002, M-003 |
| name | string | |
| role | string | primary_earner, spouse, child |
| birth_year | string | |
| notes | string | |

### expense_categories
**Path:** `config/expense_categories.csv` | **Key:** `category_id`

| Column | Type | Notes |
|--------|------|-------|
| category_id | string | CAT-001 through CAT-023 |
| category | string | Display name |
| subcategory | string | |
| bucket | string | `needs` / `wants` / `debt` / `savings` |
| is_four_wall | string | `yes` / `no` — Ramsey four walls |
| default_priority | number | Lower = higher priority |
| notes | string | |

---

## Income tables

### income_sources
**Path:** `{year}/income/income_sources.csv` | **Key:** `source_id`

| Column | Type | Notes |
|--------|------|-------|
| source_id | string | INC-001 (salary), INC-002 (ESPP), INC-003 (RSU), INC-004 (rental) |
| member_id | string | FK → family_profile |
| description | string | |
| type | string | `salary` / `espp` / `rsu` / `rental` / `bonus` / `other` |
| gross_monthly | number | |
| net_monthly | number | Used for budget math |
| frequency | string | `semi-monthly` / `monthly` / `quarterly` / `annual` / `irregular` |
| start_date | string | |
| end_date | string | |
| notes | string | |

### paystub_breakdown
**Path:** `{year}/income/paystub_breakdown_01.csv` | **Key:** `line_item`

| Column | Type | Notes |
|--------|------|-------|
| line_item | string | Gross, Federal Tax, etc. |
| per_period | number | Per paycheck amount |
| jan_total | number | January total |
| type | string | `gross` / `deduction` / `tax` |
| notes | string | |

---

## Budget tables

### budget_annual
**Path:** `{year}/budget/budget_annual.csv` | **Key:** `category_id`

| Column | Type | Notes |
|--------|------|-------|
| category_id | string | FK → expense_categories |
| category | string | Display name |
| subcategory | string | |
| bucket | string | `needs`/`wants`/`debt`/`savings` |
| monthly_budget | number | Default monthly amount |
| annual_budget | number | = monthly × 12 |
| priority | number | |
| notes | string | |

### budget_monthly
**Path:** `{year}/budget/budget_monthly.csv` | **Key:** `category_id`

| Column | Type | Notes |
|--------|------|-------|
| category_id | string | FK → expense_categories |
| category | string | Display name |
| jan–dec | number | 12 month columns. Can vary per-month (e.g. CC payoff ends Jun, Colombia Extra starts Jul) |
| annual_total | number | Sum of jan–dec |

---

## Debt tables

### debts
**Path:** `{year}/debt/debts.csv` | **Key:** `debt_id`

| Column | Type | Notes |
|--------|------|-------|
| debt_id | string | DEBT-001 (CC), DEBT-002 (Colombia home) |
| description | string | |
| type | string | credit_card, mortgage_foreign |
| original_amount | number | |
| current_balance | number | **Primary mutation target** |
| interest_rate_annual | number | Percentage (11.75, 11.12) |
| minimum_payment | number | Monthly payment |
| due_day | number | |
| start_date | string | |
| term_months | number | |
| lender | string | |
| priority_snowball | number | |
| priority_avalanche | number | |
| notes | string | |

### payoff_plan
**Path:** `{year}/debt/payoff_plan.csv` | **Key:** `month + debt_id`

| Column | Type | Notes |
|--------|------|-------|
| month | string | YYYY-MM |
| debt_id | string | FK → debts |
| description | string | |
| payment | number | Regular payment |
| extra_payment | number | Extra beyond minimum |
| remaining_balance | number | After payment |
| interest_paid | number | That month's interest |
| cumulative_interest | number | Running total |
| notes | string | "PAID OFF!" marker |

---

## Expense tables

### recurring_expenses
**Path:** `{year}/expenses/recurring_expenses.csv` | **Key:** `expense_id`

| Column | Type | Notes |
|--------|------|-------|
| expense_id | string | EXP-001, EXP-002... (auto-generated if omitted) |
| description | string | |
| category_id | string | FK → expense_categories |
| amount | number | Monthly cost |
| frequency | string | monthly, annual, etc. |
| due_day | string | |
| auto_pay | string | yes/no |
| vendor | string | |
| notes | string | |

---

## Goal tables

### savings_goals
**Path:** `{year}/goals/savings_goals.csv` | **Key:** `goal_id`

| Column | Type | Notes |
|--------|------|-------|
| goal_id | string | GOAL-001 through GOAL-006 |
| description | string | |
| target_amount | number | |
| current_amount | number | |
| monthly_contribution | number | |
| start_date | string | |
| target_date | string | |
| priority | number | |
| status | string | active, completed, paused |

---

## Analysis tables

### financial_health
**Path:** `{year}/analysis/financial_health.csv` | **Key:** `date`

| Column | Type | Notes |
|--------|------|-------|
| date | string | YYYY-MM-DD |
| dti_ratio | number | Debt-to-income (target ≤0.36) |
| dti_status | string | ✅ Excellent / ⚠️ etc. |
| savings_rate | number | (target ≥0.20) |
| savings_status | string | |
| emergency_ratio | number | Months of expenses (target ≥6) |
| emergency_status | string | |
| housing_ratio | number | (target ≤0.28) |
| housing_status | string | |
| net_worth_estimate | number | |
| data_source | string | |
| notes | string | |

### snapshot
**Path:** `{year}/snapshot_{year}.csv` | **Key:** `metric`

Key-value store. Metrics include: `total_net_monthly_income`, `total_debt_balance`, `total_savings`, `estimated_net_worth`, `monthly_needs`, `monthly_wants`, `monthly_debt`, `monthly_savings`, `active_goals_count`, `total_goal_contributions`.

| Column | Type | Notes |
|--------|------|-------|
| metric | string | Metric name |
| value | string | Polymorphic — parsed contextually |
| as_of_date | string | |
| notes | string | |

### goal_allocation_strategy
**Path:** `{year}/analysis/goal_allocation_strategy.csv` | **Key:** `section + parameter`

Scenario comparison (A=Colombia First, B=House First, C=Balanced). Sections: CC_PAYOFF, COLOMBIA, HOUSE_SAVINGS, SUMMARY.

| Column | Type | Notes |
|--------|------|-------|
| section | string | |
| parameter | string | |
| scenario_a_colombia_first | string | **Locked-in scenario** |
| scenario_b_house_first | string | |
| scenario_c_balanced | string | |
| notes | string | |

### car_affordability / us_house_affordability
Parameter-value tables for analysis. Read-only in normal operations.

---

## Actuals tables

### ledger
**Path:** `{year}/actuals/ledger_01.csv` | **Key:** `txn_id`

| Column | Type | Notes |
|--------|------|-------|
| txn_id | string | TXN-001, TXN-002... |
| date | string | YYYY-MM-DD |
| type | string | income, expense, transfer |
| category_id | string | FK → expense_categories |
| category | string | |
| source_or_dest | string | |
| description | string | |
| amount | number | |
| payment_method | string | |
| debt_id | string | FK → debts (if debt payment) |
| goal_id | string | FK → savings_goals (if saving) |
| notes | string | |

---

## Log tables

### planner_log
**Path:** `{year}/logs/planner_log.csv` | **No primary key** (append-only)

| Column | Type | Notes |
|--------|------|-------|
| timestamp | string | ISO 8601 |
| action | string | What happened |
| task_type | string | debt, income, budget, etc. |
| details | string | Human-readable |
| files_modified | string | Semicolon-separated list |
