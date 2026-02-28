---
name: budget-planner
description: >
  Use when managing family finances, budgets, debts, expenses, income, savings goals, allocations,
  financial health checks, paystubs, car/house affordability analysis, COP/USD conversions,
  or any operation on the family budget CSV files. Provides a CLI and sandboxed JavaScript API
  with automatic cascade updates across all dependent CSV files.
  Finance root: ~/budget/finance/ | Method: zero-based budgeting | Currency: USD (COP via config rate).
---

# Budget Planner

Family finance engine with cascade updates. All operations go through the budget CLI.

Invoice/paystub ingestion: parse PDF/image documents through the `invoice-parser` skill first.

## Quick Start

### CLI Commands (simple operations)

```bash
# List debts
node ~/.copilot/skills/budget-planner/scripts/budget.js list-debts

# Update a debt balance (cascades to 5+ files)
node ~/.copilot/skills/budget-planner/scripts/budget.js update-balance --id DEBT-002 --balance 77000 --note "Feb payment"

# Financial health check
node ~/.copilot/skills/budget-planner/scripts/budget.js health

# Run full audit
node ~/.copilot/skills/budget-planner/scripts/budget.js audit

# Validate zero-based budget
node ~/.copilot/skills/budget-planner/scripts/budget.js validate
```

### Exec Mode (complex/multi-step operations)

```bash
node ~/.copilot/skills/budget-planner/scripts/budget.js exec --code '
  const [health, snapshot, audit] = await Promise.all([
    budget.analysis.health(),
    budget.analysis.snapshot(),
    budget.audit()
  ])
  return { health, snapshot, audit }
'
```

The `budget` object is injected into the sandbox. All methods are async — use `await` and `return`.

### Global Flags

- `--root <path>` — Finance root directory (default: `~/budget/finance`)
- `--year <year>` — Budget year (default: current year)

## CLI Commands

| Command | Description |
|---------|-------------|
| `list-debts` | List all debts |
| `update-balance --id --balance --note` | Update debt balance + cascade |
| `add-debt --description --type --balance --rate --payment` | Add new debt |
| `payoff-plan --id` | Get debt payoff schedule |
| `list-income` | List all income sources |
| `list-expenses` | List all recurring expenses |
| `expense-summary` | Expenses grouped by category |
| `add-expense --description --category-id --amount` | Add recurring expense |
| `list-goals` | List all savings goals |
| `add-goal --description --target --contribution` | Add savings goal |
| `add-transaction --date --type --category-id --description --amount` | Record a transaction |
| `health` | Financial health metrics |
| `snapshot` | Current financial snapshot |
| `strategy` | Goal allocation strategy |
| `validate` | Zero-based budget validation |
| `audit` | Full cross-file validation |
| `log --limit` | Planner activity log |
| `exec --code` | Execute JavaScript in sandbox |

## Complete API Reference (exec mode)

### config — Settings & family profile

```
budget.config.get()                          → { settings, family, categories }
budget.config.getSetting(key)                → string | undefined
budget.config.setSetting(key, value)         → MutationResult (cascades)
budget.config.getCopRate()                   → number (default 3600)
budget.config.setCopRate(rate)               → MutationResult
```

### income — Salary, ESPP, RSU, rental

```
budget.income.list()                         → rows[]
budget.income.get({ id })                    → row | undefined
budget.income.update({ id, field, value })   → MutationResult (cascades)
budget.income.add({ id, member_id, description, type, gross_monthly, net_monthly, frequency })
```

IDs: INC-001 (Salary), INC-002 (ESPP), INC-003 (RSU), INC-004 (Colombia Rental)

### debts — Credit card, Colombia home loan & car loan

```
budget.debts.list()                          → rows[]
budget.debts.get({ id })                     → row | undefined
budget.debts.add({ id?, description, type, current_balance, interest_rate_annual, minimum_payment, ... })
                                             → MutationResult (auto-ID + cascade)
budget.debts.updateBalance({ id, balance, note? })  → MutationResult ⭐ CASCADES TO 5 FILES
budget.debts.update({ id, field, value })    → MutationResult (cascades)
budget.debts.recalculatePayoff({ id? })      → MutationResult
budget.debts.getPayoffPlan({ id? })          → payoff rows[]
```

IDs: DEBT-001 (CC 11.75%), DEBT-002 (Colombia home), DEBT-003 (Car loan)

### expenses — Recurring bills

```
budget.expenses.list()                       → rows[]
budget.expenses.get({ id })                  → row | undefined
budget.expenses.add({ id?, description, category_id, amount, frequency?, auto_pay?, vendor?, notes? })
                                             → MutationResult (auto-ID, validates category, cascade)
budget.expenses.update({ id, field, value }) → MutationResult (cascades)
budget.expenses.remove({ id })               → MutationResult (cascades)
budget.expenses.summary()                    → [{category_id, category, count, monthly_total}]
```

IDs: EXP-001 through EXP-026. category_id validated against expense_categories.

### allocations — Budget lines (annual & monthly grid)

```
budget.allocations.listAnnual()              → rows[]
budget.allocations.listMonthly()             → rows[] (12-month grid)
budget.allocations.getAnnual({ categoryId }) → row | undefined
budget.allocations.setAnnual({ categoryId, amount, notes? })   → MutationResult (cascades)
budget.allocations.setMonthly({ categoryId, month, amount })   → MutationResult
  month: "jan", "feb", ... "dec"
budget.allocations.validate()                → ValidationResult (zero-based check)
```

Categories: CAT-001 (Rent) through CAT-026. Buckets: needs/wants/debt/savings.

### goals — Savings targets

```
budget.goals.list()                          → rows[]
budget.goals.get({ id })                     → row | undefined
budget.goals.add({ id?, description, target_amount, monthly_contribution?, ... })
                                             → MutationResult (auto-ID + cascade)
budget.goals.update({ id, field, value })    → MutationResult (cascades)
```

IDs: GOAL-001 through GOAL-006

### analysis — Snapshots, health, projections

```
budget.analysis.snapshot()                   → metric/value rows[]
budget.analysis.snapshotGet({ metric })      → string | undefined
budget.analysis.snapshotSet({ metric, value, notes? })
budget.analysis.health()                     → financial health rows[]
budget.analysis.strategy()                   → goal allocation strategy rows[]
budget.analysis.carAffordability()           → car scenarios[]
budget.analysis.houseAffordability()         → house scenarios[]
budget.analysis.projectHouseFund({
  startBalance, monthlyContribution, startMonth, months, annualYield?, extras?
})  → { entries[], finalBalance }
```

### audit — Cross-file validation

```
budget.audit()  → { ok, issues[], summary: { errors, warnings, infos } }
```

Checks: zero-based math, debt↔payoff sync, expense↔budget sync, snapshot staleness.

### actuals — Transaction ledger

```
budget.actuals.list({ month? })              → rows[]
budget.actuals.add(entry)                    → MutationResult (auto txn_id, validates category_id)
budget.actuals.addMany(entries[])            → MutationResult (batch, auto txn_ids)
budget.actuals.update({ txnId, field, value }) → MutationResult
budget.actuals.remove({ txnId })             → MutationResult
```

### log — Audit trail

```
budget.log.list({ limit? })                  → log entries[] (newest first)
```

Every mutation auto-appends to the planner log.

## Cascade Rules

Mutations automatically propagate. Never manually edit downstream files.

| Mutation | Auto-updates |
|----------|-------------|
| `debts.updateBalance()` | payoff_plan → snapshot → strategy → financial_health |
| `income.update/add()` | snapshot → financial_health |
| `allocations.setAnnual/setMonthly()` | snapshot → financial_health |
| `expenses.add/update/remove()` | financial_health |
| `goals.update()` | snapshot |

## MutationResult Shape

Every write returns:
```json
{
  "success": true,
  "data": { ... },
  "cascade": { "event": "...", "filesUpdated": [...], "changes": [...] },
  "logged": true
}
```

Check `success` before reporting results. On failure: `{ "success": false, "error": "..." }`.

### Household bookkeeping conventions

- Treat Remitly/remittance transfers to Colombian accounts as internal transfers, not expenses.
- Do not auto-record Remitly as spending unless the user explicitly asks to log it as a transfer.

## Common Workflows

### Update a debt balance

```bash
node ~/.copilot/skills/budget-planner/scripts/budget.js update-balance --id DEBT-002 --balance 77000 --note "Abono a capital Feb 2026"
```

Or via exec for complex operations:

```bash
node ~/.copilot/skills/budget-planner/scripts/budget.js exec --code '
  const rate = await budget.config.getCopRate()
  const copBalance = 277000000
  const usdBalance = Math.round(copBalance / rate)
  return budget.debts.updateBalance({ id: "DEBT-002", balance: usdBalance, note: `${copBalance} COP @ ${rate}` })
'
```

### Monthly health check

```bash
node ~/.copilot/skills/budget-planner/scripts/budget.js exec --code '
  const [health, snapshot, audit] = await Promise.all([
    budget.analysis.health(),
    budget.analysis.snapshot(),
    budget.audit()
  ])
  return { health, snapshot, audit }
'
```

### Project house fund forward

```bash
node ~/.copilot/skills/budget-planner/scripts/budget.js exec --code '
  return budget.analysis.projectHouseFund({
    startBalance: 0,
    monthlyContribution: 908,
    startMonth: "2026-07",
    months: 18,
    annualYield: 0.04,
    extras: { "2026-08": 6000, "2027-02": 6000 }
  })
'
```

## References

- **CSV column definitions**: Read [references/csv-schemas.md](references/csv-schemas.md)
- **Filesystem layout & cascade graph**: Read [references/file-map.md](references/file-map.md)
