# Chart.js API Reference

Complete Chart.js v4 patterns for financial dashboards with dark theme, zoom/pan, and custom tooltips.

---

## CDN Dependencies

Include these scripts in `<head>` or before closing `</body>`:

```html
<!-- Chart.js v4 (core library) -->
<script src="https://cdn.jsdelivr.net/npm/chart.js@4"></script>

<!-- Hammer.js (required for touch gestures in zoom plugin) -->
<script src="https://cdn.jsdelivr.net/npm/hammerjs@2"></script>

<!-- Chart.js Zoom Plugin (for wheel/pinch zoom and pan) -->
<script src="https://cdn.jsdelivr.net/npm/chartjs-plugin-zoom@2"></script>
```

**Load order matters:** Chart.js → Hammer.js → chartjs-plugin-zoom

---

## Global Dark Theme Configuration

Set these defaults ONCE at the start of your script, before creating any charts:

```javascript
// Dark theme defaults for all charts
Chart.defaults.color = '#9fb0cb';  // Default text color (--muted)
Chart.defaults.borderColor = 'rgba(148,163,184,0.22)';  // Grid lines (--line)
Chart.defaults.font.family = 'Inter, Segoe UI, Roboto, Arial, sans-serif';

// Tooltip styling
Chart.defaults.plugins.tooltip.backgroundColor = 'rgba(15,23,42,0.95)';
Chart.defaults.plugins.tooltip.titleColor = '#e6edf8';
Chart.defaults.plugins.tooltip.bodyColor = '#c7d3ea';
Chart.defaults.plugins.tooltip.borderColor = 'rgba(148,163,184,0.3)';
Chart.defaults.plugins.tooltip.borderWidth = 1;
Chart.defaults.plugins.tooltip.cornerRadius = 12;
Chart.defaults.plugins.tooltip.padding = 10;

// Legend styling
Chart.defaults.plugins.legend.labels.usePointStyle = true;
Chart.defaults.plugins.legend.labels.pointStyleWidth = 10;

// Line and bar styling
Chart.defaults.elements.line.tension = 0.4;  // Smooth curves
Chart.defaults.elements.bar.borderRadius = 8;  // Rounded bar corners

// Responsive behavior
Chart.defaults.responsive = true;
Chart.defaults.maintainAspectRatio = false;  // Fill container height
```

---

## Color Palette

Use consistent colors across all charts:

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

**Usage:**
- Single dataset: Use `COLORS[0]`
- Multiple datasets: Use `COLORS[i % COLORS.length]`
- Add transparency: Append `'AA'` (67%) or `'55'` (33%) — e.g., `COLORS[0] + 'AA'`

---

## Utility Functions

### money(value)

Format number as USD currency:

```javascript
const moneyFmt = new Intl.NumberFormat('en-US', { 
  style: 'currency', 
  currency: 'USD', 
  maximumFractionDigits: 2 
});

const money = (v) => moneyFmt.format(v || 0);
```

**Example:** `money(1234.56)` → `"$1,234.56"`

### pct(value, decimals)

Format decimal as percentage:

```javascript
const pct = (v, d = 1) => `${(v * 100).toFixed(d)}%`;
```

**Example:** `pct(0.1234, 1)` → `"12.3%"`

---

## Chart Type Patterns

### 1. Line Chart (Trends)

**Use for:** Time-series data, expense trends, income over time

```javascript
const ctx = document.getElementById('chart-id').getContext('2d');

new Chart(ctx, {
  type: 'line',
  data: {
    labels: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun'],
    datasets: [{
      label: 'Monthly Expenses',
      data: [4500, 5200, 4800, 5100, 5500, 4900],
      borderColor: '#38bdf8',
      backgroundColor: 'rgba(56,189,248,0.15)',  // Gradient fill under line
      fill: true,
      pointBackgroundColor: '#38bdf8',
      pointRadius: 4,
      pointHoverRadius: 7,
      pointBorderColor: '#fff',
      pointBorderWidth: 2
    }]
  },
  options: {
    plugins: {
      legend: { display: true, position: 'top' },
      tooltip: {
        callbacks: {
          label: (ctx) => `${ctx.dataset.label}: ${money(ctx.raw)}`
        }
      },
      zoom: {
        zoom: {
          wheel: { enabled: true },
          pinch: { enabled: true },
          mode: 'x'
        },
        pan: {
          enabled: true,
          mode: 'x'
        }
      }
    },
    scales: {
      y: {
        beginAtZero: true,
        ticks: {
          callback: (value) => money(value)
        }
      }
    }
  }
});
```

**Key features:**
- Gradient fill (`fill: true`, `backgroundColor` with transparency)
- Zoom/pan on X-axis (requires zoom plugin)
- Money-formatted Y-axis ticks
- Custom tooltip with money formatting

---

### 2. Bar Chart (Comparison)

**Use for:** Category comparison, weekly spending, budget vs actual

#### Vertical Bars

```javascript
new Chart(ctx, {
  type: 'bar',
  data: {
    labels: ['Week 1', 'Week 2', 'Week 3', 'Week 4'],
    datasets: [{
      label: 'Weekly Spending',
      data: [1200, 980, 1450, 1100],
      backgroundColor: COLORS.map(c => c + 'CC'),  // 80% opacity
      borderColor: COLORS,
      borderWidth: 1
    }]
  },
  options: {
    plugins: {
      legend: { display: false },
      tooltip: {
        callbacks: {
          label: (ctx) => money(ctx.raw)
        }
      }
    },
    scales: {
      y: {
        beginAtZero: true,
        ticks: { callback: (v) => money(v) }
      }
    }
  }
});
```

#### Horizontal Bars

```javascript
new Chart(ctx, {
  type: 'bar',
  data: {
    labels: ['Groceries', 'Dining', 'Transport', 'Entertainment', 'Shopping'],
    datasets: [{
      label: 'Category Spend',
      data: [850, 620, 440, 380, 290],
      backgroundColor: COLORS.slice(0, 5).map(c => c + 'AA'),
      borderColor: COLORS.slice(0, 5),
      borderWidth: 1
    }]
  },
  options: {
    indexAxis: 'y',  // This makes bars horizontal
    plugins: {
      legend: { display: false },
      tooltip: {
        callbacks: {
          label: (ctx) => `${ctx.label}: ${money(ctx.raw)}`
        }
      }
    },
    scales: {
      x: {
        beginAtZero: true,
        ticks: { callback: (v) => money(v) }
      }
    }
  }
});
```

---

### 3. Doughnut Chart (Composition)

**Use for:** Budget breakdown, category distribution, allocation mix

```javascript
new Chart(ctx, {
  type: 'doughnut',
  data: {
    labels: ['Needs', 'Wants', 'Savings', 'Debt'],
    datasets: [{
      data: [5991, 831.5, 1148.68, 2914.82],
      backgroundColor: [COLORS[0], COLORS[1], COLORS[2], COLORS[3]],
      borderColor: 'rgba(15,23,42,0.9)',  // Dark border between segments
      borderWidth: 2,
      hoverOffset: 8  // Segments pop out on hover
    }]
  },
  options: {
    cutout: '62%',  // Size of center hole (larger = thinner ring)
    plugins: {
      legend: { 
        position: 'right',
        labels: { padding: 14 }
      },
      tooltip: {
        callbacks: {
          label: (ctx) => {
            const total = ctx.dataset.data.reduce((a, b) => a + b, 0);
            const percentage = pct(ctx.raw / total, 1);
            return `${ctx.label}: ${money(ctx.raw)} (${percentage})`;
          }
        }
      }
    }
  }
});
```

**Key features:**
- `cutout: '62%'` creates doughnut hole
- Tooltip shows amount AND percentage
- Legend on right side

---

### 4. Grouped Bar Chart (Budget vs Actual)

**Use for:** Comparing two values side-by-side (budget vs actual, current vs prior)

```javascript
new Chart(ctx, {
  type: 'bar',
  data: {
    labels: ['Needs', 'Wants', 'Savings', 'Debt'],
    datasets: [
      {
        label: 'Budget',
        data: [5991, 831.5, 1148.68, 2914.82],
        backgroundColor: '#38bdf8AA',
        borderColor: '#38bdf8',
        borderWidth: 1
      },
      {
        label: 'Actual',
        data: [6200, 950, 800, 2900],
        backgroundColor: '#f472b6AA',
        borderColor: '#f472b6',
        borderWidth: 1
      }
    ]
  },
  options: {
    plugins: {
      tooltip: { 
        mode: 'index',  // Show all datasets for a label
        callbacks: {
          label: (ctx) => `${ctx.dataset.label}: ${money(ctx.raw)}`
        }
      }
    },
    scales: {
      x: { stacked: false },  // Side-by-side, NOT stacked
      y: { 
        stacked: false,
        beginAtZero: true,
        ticks: { callback: (v) => money(v) }
      }
    }
  }
});
```

---

### 5. Stacked Bar Chart

**Use for:** Showing composition over multiple categories

```javascript
new Chart(ctx, {
  type: 'bar',
  data: {
    labels: ['Jan', 'Feb', 'Mar', 'Apr'],
    datasets: [
      {
        label: 'Needs',
        data: [3000, 3200, 2900, 3100],
        backgroundColor: COLORS[0] + 'BB'
      },
      {
        label: 'Wants',
        data: [800, 900, 750, 850],
        backgroundColor: COLORS[1] + 'BB'
      },
      {
        label: 'Savings',
        data: [500, 600, 550, 575],
        backgroundColor: COLORS[2] + 'BB'
      }
    ]
  },
  options: {
    plugins: {
      tooltip: { mode: 'index' }
    },
    scales: {
      x: { stacked: true },  // Enable stacking
      y: { 
        stacked: true,
        ticks: { callback: (v) => money(v) }
      }
    }
  }
});
```

---

### 6. Stacked Area Chart (Debt Payoff Waterfall)

**Use for:** Cumulative trend over time (debt balances declining)

```javascript
new Chart(ctx, {
  type: 'line',
  data: {
    labels: ['Jan 26', 'Jul 26', 'Jan 27', 'Jul 27', 'Jan 28', 'Jul 28'],
    datasets: [
      {
        label: 'Credit Card',
        data: [9650, 8500, 7200, 5800, 4200, 2400],
        fill: 'origin',  // Fill to X-axis
        backgroundColor: COLORS[0] + '55',
        borderColor: COLORS[0],
        borderWidth: 2,
        pointRadius: 0  // Hide points for cleaner look
      },
      {
        label: 'Mortgage',
        data: [78378, 73000, 67500, 61800, 55900, 49700],
        fill: '-1',  // Fill to previous dataset
        backgroundColor: COLORS[1] + '55',
        borderColor: COLORS[1],
        borderWidth: 2,
        pointRadius: 0
      },
      {
        label: 'Auto Loan',
        data: [45515, 42000, 38400, 34700, 30900, 27000],
        fill: '-1',
        backgroundColor: COLORS[2] + '55',
        borderColor: COLORS[2],
        borderWidth: 2,
        pointRadius: 0
      }
    ]
  },
  options: {
    plugins: {
      tooltip: { 
        mode: 'index',
        callbacks: {
          label: (ctx) => `${ctx.dataset.label}: ${money(ctx.raw)}`
        }
      }
    },
    scales: {
      y: {
        stacked: true,  // Stack the fills
        ticks: { callback: (v) => money(v) }
      }
    },
    interaction: {
      mode: 'nearest',
      axis: 'x',
      intersect: false
    }
  }
});
```

**Key features:**
- `fill: 'origin'` for first dataset (fills to X-axis)
- `fill: '-1'` for subsequent datasets (fills to previous dataset)
- `stacked: true` on Y-axis
- `pointRadius: 0` for cleaner area charts

---

## Advanced Features

### Custom Tooltip Formatting

Show multiple values, percentages, deltas:

```javascript
tooltip: {
  callbacks: {
    title: (items) => `Week of ${items[0].label}`,
    label: (ctx) => {
      const value = ctx.raw;
      const budget = 1500;  // Example budget value
      const delta = value - budget;
      const deltaStr = delta > 0 ? `+${money(delta)}` : money(delta);
      return [
        `Spent: ${money(value)}`,
        `Budget: ${money(budget)}`,
        `Variance: ${deltaStr}`
      ];
    }
  }
}
```

### Multi-Line Tooltips

Return an array of strings:

```javascript
label: (ctx) => [
  `Budget: ${money(ctx.raw)}`,
  `Actual: ${money(actualValue)}`,
  `Remaining: ${money(ctx.raw - actualValue)}`
]
```

### Conditional Colors

Change bar colors based on values:

```javascript
backgroundColor: data.map(value => value > 1000 ? '#ef4444' : '#22c55e')
```

### Zoom/Pan Configuration

Full zoom plugin options:

```javascript
plugins: {
  zoom: {
    zoom: {
      wheel: {
        enabled: true,
        speed: 0.1
      },
      pinch: {
        enabled: true
      },
      mode: 'x'  // Only zoom X-axis ('y', 'xy' also available)
    },
    pan: {
      enabled: true,
      mode: 'x',
      threshold: 10
    },
    limits: {
      x: { min: 'original', max: 'original' }  // Can't pan beyond data
    }
  }
}
```

**Reset zoom programmatically:**

```javascript
const chart = new Chart(ctx, config);
chart.resetZoom();  // Reset to original view
```

---

## Responsive Behavior

Charts automatically resize to fill their container. Ensure proper container sizing:

### HTML Structure

```html
<div class="chart-wrap">
  <canvas id="my-chart" aria-label="Monthly expense trend chart"></canvas>
</div>
```

### CSS

```css
.chart-wrap {
  position: relative;
  height: 280px;  /* Set explicit height */
  width: 100%;
}

canvas {
  max-width: 100%;
  height: 100% !important;  /* Override Chart.js inline styles */
}
```

**Key points:**
- Container MUST have explicit height
- Canvas fills container width/height
- `maintainAspectRatio: false` in Chart.defaults allows flexible heights

---

## Accessibility

Always add `aria-label` to canvas elements:

```html
<canvas 
  id="expense-chart" 
  aria-label="Bar chart showing monthly expenses from January to June 2026"
></canvas>
```

Chart.js automatically generates accessible data tables for screen readers when `aria-label` is present.

---

## Animation Customization

### Disable Animation

```javascript
options: {
  animation: false
}
```

### Custom Animation Duration

```javascript
options: {
  animation: {
    duration: 1500  // milliseconds
  }
}
```

### Staggered Bar Animation

```javascript
options: {
  animation: {
    delay: (context) => context.dataIndex * 100  // Each bar delayed by 100ms
  }
}
```

---

## Chart Destruction & Updates

### Update Chart Data

```javascript
const myChart = new Chart(ctx, config);

// Later, update data
myChart.data.datasets[0].data = [new, data, values];
myChart.update();  // Re-render
```

### Destroy Chart

Before creating a new chart on the same canvas:

```javascript
if (myChart) {
  myChart.destroy();
}
myChart = new Chart(ctx, newConfig);
```

---

## Common Patterns

### createChart() Helper

Reduce boilerplate with a helper function:

```javascript
function createChart(canvasId, type, data, options = {}) {
  const ctx = document.getElementById(canvasId).getContext('2d');
  return new Chart(ctx, {
    type,
    data,
    options: {
      ...options,
      plugins: {
        tooltip: {
          callbacks: {
            label: (ctx) => money(ctx.raw),
            ...(options.plugins?.tooltip?.callbacks || {})
          }
        },
        ...(options.plugins || {})
      }
    }
  });
}

// Usage
createChart('my-chart', 'bar', {
  labels: ['A', 'B', 'C'],
  datasets: [{ data: [100, 200, 150] }]
});
```

### Dynamic Color Assignment

```javascript
function getDatasetColors(count) {
  return Array.from({ length: count }, (_, i) => COLORS[i % COLORS.length]);
}

// Usage
datasets: [{
  data: values,
  backgroundColor: getDatasetColors(values.length).map(c => c + 'AA')
}]
```

---

## Troubleshooting

| Issue | Solution |
|-------|----------|
| Chart not rendering | Check container has explicit height, canvas ID is correct |
| Zoom not working | Verify Hammer.js loads before chartjs-plugin-zoom |
| Tooltips not showing money | Add `callbacks: { label: (ctx) => money(ctx.raw) }` |
| Chart blurry on retina | Chart.js handles DPR automatically; check CSS zoom/scaling |
| Legend overlaps chart | Reduce legend padding or move to different position |
| Bars too thin | Reduce number of data points or increase chart width |

---

## References

- **Chart.js Docs:** https://www.chartjs.org/docs/latest/
- **Zoom Plugin:** https://www.chartjs.org/chartjs-plugin-zoom/latest/
- **Color Palette:** Based on Tailwind CSS color system
- **Design System:** See `references/design-system.md`
- **Report Types:** See `references/report-types.md`
