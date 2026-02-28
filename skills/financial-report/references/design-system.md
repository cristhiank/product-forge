# Design System Reference

Complete CSS design tokens, component patterns, and layout utilities for financial dashboards.

## Color Tokens

### CSS Custom Properties

```css
:root {
  /* Background */
  --bg-1: #070b19;                    /* Dark gradient start */
  --bg-2: #101a32;                    /* Dark gradient end */
  
  /* Cards & Surfaces */
  --card: rgba(17, 25, 48, 0.72);     /* Standard glassmorphism card */
  --card-strong: rgba(15, 23, 42, 0.92); /* Stronger opacity (tables, overlays) */
  
  /* Borders & Lines */
  --line: rgba(148, 163, 184, 0.22);  /* Subtle border color */
  
  /* Text */
  --txt: #e6edf8;                     /* Primary text (high contrast) */
  --muted: #9fb0cb;                   /* Secondary text (labels, hints) */
  
  /* Accent Colors */
  --accent: #7dd3fc;                  /* Primary accent (sky blue) */
  --accent-2: #38bdf8;                /* Secondary accent (deeper blue) */
  
  /* Status Colors */
  --good: #22c55e;                    /* Success / healthy metrics */
  --warn: #f59e0b;                    /* Warning / caution needed */
  --bad: #ef4444;                     /* Critical / danger */
  
  /* Additional Palette */
  --pink: #f472b6;                    /* Highlight color */
  --violet: #a78bfa;                  /* Chart accent */
  --amber: #fbbf24;                   /* Alternative warning */
  
  /* Layout */
  --radius: 16px;                     /* Standard border radius */
  --shadow: 0 10px 30px rgba(0,0,0,.35); /* Card shadow */
}
```

### Usage

```css
.my-card {
  background: var(--card);
  color: var(--txt);
  border: 1px solid var(--line);
}

.success-indicator {
  color: var(--good);
}
```

---

## Typography

### Font Stack

```css
body {
  font-family: Inter, Segoe UI, Roboto, Arial, sans-serif;
}
```

**Fallback order:** Inter → Segoe UI → Roboto → Arial → system sans-serif

### Responsive Font Sizing

Use `clamp()` for fluid typography:

```css
.hero h1 {
  font-size: clamp(26px, 4vw, 38px);
  /* Min: 26px, scales with viewport, Max: 38px */
}

.kpi .value {
  font-size: clamp(22px, 2.4vw, 30px);
}

.section h2 {
  font-size: 22px;  /* Fixed for consistency */
}
```

### Text Styling

```css
/* Label text (uppercase, tracked) */
.label {
  font-size: 12px;
  letter-spacing: 0.45px;
  text-transform: uppercase;
  color: var(--muted);
}

/* Large value text */
.value {
  font-size: clamp(22px, 2.4vw, 30px);
  font-weight: 700;
  color: var(--txt);
}

/* Supporting text */
.sub {
  font-size: 12px;
  color: #c7d3ea;
}
```

---

## Layout

### Container

```css
.container {
  max-width: 1320px;
  margin: 0 auto;
  padding: 26px;
}

@media (max-width: 900px) {
  .container {
    padding: 16px;
  }
}
```

### Grid Systems

**Automatic responsive grid:**

```css
.grid {
  display: grid;
  gap: 14px;
}

/* Two-column layout */
.two {
  grid-template-columns: repeat(2, minmax(0, 1fr));
}

/* Three-column layout */
.three {
  grid-template-columns: repeat(3, minmax(0, 1fr));
}

/* KPI grid (auto-fit) */
.kpi-grid {
  grid-template-columns: repeat(auto-fit, minmax(210px, 1fr));
  margin-bottom: 20px;
}

/* Pill grid (metrics) */
.pill-grid {
  display: grid;
  gap: 10px;
  grid-template-columns: repeat(auto-fit, minmax(230px, 1fr));
}

/* Callouts grid (findings) */
.callouts {
  display: grid;
  gap: 12px;
  grid-template-columns: 1fr 1fr;
}
```

**Responsive breakpoints:**

```css
@media (max-width: 1024px) {
  .three {
    grid-template-columns: 1fr 1fr;
  }
}

@media (max-width: 900px) {
  .two, .three {
    grid-template-columns: 1fr;
  }
  
  .callouts {
    grid-template-columns: 1fr;
  }
}
```

---

## Components

### Hero Header

Large branded header with gradient background and decorative element.

```css
.hero {
  background: linear-gradient(135deg, rgba(56,189,248,.2), rgba(167,139,250,.16));
  border: 1px solid var(--line);
  border-radius: 22px;
  box-shadow: var(--shadow);
  padding: 24px;
  position: relative;
  overflow: hidden;
  backdrop-filter: blur(8px);
}

/* Decorative gradient orb (bottom-right) */
.hero::after {
  content: '';
  position: absolute;
  inset: auto -100px -120px auto;
  width: 280px;
  height: 280px;
  border-radius: 50%;
  background: radial-gradient(circle, rgba(125,211,252,.25), transparent 70%);
  pointer-events: none;
}

.hero h1 {
  margin: 0 0 8px;
  font-size: clamp(26px, 4vw, 38px);
  letter-spacing: 0.2px;
}

.hero p {
  margin: 0;
  color: var(--muted);
}
```

**HTML:**

```html
<header class="hero">
  <h1>Financial Intelligence Dashboard</h1>
  <p>Comprehensive financial overview with actionable insights.</p>
  <div class="tags">
    <span class="tag">As of 2026-02-16</span>
    <span class="tag">Zero-Based Budget</span>
  </div>
</header>
```

---

### Tags

Small pill-shaped metadata badges.

```css
.tags {
  display: flex;
  gap: 10px;
  flex-wrap: wrap;
  margin-top: 14px;
}

.tag {
  background: rgba(15, 23, 42, 0.65);
  border: 1px solid var(--line);
  color: #d6e3fb;
  font-size: 12px;
  border-radius: 999px;
  padding: 6px 10px;
  letter-spacing: 0.3px;
}
```

**HTML:**

```html
<div class="tags">
  <span class="tag">As of <strong>2026-02-16</strong></span>
  <span class="tag">Currency: USD</span>
  <span class="tag">Audit: 0 errors</span>
</div>
```

---

### Report Navigation

Top-level navigation bar to switch between report types.

```css
.report-nav {
  display: flex;
  gap: 6px;
  margin-bottom: 16px;
  padding: 6px;
  background: rgba(15, 23, 42, 0.6);
  border-radius: 14px;
  border: 1px solid var(--line);
}

.report-nav a {
  color: var(--muted);
  text-decoration: none;
  font-size: 13px;
  font-weight: 500;
  padding: 8px 14px;
  border-radius: 10px;
  transition: all 0.2s;
}

.report-nav a:hover {
  color: var(--txt);
  background: rgba(56, 189, 248, 0.12);
}

.report-nav a.active {
  color: var(--txt);
  background: rgba(56, 189, 248, 0.2);
  font-weight: 600;
}
```

**HTML:**

```html
<nav class="report-nav">
  <a href="comprehensive-dashboard.html" class="active">Full Dashboard</a>
  <a href="weekly-pulse.html">Weekly Pulse</a>
  <a href="debt-tracker.html">Debt Tracker</a>
  <a href="goal-progress.html">Goal Progress</a>
</nav>
```

---

### Section Navigation

Horizontal pill navigation for in-page smooth scroll anchors.

```css
.nav {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
  margin: 16px 0 22px;
}

.nav a {
  color: #d6e3fb;
  text-decoration: none;
  font-size: 13px;
  border: 1px solid var(--line);
  background: rgba(15,23,42,.6);
  border-radius: 999px;
  padding: 8px 12px;
  transition: background 0.2s ease;
}

.nav a:hover {
  background: rgba(56,189,248,.18);
}
```

**HTML:**

```html
<nav class="nav">
  <a href="#vitals">Financial Vitals</a>
  <a href="#expenses">Expense Dynamics</a>
  <a href="#budget">Budget Analysis</a>
  <a href="#debt">Debt Intelligence</a>
  <a href="#goals">Goals</a>
</nav>
```

---

### Card (Glassmorphism)

Standard container for dashboard sections.

```css
.card {
  background: var(--card);
  border: 1px solid var(--line);
  border-radius: var(--radius);
  box-shadow: var(--shadow);
  backdrop-filter: blur(6px);
  padding: 16px;
}
```

**HTML:**

```html
<article class="card">
  <h3>Section Title</h3>
  <p>Content goes here...</p>
</article>
```

---

### KPI Card

Displays a single key metric with label, value, and optional status chip.

```css
.kpi .label {
  color: var(--muted);
  font-size: 12px;
  letter-spacing: 0.45px;
  text-transform: uppercase;
}

.kpi .value {
  margin-top: 6px;
  font-size: clamp(22px, 2.4vw, 30px);
  font-weight: 700;
}

.kpi .sub {
  margin-top: 6px;
  color: #c7d3ea;
  font-size: 12px;
}
```

**HTML:**

```html
<article class="card kpi">
  <div class="label">Net Worth</div>
  <div class="value">
    $89,156.14
    <span class="status-chip good">Healthy</span>
  </div>
  <div class="sub">Assets minus debts (snapshot)</div>
</article>
```

---

### Status Chip

Small inline badge for metric status.

```css
.status-chip {
  display: inline-block;
  border-radius: 999px;
  padding: 4px 8px;
  font-size: 11px;
  font-weight: 700;
  margin-left: 6px;
  border: 1px solid var(--line);
}

.good { color: var(--good); }
.warn { color: var(--warn); }
.bad { color: var(--bad); }
```

**HTML:**

```html
<span class="status-chip good">Healthy</span>
<span class="status-chip warn">Caution</span>
<span class="status-chip bad">Critical</span>
```

---

### Pill Metrics

Condensed metric display (good for dashboard summaries).

```css
.pill {
  border: 1px solid var(--line);
  border-radius: 14px;
  padding: 10px 12px;
  background: rgba(15,23,42,.7);
}

.pill .label {
  color: var(--muted);
  font-size: 12px;
}

.pill .value {
  font-size: 20px;
  font-weight: 700;
  margin-top: 4px;
}
```

**HTML:**

```html
<div class="pill-grid">
  <div class="pill">
    <div class="label">Total Debt Balance</div>
    <div class="value">$133,542.97</div>
  </div>
  <div class="pill">
    <div class="label">Weighted APR</div>
    <div class="value">9.93%</div>
  </div>
</div>
```

---

### Progress Bar

Visual representation of goal completion.

```css
.progress-row {
  margin-bottom: 10px;
}

.progress-head {
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: 12px;
  color: #c7d6ef;
  margin-bottom: 6px;
}

.bar {
  height: 10px;
  border-radius: 999px;
  background: rgba(148,163,184,.2);
  overflow: hidden;
}

.bar > span {
  display: block;
  height: 100%;
  border-radius: 999px;
}

.bar > span.good { background: var(--good); }
.bar > span.warn { background: var(--warn); }
.bar > span.bad { background: var(--bad); }
```

**HTML:**

```html
<div class="progress-row">
  <div class="progress-head">
    <span>Emergency Fund</span>
    <span>59.9%</span>
  </div>
  <div class="bar">
    <span class="good" style="width: 59.9%"></span>
  </div>
</div>
```

---

### Callout (Alert Box)

Highlighted finding or insight with color-coded left border.

```css
.callout {
  border: 1px solid var(--line);
  border-left: 4px solid var(--accent);
  border-radius: 12px;
  padding: 12px;
  background: rgba(15,23,42,.75);
}

.callout.warn { border-left-color: var(--warn); }
.callout.bad { border-left-color: var(--bad); }
.callout.good { border-left-color: var(--good); }

.callout-title {
  font-weight: 600;
  margin-bottom: 6px;
}

.callout-body {
  font-size: 13px;
  color: var(--muted);
}
```

**HTML:**

```html
<div class="callout warn">
  <div class="callout-title">⚠️ Housing Ratio Exceeds 28%</div>
  <div class="callout-body">
    Your housing costs are 31.2% of gross income. 
    Target is ≤28% per conventional lending guidelines.
  </div>
</div>

<div class="callout good">
  <div class="callout-title">✅ Strong Emergency Fund</div>
  <div class="callout-body">
    You have 6.2 months of expenses saved. This exceeds the recommended minimum.
  </div>
</div>
```

---

### Table

Financial data table with glassmorphism styling.

```css
table {
  width: 100%;
  border-collapse: collapse;
  background: var(--card-strong);
  border: 1px solid var(--line);
  border-radius: 14px;
  overflow: hidden;
}

th, td {
  padding: 10px 12px;
  border-bottom: 1px solid var(--line);
  font-size: 13px;
}

th {
  text-align: left;
  color: #9db1cf;
  font-weight: 600;
  letter-spacing: 0.2px;
}

td.num {
  text-align: right;
  font-variant-numeric: tabular-nums;
}

tr:last-child td {
  border-bottom: 0;
}
```

**HTML:**

```html
<table>
  <thead>
    <tr>
      <th>Debt</th>
      <th class="num">Balance</th>
      <th class="num">APR</th>
      <th class="num">Min Payment</th>
    </tr>
  </thead>
  <tbody>
    <tr>
      <td>Credit Card</td>
      <td class="num">$9,650</td>
      <td class="num">11.75%</td>
      <td class="num">$250</td>
    </tr>
  </tbody>
</table>
```

---

### Chart Container

Wrapper for Chart.js canvas elements with fixed height. Chart.js handles responsiveness automatically.

```css
.chart-wrap {
  position: relative;
  height: 280px;  /* Explicit height required for Chart.js */
  width: 100%;
  margin-top: 10px;
}

canvas {
  max-width: 100%;
  height: 100% !important;  /* Override Chart.js inline styles */
}
```

**HTML:**

```html
<div class="chart-wrap">
  <canvas id="monthlyExpenses" aria-label="Monthly expense trend chart showing last 6 months"></canvas>
</div>
```

**Key points:**
- Container MUST have explicit height (Chart.js requirement)
- Chart.js handles DPR scaling automatically
- Always add `aria-label` for accessibility

---

## Background System

Multi-layer gradient background for depth and visual interest.

```css
body {
  background: 
    radial-gradient(1200px 1200px at 10% -10%, #1f2e5f 0%, transparent 60%),
    radial-gradient(1200px 1200px at 95% 0%, #123b59 0%, transparent 60%),
    linear-gradient(160deg, var(--bg-1), var(--bg-2));
  min-height: 100vh;
  line-height: 1.45;
}
```

**Layers (top to bottom):**
1. Radial gradient (top-left, blue tint)
2. Radial gradient (top-right, teal tint)
3. Linear gradient (base, dark blue-gray)

---

## Section Layout

Standard section structure with heading and lead text.

```css
.section {
  margin-top: 20px;
}

.section h2 {
  margin: 0 0 6px;
  font-size: 22px;
}

.section .lead {
  color: var(--muted);
  margin: 0 0 14px;
  font-size: 14px;
}
```

**HTML:**

```html
<section id="vitals" class="section">
  <h2>Financial Vitals</h2>
  <p class="lead">Core metrics snapshot for financial health assessment.</p>
  
  <div class="grid kpi-grid">
    <!-- KPI cards -->
  </div>
</section>
```

---

## Footer Note

Small disclaimer or data source note at bottom of sections.

```css
.footer-note {
  margin-top: 18px;
  color: var(--muted);
  font-size: 12px;
  border-top: 1px dashed var(--line);
  padding-top: 12px;
}
```

**HTML:**

```html
<div class="footer-note">
  Data sources: budget.analysis.snapshot(), budget.allocations.listAnnual(), 
  budget.debts.getPayoffPlan(), budget.goals.list().
</div>
```

---

## Global Resets

```css
* {
  box-sizing: border-box;
}

html, body {
  margin: 0;
  padding: 0;
}
```

---

## Complete Theme Example

Minimal dashboard with all components:

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Financial Dashboard</title>
  <style>
    /* Include all CSS from above */
  </style>
</head>
<body>
  <div class="container">
    <header class="hero">
      <h1>Financial Dashboard</h1>
      <p>Your financial overview at a glance.</p>
      <div class="tags">
        <span class="tag">As of <strong>2026-02-16</strong></span>
      </div>
    </header>
    
    <nav class="nav">
      <a href="#vitals">Vitals</a>
      <a href="#expenses">Expenses</a>
    </nav>
    
    <section id="vitals" class="section">
      <h2>Financial Vitals</h2>
      <p class="lead">Core health metrics</p>
      
      <div class="grid kpi-grid">
        <article class="card kpi">
          <div class="label">Net Worth</div>
          <div class="value">$89,156.14</div>
          <div class="sub">Assets minus debts</div>
        </article>
      </div>
    </section>
  </div>
</body>
</html>
```

---

## Pill Status Variants

Color-coded pills for quick status indication.

```css
.pill.pill-good { border-color: rgba(34,197,94,.4); }
.pill.pill-good .value { color: var(--good); }
.pill.pill-warn { border-color: rgba(245,158,11,.4); }
.pill.pill-warn .value { color: var(--warn); }
.pill.pill-bad { border-color: rgba(239,68,68,.4); }
.pill.pill-bad .value { color: var(--bad); }
```

## Thermometer Progress Bar

Thick progress bar for goal tracking with embedded percentage text.

```css
.thermometer { height: 28px; background: rgba(148,163,184,.16); border-radius: 14px; overflow: hidden; position: relative; }
.thermometer-fill { height: 100%; border-radius: 14px; display: flex; align-items: center; justify-content: center; font-weight: 600; font-size: 12px; color: #fff; min-width: 40px; transition: width 0.6s ease; }
```

```html
<div class="thermometer">
  <div class="thermometer-fill" style="width: 59.9%; background: linear-gradient(90deg, #34d399, #22c55e);">59.9%</div>
</div>
```

## Milestone Timeline

Vertical timeline for tracking financial milestones and achievements.

```css
.milestone { display: flex; gap: 14px; align-items: flex-start; padding: 12px 14px; border: 1px solid var(--line); border-radius: 12px; background: rgba(15,23,42,.6); margin-bottom: 10px; transition: border-color 0.2s; }
.milestone:hover { border-color: var(--accent); }
.milestone-icon { font-size: 24px; flex-shrink: 0; }
.milestone-body { flex: 1; }
.milestone-text { font-size: 14px; color: var(--txt); }
.milestone-date { font-size: 12px; color: var(--muted); margin-top: 4px; }
.milestone.done { opacity: 0.6; }
.milestone.done .milestone-text { text-decoration: line-through; }
```

```html
<div class="milestone done">
  <div class="milestone-icon">🛡️</div>
  <div class="milestone-body">
    <div class="milestone-text">Fondo de emergencia alcanzó $20,000 (60%)</div>
    <div class="milestone-date">✓ Enero 2026</div>
  </div>
</div>
<div class="milestone">
  <div class="milestone-icon">💳</div>
  <div class="milestone-body">
    <div class="milestone-text">Tarjeta de crédito liquidada</div>
    <div class="milestone-date">Proyectado: Julio 2028</div>
  </div>
</div>
```

## Goal Card

Card component for individual goal tracking with embedded thermometer.

```css
.goal-card { background: var(--card); border: 1px solid var(--line); border-radius: var(--radius); padding: 16px; }
.goal-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px; }
.goal-header h4 { margin: 0; font-size: 15px; display: flex; align-items: center; gap: 8px; }
.goal-status { font-size: 11px; padding: 4px 8px; border-radius: 999px; border: 1px solid var(--line); color: var(--muted); }
.goal-metrics { display: flex; gap: 16px; margin-top: 10px; font-size: 12px; color: var(--muted); }
.goal-metrics span strong { color: var(--txt); }
```

```html
<div class="goal-card">
  <div class="goal-header">
    <h4>🏠 Cuota Inicial Casa</h4>
    <span class="goal-status">activa</span>
  </div>
  <div class="thermometer">
    <div class="thermometer-fill" style="width:12%;background:#38bdf8;">12%</div>
  </div>
  <div class="goal-metrics">
    <span><strong>$6,000</strong> / $50,000</span>
    <span><strong>$908</strong>/mes</span>
    <span>~48 meses restantes</span>
  </div>
</div>
```

---

## Accessibility Notes

- **Color Contrast:** Current theme passes WCAG AA for normal text
- **Focus States:** Add focus styles for keyboard navigation
  ```css
  .nav a:focus {
    outline: 2px solid var(--accent);
    outline-offset: 2px;
  }
  ```
- **Semantic HTML:** Use proper heading hierarchy (h1 → h2 → h3)
- **Canvas Fallbacks:** Add `aria-label` to canvas elements

---

## Customization Guide

**Change theme colors:**

```css
:root {
  --accent: #ff6b9d;      /* Pink theme */
  --accent-2: #ff4081;
  --good: #00e676;        /* Brighter green */
}
```

**Adjust card opacity:**

```css
:root {
  --card: rgba(17, 25, 48, 0.85);  /* More opaque */
}
```

**Tighter layout:**

```css
.container {
  max-width: 1100px;     /* Narrower */
  padding: 20px;
}

.grid {
  gap: 10px;             /* Less spacing */
}
```
