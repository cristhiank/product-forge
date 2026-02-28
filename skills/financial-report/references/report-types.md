# Financial Report Types

Specification for four specialized report types, each optimized for a specific use case.

---

## Overview

| Report Type | File Name | Use Case | Update Frequency | Sections |
|-------------|-----------|----------|------------------|----------|
| **Full Dashboard** | `dashboard-YYYY-MM-DD.html` or localized | Monthly review, partner meetings | Monthly | 9 (vitals, income, trends, budget, debt, goals, findings, comparisons, audit) |
| **Weekly Pulse** | `weekly-pulse.html` | Quick weekly check-in | Weekly (Sunday) | 5 (summary KPIs, daily spend, top categories, vs prior week, callout) |
| **Debt Payoff Tracker** | `debt-tracker.html` | Debt elimination focus | After payments, quarterly | 6 (waterfall, debt cards, interest cost, what-if scenarios, milestones, payoff calendar) |
| **Goal Progress** | `goal-progress.html` | Savings goals tracking | After payday, monthly | 5 (goal cards, contribution trends, completion projections, milestones, allocation mix) |
| **Income Report** | `income-report.html` | Income analytics focus | Monthly, after payday | 4 (KPI grid, breakdown, trend analysis, insights) |

### File Naming Convention

**Dated Snapshot Folders (Recommended):**
- Structure: `/finance/YYYY/reports/YYYY-MM-DD/report-name.html`
- Example: `/finance/2026/reports/2026-02-16/informe_financiero_2026-02-16.html`
- Benefits: Supports multi-file report sets, cleaner organization, easier navigation

**Flat Structure (Backward Compatible):**
- Structure: `/finance/YYYY/reports/report-name_YYYY-MM-DD.html`
- Example: `/finance/2026/reports/informe_financiero_2026-02-16.html`

When localized:
- English: `financial-report-2026-02-16.html`
- Spanish: `informe_financiero_2026-02-16.html`

**Relative Navigation:**
For cross-report links within report-nav, use relative paths when in dated folders:
```html
<!-- Inside /finance/2026/reports/2026-02-16/ -->
<nav class="report-nav">
  <a href="informe_financiero_2026-02-16.html" class="active">Panel Completo</a>
  <a href="weekly-pulse.html">Pulso Semanal</a>
  <a href="debt-tracker.html">Rastreo de Deudas</a>
  <a href="goal-progress.html">Progreso de Metas</a>
  <a href="income-report.html">Ingresos</a>
  <a href="../2026-02-15/informe_financiero_2026-02-15.html">Anterior</a>
</nav>
```

---

## 1. Full Dashboard (comprehensive-dashboard)

### Purpose
The comprehensive monthly financial intelligence report — vitals, trends, budget performance, debt tracking, goals, and actionable insights.

### When to Use
- Monthly family financial review
- Partner check-ins
- Quarterly financial planning sessions
- Annual budget retrospectives

### Data to Gather

```javascript
const data = {
  // Core snapshot
  asOf: (await budget.analysis.snapshot()).asOf,
  vitals: (await budget.analysis.health()).vitals,
  
  // Budget performance
  budget: (await budget.allocations.listAnnual()).summaries,
  actuals: (await budget.actuals.list()).actuals,
  
  // Time-series trends
  monthlyExpenses: (await budget.expenses.summary()).monthly,
  weeklyExpenses: (await budget.expenses.summary()).weekly,
  
  // Top spenders
  topCategories: (await budget.expenses.summary()).topCategories,
  topMerchants: (await budget.expenses.summary()).topMerchants,
  
  // Debt intelligence
  debt: (await budget.debts.getPayoffPlan()).summaries,
  
  // Goals tracking
  goals: (await budget.goals.list()).goals,
  
  // Advanced lenses
  lens: (await budget.analysis.lens()).lenses,
  monthComparison: (await budget.analysis.monthComparison()).comparison,
  
  // Audit status
  audit: (await budget.audit()).summary
};
```

### Sections & Charts

#### 1. **Financial Vitals** (KPI Grid)
- DTI, Savings Rate, Emergency Fund (months), Housing Ratio, Transport Ratio
- Net Worth, Debt Balance
- Status indicators (good/warn/bad)
- **No charts** — pure KPI display

#### 2. **Income Review** (KPI Grid + Breakdown)
- **KPIs:** Gross Income (monthly), Net Income (monthly), Effective Tax Rate
- **Breakdown:** Salary (primary) vs Other Income with YTD transaction count
- **Insight callout:** Tax burden analysis with actionable guidance
- **Data sources:** `vitals.grossIncomeMonthly`, `vitals.netIncomeMonthly`, `totals.incomeYtd`, `counts.incomes`
- **Narrative:** "Gross income of $X with effective tax rate of Y%. Salary constitutes primary income; other sources contribute $Z."
- **Actionability:** Flag high tax burden (>35%) or opportunities for tax optimization
- **No charts** — KPI display with text breakdown

#### 3. **Spending Trends** (Line Chart)
- **Chart:** Line chart with gradient fill
- **Data:** `monthlyExpenses` (last 6-12 months)
- **Y-axis:** Dollar amount
- **X-axis:** Months
- **Zoom:** Enable wheel/pinch zoom on X-axis
- **Tooltip:** Show formatted money value
- **Narrative:** "Spending trend shows [increase/decrease/stability] over [period]"

#### 4. **Weekly Cadence** (Bar Chart)
- **Chart:** Vertical bar chart
- **Data:** `weeklyExpenses` (last 8 weeks)
- **Y-axis:** Total spent
- **X-axis:** Week start dates
- **Colors:** Gradient per bar (top lighter, bottom darker)
- **Narrative:** "Weekly spending averages $X with [pattern description]"

#### 5. **Budget vs Actual by Bucket** (Grouped Bar)
- **Chart:** Grouped bar chart (NOT stacked)
- **Data:** `budget.monthlyByBucket` vs `budget.actualYtdByBucket` (prorated)
- **Buckets:** Needs, Wants, Savings, Debt
- **Datasets:** Budget (blue), Actual (pink)
- **Tooltip:** Show budget, actual, variance
- **Narrative:** "[Over/Under/On] budget by $X in [bucket]"

#### 6. **Category Breakdown** (Doughnut Chart)
- **Chart:** Doughnut with cutout 62%
- **Data:** `topCategories` (top 8, group rest as "Other")
- **Legend:** Right side with point style
- **Tooltip:** Category, amount, percentage of total
- **Narrative:** "Top 3 categories account for X% of spending"

#### 7. **Debt Payoff Timeline** (Stacked Area)
- **Chart:** Stacked area (line charts with fill)
- **Data:** `debt.summaries` → project balances over time
- **Y-axis:** Stacked debt balances
- **X-axis:** Months (now → payoff completion)
- **Layers:** One per debt (credit card, mortgage, auto)
- **Narrative:** "All debts paid off by [date] with $X total interest"

#### 8. **Goal Progress** (Horizontal Progress Bars)
- **Chart:** Custom HTML progress bars (NOT Chart.js)
- **Data:** `goals` array
- **Display:** Goal name, current/target, progress %, months to goal
- **Color:** Green gradient for progress fill
- **Narrative:** "[X] goals on track, [Y] need attention"

#### 9. **Month-over-Month Comparison** (Table + Callout)
- **Display:** Current vs prior month spend
- **Delta:** Absolute and percentage change
- **Callout Box:** Highlight biggest change category
- **Narrative:** "Spending [up/down] X% vs last month driven by [category]"

### Data Storytelling Flow
1. **Context:** "February 2026 Financial Snapshot — 46 days into the year"
2. **Narrative:** "Spending up 65% vs January driven by car purchase and travel. Debt payoff on track. Emergency fund holding at 3.3 months."
3. **Visuals:** Charts tell the story section-by-section
4. **Action:** "Reduce DoorDash by $200/mo to restore savings rate to 20% target"

---

## 2. Weekly Pulse (weekly-pulse)

### Purpose
Fast, actionable weekly spending snapshot — perfect for Sunday evening reviews.

### When to Use
- Every Sunday evening
- Quick expense check before week starts
- Early warning system for budget overruns

### Data to Gather

```javascript
const data = {
  asOf: new Date().toISOString().split('T')[0],
  
  // Last 7 days
  weeklyExpenses: (await budget.expenses.summary({ days: 7 })).weekly,
  
  // Current week actuals
  actuals: (await budget.actuals.list({ days: 7 })).actuals,
  
  // Top categories this week
  topCategories: (await budget.expenses.summary({ days: 7 })).topCategories.slice(0, 5),
  
  // Top merchants this week
  topMerchants: (await budget.expenses.summary({ days: 7 })).topMerchants.slice(0, 5),
  
  // Prior week for comparison
  priorWeekExpenses: (await budget.expenses.summary({ days: 14 })).weekly.slice(0, 1),
  
  // Budget context
  weeklyBudget: (await budget.allocations.listAnnual()).monthlyByBucket
};
```

### Sections & Charts

#### 1. **Week Summary KPIs** (4 Cards)
- Total spent this week
- Daily average
- vs Weekly budget (monthly budget / 4.33)
- vs Prior week (delta)
- **No charts** — KPI cards only

#### 2. **Daily Spending** (Bar Chart)
- **Chart:** Vertical bar chart
- **Data:** Last 7 days (Sun-Sat)
- **Y-axis:** Amount spent
- **X-axis:** Day of week
- **Highlight:** Today (different color)
- **Narrative:** "Peak spending on [day]: $X"

#### 3. **Top Categories This Week** (Horizontal Bar)
- **Chart:** Horizontal bar chart
- **Data:** Top 5 categories by spend
- **Y-axis:** Category names
- **X-axis:** Amount
- **Colors:** Use COLORS array
- **Narrative:** "[Category] led at $X (Y% of week)"

#### 4. **Week-over-Week Comparison** (Simple Table)
- Current week total vs prior week total
- Delta ($ and %)
- Trend indicator (↑↓→)
- **Callout:** Biggest mover category

#### 5. **One Key Callout** (Highlighted Box)
- AI-generated insight: "DoorDash up 150% this week vs last"
- Or: "On track — spending 8% below weekly budget"
- Or: "Gas spending doubled — long trip?"

### Data Storytelling Flow
1. **Context:** "Week of Feb 9-15, 2026"
2. **Narrative:** "Spent $1,245 this week (up 22% vs last week)"
3. **Visuals:** Daily bar shows Wed spike, categories show groceries led
4. **Action:** "Watch dining — already at 80% of weekly allocation"

---

## 3. Debt Payoff Tracker (debt-tracker)

### Purpose
Deep-dive debt elimination dashboard with projections, scenarios, and milestone tracking.

### When to Use
- After making debt payments
- Quarterly debt review
- When exploring extra payment strategies
- Celebrating payoff milestones

### Data to Gather

```javascript
const data = {
  asOf: new Date().toISOString().split('T')[0],
  
  // Debt summaries
  debt: (await budget.debts.getPayoffPlan()).summaries,
  
  // Payoff strategy
  strategy: (await budget.debts.getPayoffPlan()).strategy,
  
  // Monthly payments
  paymentHistory: (await budget.actuals.list({ category: 'debt' })).actuals,
  
  // Income for DTI context
  income: (await budget.analysis.health()).vitals.netIncomeMonthly
};
```

### Sections & Charts

#### 1. **Debt Waterfall** (Stacked Area Chart)
- **Chart:** Stacked area (line with fill)
- **Data:** Projected debt balances over time
- **Y-axis:** Total debt balance (stacked)
- **X-axis:** Months (now → debt-free date)
- **Layers:** One per debt account
- **Colors:** COLORS array
- **Annotations:** Milestones (50% paid, final payment)
- **Narrative:** "Debt-free by [date] — [X] months from now"

#### 2. **Individual Debt Cards** (Card Grid)
For each debt:
- **Display:** Description, balance, APR, min payment
- **Chart:** Horizontal progress bar (balance → $0)
- **Metrics:** Payoff date, months remaining, interest cost
- **Status:** On track / behind / ahead

#### 3. **Interest Cost Projection** (Bar Chart)
- **Chart:** Horizontal bar chart
- **Data:** Projected interest cost per debt
- **Y-axis:** Debt accounts
- **X-axis:** Total interest to be paid
- **Tooltip:** Monthly payment, APR, months remaining
- **Narrative:** "Save $X by paying off [debt] first (avalanche method)"

#### 4. **What-If Scenarios** (Comparison Table + Bars)
Show impact of extra payments:
- **Baseline:** Current plan
- **+$100/mo:** Payoff date, interest saved
- **+$500/mo:** Payoff date, interest saved
- **Chart:** Grouped bars showing months to payoff for each scenario

#### 5. **Payoff Milestones** (Timeline)
- **Display:** Visual timeline with checkpoints
- **Milestones:**
  - 25% paid (date, celebration note)
  - 50% paid
  - 75% paid
  - 100% paid (debt-free date!)
- **Progress:** Show current position on timeline

#### 6. **Payoff Calendar** (Table)
Month-by-month payment schedule:
- Month, payment amount, principal, interest, remaining balance
- Highlight: current month, final payment

### Data Storytelling Flow
1. **Context:** "Total debt: $133,543 across 3 accounts"
2. **Narrative:** "Debt-free in 60 months (Jan 2031) following avalanche strategy. Credit card paid first (Jul 2028), saving $1,800 in interest vs snowball."
3. **Visuals:** Waterfall shows declining balances, what-if shows adding $500/mo cuts 18 months
4. **Action:** "Add $200/mo to credit card to save $450 in interest and finish 8 months early"

---

## 4. Goal Progress (goal-progress)

### Purpose
Focused savings goals dashboard with progress tracking and milestone celebrations.

### When to Use
- After payday (track deposits)
- Monthly savings check-in
- When setting new financial goals
- Celebrating milestones

### Data to Gather

```javascript
const data = {
  asOf: new Date().toISOString().split('T')[0],
  
  // All goals
  goals: (await budget.goals.list()).goals,
  
  // Savings actuals (last 6 months)
  savingsActuals: (await budget.actuals.list({ bucket: 'savings' })).actuals,
  
  // Income context
  income: (await budget.analysis.health()).vitals.netIncomeMonthly,
  
  // Budget allocation to savings
  savingsBudget: (await budget.allocations.listAnnual()).monthlyByBucket.savings
};
```

### Sections & Charts

#### 1. **Goal Cards** (Grid of Cards)
For each active goal:
- **Display:** Goal name, target, current, monthly contribution
- **Chart:** Thermometer-style vertical progress bar
- **Metrics:** Progress %, months to goal, projected completion date
- **Status:** On track / needs boost / ahead of schedule
- **Colors:** Green (on track), amber (needs attention), blue (ahead)

#### 2. **Monthly Contribution Tracking** (Line Chart)
- **Chart:** Line chart with markers
- **Data:** Monthly savings deposits (last 6-12 months)
- **Y-axis:** Amount contributed
- **X-axis:** Months
- **Target Line:** Horizontal line showing monthly goal
- **Narrative:** "Averaging $X/mo vs $Y target"

#### 3. **Projected Completion Dates** (Timeline)
- **Display:** Horizontal timeline
- **Goals:** Ordered by completion date (soonest first)
- **Markers:** Goal name, projected month/year
- **Highlight:** Next milestone (within 3 months)

#### 4. **Milestone Celebrations** (Highlight Box)
Recent achievements:
- "🎉 Emergency Fund hit 50% ($10K) on Jan 15!"
- "🎉 Credit Card Payoff Goal 25% funded ($1,125)"
- Next milestone: "House Down Payment reaches 10% in 2 months"

#### 5. **Savings Allocation Mix** (Doughnut Chart)
- **Chart:** Doughnut
- **Data:** Monthly contribution by goal
- **Legend:** Goal names
- **Tooltip:** Goal, monthly amount, percentage of total savings
- **Narrative:** "X% of savings toward emergency fund, Y% toward house down payment"

### Data Storytelling Flow
1. **Context:** "6 active goals, $20K saved across all goals"
2. **Narrative:** "Emergency fund 60% funded, on track to complete in 14 months. House down payment progressing at $908/mo — 56 months to goal."
3. **Visuals:** Thermometer bars show visual progress, timeline shows completion sequence
4. **Action:** "Boost house down payment to $1,200/mo to hit goal 12 months sooner"

---

## 5. Income Report (income-report)

### Purpose
Dedicated income analytics report focusing on gross/net income, tax analysis, income source breakdown, and trends.

### When to Use
- Monthly income review after payday
- Tax planning and optimization analysis
- Income diversification assessment
- Tracking salary vs. supplemental income

### Sections & Content

#### 1. **KPI Grid** (3 Core Metrics)
- **Gross Income (Monthly):** Total pre-tax income
- **Net Income (Monthly):** Take-home pay after taxes
- **Effective Tax Rate:** Actual tax burden percentage
- **Data sources:** `vitals.grossIncomeMonthly`, `vitals.netIncomeMonthly`, calculated tax rate
- **Example:** "$8,333 gross → $6,250 net → 25% effective tax rate"

#### 2. **Income Breakdown**
- **Salary (Primary):** Main employment income
- **Other Sources:** Side income, investments, freelance
- **YTD Total:** Year-to-date cumulative income
- **Transaction Count:** Number of income transactions
- **Data sources:** `budget.income.list()` filtered by category
- **Narrative:** "Salary constitutes 100% of income. Consider developing additional revenue streams for diversification."

#### 3. **Trend Analysis**
- **Monthly comparison:** Current vs. prior months
- **Tax rate trends:** Track effective tax burden over time
- **Growth trajectory:** YoY income growth if available
- **Data sources:** Historical income data, month-over-month calculations
- **Visualization:** Simple table or line chart showing monthly gross/net/tax rate

#### 4. **Insights & Recommendations**
- **Tax burden analysis:** Flag high tax rates (>35%), suggest optimization strategies
- **Income stability:** Assess consistency and reliability
- **Diversification opportunities:** Recommend developing additional income streams
- **Actionable guidance:** Specific next steps based on current income profile

### Visual Style
- Matches existing report glassmorphism design
- Spanish locale for López family
- KPI cards with large bold numbers
- Insight boxes with color-coded borders (good/warn/info)
- Clean breakdown lists with emoji icons

### Navigation
Include in report-nav alongside other reports:
```html
<a href="income-report.html">Ingresos</a>
```

### Data Storytelling Flow
1. **Context:** "Monthly income of $8,333 gross, $6,250 net"
2. **Narrative:** "Effective tax rate of 25% is healthy. Salary provides stable foundation, but income is single-source dependent."
3. **Visuals:** KPI grid highlights key numbers, trend table shows consistency
4. **Action:** "Consider freelance/consulting opportunities to build secondary income stream and increase financial resilience"

---

## Navigation Between Reports

All four reports include a shared navigation bar at the top:

```html
<nav class="report-nav">
  <a href="comprehensive-dashboard.html" class="active">Full Dashboard</a>
  <a href="weekly-pulse.html">Weekly Pulse</a>
  <a href="debt-tracker.html">Debt Tracker</a>
  <a href="goal-progress.html">Goal Progress</a>
</nav>
```

Set `class="active"` on the current report.

---

## Chart Type Selection by Report

| Report | Primary Charts | Why |
|--------|---------------|-----|
| Full Dashboard | Line (trends), Doughnut (composition), Stacked Area (debt) | Comprehensive overview needs varied chart types |
| Weekly Pulse | Bar (daily), Horizontal Bar (categories) | Fast comparison of discrete values |
| Debt Tracker | Stacked Area (waterfall), Progress Bars, Horizontal Bar (interest) | Show trajectory toward zero |
| Goal Progress | Progress Bars (thermometer), Line (contributions), Doughnut (allocation) | Emphasize progress and momentum |

---

## Implementation Checklist

For each report type:

- [ ] Gather data from budget API (see Data to Gather section)
- [ ] Structure data as `const DATA = {...}` in HTML
- [ ] Set up Chart.js global dark theme defaults
- [ ] Add report navigation bar (with correct `active` class)
- [ ] Implement sections in order (see Sections & Charts)
- [ ] Create Chart.js configs for each chart
- [ ] Add money/pct formatters to tooltips
- [ ] Write narrative text for each section (context → action)
- [ ] Test responsiveness (charts resize correctly)
- [ ] Verify zoom/pan on time-series charts
- [ ] Add accessibility (aria-label on canvas elements)
- [ ] Validate HTML (no errors)
- [ ] Test in browser (Chrome, Safari, Firefox)

---

## References

- **Chart configurations:** See `references/chart-api.md`
- **Design system:** See `references/design-system.md`
- **Main skill docs:** See `SKILL.md`
