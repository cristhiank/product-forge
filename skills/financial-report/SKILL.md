---
name: financial-report
description: >
  Generate beautiful, self-contained HTML financial intelligence dashboards using Chart.js.
  Create five specialized report types: comprehensive monthly dashboard, weekly pulse check,
  debt payoff tracker, goal progress report, and income analytics report. Features Chart.js v4 
  charts with zoom/pan, dark glassmorphism theme, responsive design, and Google data storytelling 
  principles. Integrates with budget-planner CLI for data gathering. Supports optional localization
  (Spanish/English) with locale-aware currency formatting and dual USD/COP display.
---

# Financial Report Dashboard Skill

Generate stunning, self-contained HTML financial intelligence dashboards with Chart.js charts, multiple report types, and data storytelling.

## Quick Start

**Four-Step Workflow:**

1. **Gather data** — Call budget-planner CLI to collect financial metrics
2. **Pick report type** — Choose from 5 specialized reports (see Report Types)
3. **Structure as DATA** — Serialize data into a `const DATA = {...}` inside the HTML
4. **Generate with Chart.js** — Use Chart.js configs to render interactive charts

**Output:** Single HTML file (500-700 lines, ~40KB) with Chart.js CDN dependencies.

**Organization:** For multiple report runs, use dated snapshot folders:
- Recommended: `/finance/YYYY/reports/YYYY-MM-DD/report-name.html`
- Flat structure (backward compatible): `/finance/YYYY/reports/report-name_YYYY-MM-DD.html`

**Snapshot Workflow:**
1. Create dated folder: `mkdir finance/2026/reports/2026-02-16`
2. Generate reports into that folder (supports multi-file sets)
3. Use relative navigation for cross-report links: `../2026-02-15/other-report.html`

---

## CDN Dependencies

Include these scripts in your HTML (in order):

```html
<!-- Chart.js v4 (core library) -->
<script src="https://cdn.jsdelivr.net/npm/chart.js@4"></script>

<!-- Hammer.js (required for touch gestures) -->
<script src="https://cdn.jsdelivr.net/npm/hammerjs@2"></script>

<!-- Chart.js Zoom Plugin (for wheel/pinch zoom and pan) -->
<script src="https://cdn.jsdelivr.net/npm/chartjs-plugin-zoom@2"></script>
```

**Load order matters:** Chart.js → Hammer.js → chartjs-plugin-zoom

---

## Chart.js Dark Theme Setup

Set these global defaults ONCE before creating any charts:

```javascript
// Dark theme configuration
Chart.defaults.color = '#9fb0cb';
Chart.defaults.borderColor = 'rgba(148,163,184,0.22)';
Chart.defaults.font.family = 'Inter, Segoe UI, Roboto, Arial, sans-serif';

// Tooltip styling
Chart.defaults.plugins.tooltip.backgroundColor = 'rgba(15,23,42,0.95)';
Chart.defaults.plugins.tooltip.titleColor = '#e6edf8';
Chart.defaults.plugins.tooltip.bodyColor = '#c7d3ea';
Chart.defaults.plugins.tooltip.borderColor = 'rgba(148,163,184,0.3)';
Chart.defaults.plugins.tooltip.borderWidth = 1;
Chart.defaults.plugins.tooltip.cornerRadius = 12;
Chart.defaults.plugins.tooltip.padding = 10;

// Legend and elements
Chart.defaults.plugins.legend.labels.usePointStyle = true;
Chart.defaults.plugins.legend.labels.pointStyleWidth = 10;
Chart.defaults.elements.line.tension = 0.4;
Chart.defaults.elements.bar.borderRadius = 8;

// Responsive behavior
Chart.defaults.responsive = true;
Chart.defaults.maintainAspectRatio = false;
```

---

## Data Gathering

### Budget API Data Assembly

Use budget-planner CLI exec mode to gather data, then assemble into a structured `DATA` object:

```javascript
// Core snapshot
const snapshot = await budget.analysis.snapshot();
const health = await budget.analysis.health();

// Budget vs actuals
const allocations = await budget.allocations.listAnnual();
const actuals = await budget.actuals.list();

// Debt intelligence
const payoffPlan = await budget.debts.getPayoffPlan();

// Goals tracking
const goals = await budget.goals.list();

// Expense patterns
const expenseSummary = await budget.expenses.summary();
const audit = await budget.audit();

// Advanced lenses (optional)
const lens = await budget.analysis.lens();
const monthComparison = await budget.analysis.monthComparison();
```

### Report-Specific Data

Different report types need different data:

- **Full Dashboard:** All endpoints (comprehensive)
- **Weekly Pulse:** `expenses.summary({ days: 7 })`, actuals, budget context
- **Debt Tracker:** `debts.getPayoffPlan()`, payment history, strategy
- **Goal Progress:** `goals.list()`, savings actuals, budget allocations

See `references/report-types.md` for detailed data requirements per report.

---

## DATA Object Structure

Embed this structure in HTML as `const DATA = {...}`:

```javascript
const DATA = {
  asOf: "2026-02-16",
  vitals: { dti: 0.134, savingsRate: 0.116, emergencyMonths: 3.34, netWorth: 89156.14 },
  budget: {
    monthlyByBucket: { needs: 5991, wants: 831.5, savings: 1148.68, debt: 2914.82 },
    actualYtdByBucket: { needs: 20708.94, wants: 5847.36, savings: 0, debt: 0 }
  },
  monthlyExpenses: [{ month: "2026-01", total: 10019.88 }],
  weeklyExpenses: [{ week_start: "2026-01-05", total: 300.07 }],
  topCategories: [{ category: "Housing", total: 7114 }],
  debt: { summaries: [{ description: "Credit Card", balance: 9650, apr: 11.75 }] },
  goals: [{ description: "House Down Payment", target: 50000, current: 0 }]
};
```

**See `assets/dashboard-template.html` for complete DATA structure example.**

---

## Data Storytelling Principles

Follow Google's data storytelling framework:

### 1. Context
Set the scene: what period, what's the financial stage, what's the baseline.

**Example:** "February 2026 Financial Snapshot — 46 days into the year, tracking zero-based budget."

### 2. Narrative
Tell a story with the data.

**Example:** "Spending increased 65% vs January driven by car purchase and Atlanta trip. Debt payoff on track with Credit Card elimination by Jul 2028. Emergency fund holding at 3.3 months."

**Income narrative:** Always contextualize spending relative to income. Example: "Gross income $16.3K/mo with 39.5% tax rate. Salary constitutes primary income stream; side income added $2.1K this quarter. Tax burden is high—consider increasing 401k contributions."

### 3. Visuals
Choose the RIGHT chart type for the story (see Chart Selection Guide below).

### 4. Action
End with what to DO.

**Example:** "Reduce DoorDash spending by $200/mo to restore savings rate to 20% target."

---

## Chart Selection Guide

| Story | Chart Type | Why |
|-------|------------|-----|
| How is X trending over time? | Line | Shows direction and momentum |
| How does X compare to Y? | Bar (grouped) | Side-by-side comparison |
| What's the breakdown/composition? | Doughnut | Part-to-whole relationships |
| Am I on track to goal? | Progress bar | Clear current vs target |
| What's my trajectory? | Area (stacked) | Cumulative change over time |
| Where's the outlier? | Highlighted bar | Draws attention to anomalies |
| How do parts change over time? | Stacked bar | Composition over time periods |

---

## Report Types

### 1. Full Dashboard (comprehensive-dashboard.html)
**Purpose:** Monthly financial review with all metrics  
**Sections:** Vitals, income review, trends, budget, debt, goals, findings, comparisons, audit  
**Charts:** Line (trends), doughnut (composition), stacked area (debt), bars (comparison)

**Income Review Requirements:**
- **Always include:** Gross income, net income, effective tax rate
- **Breakdown:** Salary (primary) vs other income with explicit labels
- **Actionability:** Flag high tax burden (>35%) or optimization opportunities
- **Trend context:** YTD income vs budget, consistency check
- **Data sources:** Use `vitals.grossIncomeMonthly`, `vitals.netIncomeMonthly`, `totals.incomeYtd`

### 2. Weekly Pulse (weekly-pulse.html)
**Purpose:** Quick 1-page weekly spending snapshot  
**Sections:** Week KPIs, daily spending, top categories, vs prior week, callout  
**Charts:** Bar (daily), horizontal bar (categories)

### 3. Debt Payoff Tracker (debt-tracker.html)
**Purpose:** Deep-dive debt elimination dashboard  
**Sections:** Debt waterfall, debt cards, interest cost, what-if scenarios, milestones  
**Charts:** Stacked area (waterfall), progress bars, horizontal bar (interest)

### 4. Goal Progress (goal-progress.html)
**Purpose:** Savings goals tracking with milestones  
**Sections:** Goal cards, contribution trends, completion projections, milestones, allocation  
**Charts:** Progress bars (thermometer), line (contributions), doughnut (allocation)

### 5. Income Report (income-report.html)
**Purpose:** Dedicated income analytics and tax analysis  
**Sections:** KPI grid (gross/net/tax rate), breakdown (salary vs other), trend analysis, insights  
**Charts:** Optional trend line or simple table for monthly comparisons  
**Focus:** Income stability, tax optimization, diversification opportunities

**See `references/report-types.md` for complete specifications.**

---

## Chart Functions Quick Reference

### Line Chart (Expense Trends)

```javascript
new Chart(ctx, {
  type: 'line',
  data: {
    labels: ['Jan', 'Feb', 'Mar'],
    datasets: [{
      label: 'Monthly Expenses',
      data: [4500, 5200, 4800],
      borderColor: '#38bdf8',
      backgroundColor: 'rgba(56,189,248,0.15)',
      fill: true
    }]
  },
  options: {
    plugins: {
      tooltip: { callbacks: { label: (ctx) => money(ctx.raw) } },
      zoom: { zoom: { wheel: { enabled: true }, mode: 'x' }, pan: { enabled: true, mode: 'x' } }
    }
  }
});
```

### Doughnut Chart (Category Breakdown)

```javascript
new Chart(ctx, {
  type: 'doughnut',
  data: {
    labels: ['Needs', 'Wants', 'Savings', 'Debt'],
    datasets: [{
      data: [5991, 831.5, 1148.68, 2914.82],
      backgroundColor: [COLORS[0], COLORS[1], COLORS[2], COLORS[3]],
      borderColor: 'rgba(15,23,42,0.9)',
      borderWidth: 2
    }]
  },
  options: {
    cutout: '62%',
    plugins: {
      tooltip: {
        callbacks: {
          label: (ctx) => {
            const total = ctx.dataset.data.reduce((a,b)=>a+b,0);
            return `${ctx.label}: ${money(ctx.raw)} (${pct(ctx.raw/total)})`;
          }
        }
      }
    }
  }
});
```

### Bar Chart (Weekly Spending)

```javascript
new Chart(ctx, {
  type: 'bar',
  data: {
    labels: ['Week 1', 'Week 2', 'Week 3', 'Week 4'],
    datasets: [{
      data: [1200, 980, 1450, 1100],
      backgroundColor: COLORS.map(c => c + 'CC')
    }]
  },
  options: {
    plugins: {
      tooltip: { callbacks: { label: (ctx) => money(ctx.raw) } }
    }
  }
});
```

**See `references/chart-api.md` for complete Chart.js patterns.**

---

## Report Navigation

All reports include a navigation bar to switch between types:

```html
<nav class="report-nav">
  <a href="comprehensive-dashboard.html" class="active">Full Dashboard</a>
  <a href="weekly-pulse.html">Weekly Pulse</a>
  <a href="debt-tracker.html">Debt Tracker</a>
  <a href="goal-progress.html">Goal Progress</a>
</nav>
```

Set `class="active"` on the current report link.

---

## Design System Overview

### Color Palette

```javascript
const COLORS = [
  '#38bdf8',  // Sky blue
  '#a78bfa',  // Violet
  '#34d399',  // Emerald
  '#f59e0b',  // Amber
  '#f472b6',  // Pink
  '#22d3ee',  // Cyan
  '#f97316',  // Orange
  '#60a5fa',  // Blue
  '#10b981',  // Green
  '#eab308'   // Yellow
];
```

### Key Components
- **Hero header:** Gradient glassmorphism banner
- **KPI cards:** Financial metrics with status indicators
- **Chart containers:** Fixed-height wrappers for Chart.js
- **Progress bars:** Goal tracking with color-coded fills
- **Tables:** Glassmorphism financial data tables
- **Callouts:** Highlighted insights with color-coded borders

**See `references/design-system.md` for complete CSS.**

---

## Utilities

```javascript
// Format as USD currency
const money = (v) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 2 }).format(v || 0);

// Format as percentage
const pct = (v, d = 1) => `${(v * 100).toFixed(d)}%`;

// Get status indicator [class, label]
function status(metric, value) {
  if (metric === 'dti') return value <= 0.36 ? ['good','Healthy'] : ['bad','Critical'];
  if (metric === 'savings') return value >= 0.2 ? ['good','Healthy'] : value >= 0.12 ? ['warn','Caution'] : ['bad','Critical'];
  if (metric === 'emergency') return value >= 6 ? ['good','Healthy'] : value >= 3 ? ['warn','Caution'] : ['bad','Critical'];
  return ['warn','Info'];
}
```

---

## Localization (Optional)

Default language is English. Localize only when user explicitly requests a different language (e.g., Spanish).

### Locale-Aware Utilities

Override formatters and labels based on target language:

```javascript
// Default (English)
const locale = 'en-US';
const moneyFmt = new Intl.NumberFormat(locale, { style: 'currency', currency: 'USD' });

// Spanish (Colombia) — when requested
const locale = 'es-CO';
const MONTHS = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'];
const STATUS_LABELS = { good: 'Saludable', warn: 'Precaución', bad: 'Crítico' };
```

### Dual Currency Display (COP)

For Colombia-related items, show COP equivalent:

```javascript
const copRate = 3600; // from budget.config.getCopRate()
const cop = (usd) => new Intl.NumberFormat('es-CO', {
  style: 'currency', currency: 'COP', maximumFractionDigits: 0
}).format(usd * copRate);

// Usage: `${money(89156)} (${cop(89156)} COP)`
```

### What to Localize
- Page title and `<html lang="...">`
- Section headings and lead text
- KPI labels and status chips
- Tooltip callbacks in Chart.js
- Callout/finding narratives
- Month/day names in chart labels

---

## UI Best Practices

### Emoji Icons
Use emoji in section headings for visual scanning: `📈 Financial Vitals`, `💳 Debt Intelligence`, `🏆 Goals`. Keep consistent per domain (🏠 housing, 🚗 transport, 🇨🇴 Colombia).

### Google Fonts
Load Inter font via CDN for consistent rendering:
```html
<link rel="preconnect" href="https://fonts.googleapis.com">
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet">
```

### Hero Narrative
Every report hero should include a 2-3 sentence data-driven narrative:
```html
<p class="narrative">
  Spending up 65% vs last month driven by car purchase. Debt payoff on track.
  Emergency fund holding at 3.3 months — savings rate needs attention.
</p>
```

### Smooth Scrolling
```css
html { scroll-behavior: smooth; }
```

---

## Implementation Checklist

### Data Gathering
- [ ] Call budget-planner CLI for data
- [ ] Structure as `const DATA = {...}`
- [ ] Validate all required fields present

### HTML Structure
- [ ] Include Chart.js CDN scripts (correct order)
- [ ] Set up Chart.js global dark theme defaults
- [ ] Add report navigation bar
- [ ] Create sections with semantic HTML
- [ ] Add `aria-label` to all canvas elements

### Chart Implementation
- [ ] Create canvas elements with unique IDs
- [ ] Wrap canvases in `.chart-wrap` with explicit height
- [ ] Instantiate Chart.js charts with configs
- [ ] Add money/pct formatters to tooltips
- [ ] Enable zoom/pan on time-series charts
- [ ] Use COLORS array for consistent palette

### Styling & Polish
- [ ] Apply glassmorphism design system
- [ ] Add status indicators (good/warn/bad)
- [ ] Include narrative text (context → action)
- [ ] Test responsiveness (mobile/tablet/desktop)
- [ ] Verify accessibility (screen reader friendly)

### Validation
- [ ] Open in browser (Chrome, Safari, Firefox)
- [ ] Test zoom/pan interactions
- [ ] Verify tooltips show formatted values
- [ ] Check no console errors
- [ ] Validate HTML (no errors)

---

## References

### Skill References
- **Chart.js Patterns:** `references/chart-api.md`
- **Report Type Specs:** `references/report-types.md`
- **Design System CSS:** `references/design-system.md`

### Working Template
- **Full Dashboard Example:** `assets/dashboard-template.html`

### External Docs
- **Chart.js Documentation:** https://www.chartjs.org/docs/latest/
- **Zoom Plugin Docs:** https://www.chartjs.org/chartjs-plugin-zoom/latest/
- **Budget Data:** Use `budget-planner` skill CLI for data gathering
