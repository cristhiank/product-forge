# Finance Filesystem Map

Root: `/Users/crilopez/budget/finance/`

## Directory Structure

```
finance/
├── config/                          # Global (not year-scoped)
│   ├── settings.csv                 # cop_usd_rate, budget_method, locale
│   ├── family_profile.csv           # Cristhian, Alejandra, Jacobo
│   └── expense_categories.csv       # 23 categories with bucket + priority
│
├── 2026/                            # Year-scoped
│   ├── income/
│   │   ├── income_sources.csv       # 4 sources: salary, ESPP, RSU, rental
│   │   ├── paystub_breakdown_01.csv # January gross-to-net
│   │   └── paystubs/                # Raw paystub PDFs/data
│   │
│   ├── budget/
│   │   ├── budget_annual.csv        # Category allocations (monthly + annual)
│   │   └── budget_monthly.csv       # 12-month grid with per-month overrides
│   │
│   ├── debt/
│   │   ├── debts.csv                # 3 debts: CC + Colombia home loan + car
│   │   └── payoff_plan.csv          # Month-by-month amortization schedule
│   │
│   ├── expenses/
│   │   └── recurring_expenses.csv   # 26 bills (rent, insurance, subs, etc.)
│   │
│   ├── goals/
│   │   └── savings_goals.csv        # 6 goals (house fund, pension, etc.)
│   │
│   ├── analysis/
│   │   ├── financial_health.csv     # DTI, savings rate, emergency, housing
│   │   ├── goal_allocation_strategy.csv  # Scenario A/B/C comparison
│   │   ├── car_affordability.csv    # Car purchase analysis
│   │   └── us_house_affordability.csv    # House purchase analysis
│   │
│   ├── actuals/
│   │   └── ledger_01.csv            # Actual transactions
│   │
│   ├── real_moves/
│   │   ├── ...                       # Invoice/receipt/paystub sources (PDF/image)
│   │   └── readable/                 # Mirrored .txt sidecars + index.json/index.csv
│   │
│   ├── logs/
│   │   └── planner_log.csv          # Audit trail (auto-appended)
│   │
│   └── snapshot_2026.csv            # Key-value financial snapshot
│
└── history/                         # Cross-year archive
```

## Cascade Dependency Graph

When a file changes, the cascade engine automatically propagates updates downstream.

```
debts.csv ──────────┐
  (balance change)   │
                     ▼
              payoff_plan.csv
                     │
                     ├──▶ snapshot_2026.csv
                     │
                     ├──▶ goal_allocation_strategy.csv
                     │         (Colombia projections)
                     │
                     └──▶ financial_health.csv
                               (DTI, net worth)

income_sources.csv ──┐
  (salary change)    │
                     ├──▶ snapshot_2026.csv
                     │
                     └──▶ financial_health.csv

budget_annual.csv ───┐
  (allocation change)│
                     ├──▶ snapshot_2026.csv
                     │         (bucket totals)
                     │
                     └──▶ financial_health.csv

savings_goals.csv ───┐
  (goal change)      │
                     └──▶ snapshot_2026.csv
                               (active goals count)

recurring_expenses ──┐
  (add/change/remove)│
                     └──▶ financial_health.csv
```

## Cascade Events

| Event | Trigger | Files Updated |
|-------|---------|---------------|
| `debt_balance_changed` | `debts.updateBalance()` | payoff_plan → snapshot → strategy → financial_health |
| `income_changed` | `income.update()` / `income.add()` | snapshot → financial_health |
| `allocation_changed` | `allocations.setAnnual()` / `setMonthly()` | snapshot → financial_health |
| `expense_changed` | `expenses.add()` / `update()` / `remove()` | financial_health |
| `goal_changed` | `goals.update()` | snapshot |
| `config_changed` | `config.setSetting()` | (logged only) |

## ID Conventions

| Entity | Pattern | Examples |
|--------|---------|----------|
| Family member | `M-NNN` | M-001 (Cristhian), M-002 (Alejandra), M-003 (Jacobo) |
| Income source | `INC-NNN` | INC-001 (Salary), INC-002 (ESPP), INC-003 (RSU), INC-004 (Rental) |
| Debt | `DEBT-NNN` | DEBT-001 (CC), DEBT-002 (Colombia home), DEBT-003 (Car) |
| Expense | `EXP-NNN` | EXP-001 through EXP-026 (auto-generated if omitted) |
| Category | `CAT-NNN` | CAT-001 (Rent/Mortgage) through CAT-026 |
| Goal | `GOAL-NNN` | GOAL-001 through GOAL-006 |
| Transaction | `TXN-NNN` | Sequential per ledger |

## Household Context

- **Cristhian Lopez** (M-001): Primary earner, Microsoft SDE. Net salary $9,886/mo.
- **Alejandra** (M-002): Spouse.
- **Jacobo** (M-003): Child.
- **Strategy**: Scenario A (Colombia First) — pay off Colombia home loan aggressively, then redirect to US house fund.
- **Currency**: USD primary. Colombia loan tracked in COP, converted at config `cop_usd_rate` (default 3600).
- **Budget Method**: Zero-based. Every dollar of net income allocated.
