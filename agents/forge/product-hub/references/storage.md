# Product-Hub Storage Reference

API documentation for the product-hub library. Used by `forge-product` mode subagents.

## CLI Usage

```bash
PHUB="node <skill-dir>/scripts/index.js"
```

All commands output JSON (except `feature bridge` which outputs markdown).

---

## Commands

### Repository Management

```bash
# Initialize .product/ in project root
$PHUB init "KanIA" "mvp" "AI front desk for pet boarding" "monthly_active_facilities"

# Show product metadata
$PHUB meta

# Validate all documents (check required fields)
$PHUB validate

# Health report (stale docs, orphaned features, missing fields)
$PHUB health
```

### Document Operations

```bash
# Read a document (returns JSON with frontmatter + content)
$PHUB read vision/VISION.md

# List all documents
$PHUB list

# List by type: vision | customer | brand | feature | strategy | experiment | playbook
$PHUB list --type feature

# Search across all documents (full-text)
$PHUB search "pricing"

# Version bump
$PHUB bump vision/VISION.md minor   # major | minor | patch
```

### Feature Management

```bash
# Create a feature (starts in 'discovery' status)
$PHUB feature create F-001 "WhatsApp Bot" "AI-powered WhatsApp responses"

# List features (optionally filter by lifecycle status)
$PHUB feature list
$PHUB feature list --status discovery

# Transition feature lifecycle
$PHUB feature transition F-001 defined
# Valid transitions: discovery→defined, defined→validated, validated→planned,
#   planned→building, building→shipped, shipped→measuring
# Backward: defined→discovery, validated→defined, building→planned

# Link feature to backlog epic
$PHUB feature link F-001 B-002

# Generate backlog epic template from feature spec
$PHUB feature bridge F-001

# Lifecycle overview (all features grouped by status)
$PHUB feature overview
```

### Experiment Tracking

```bash
# Create experiment linked to feature
$PHUB experiment create X-001 "Social proof increases conversion 20%" F-001
```

### Programmatic SDK (exec mode)

```bash
# Execute arbitrary JS with sdk object
$PHUB exec "
  const features = sdk.repo.featureList();
  const overview = sdk.overview();
  json({ features: features.length, overview });
"
```

**SDK object:**
- `sdk.repo` — ProductRepository instance (all CRUD methods)
- `sdk.transition(featureId, status)` — transition feature lifecycle
- `sdk.linkEpic(featureId, epicId)` — link feature to backlog epic
- `sdk.overview()` — lifecycle overview grouped by status

---

## Document Schemas

### Frontmatter (all documents)

```yaml
---
type: vision | customer | brand | feature | strategy | experiment | playbook
version: "1.0.0"
status: draft | active | validated | archived
created: "2026-01-01"
updated: "2026-03-01"      # auto-set on write
updated_by: forge-product   # auto-set on write
tags: [pricing, mvp]
---
```

### Feature-specific fields

```yaml
---
type: feature
feature_status: discovery | defined | validated | planned | building | shipped | measuring
epic_id: B-002          # linked backlog epic (optional until planned)
---
```

### Experiment-specific fields

```yaml
---
type: experiment
hypothesis: "Adding social proof increases conversion by 20%"
feature_id: F-001       # linked feature (optional)
result: confirmed | rejected | inconclusive  # set after experiment
---
```

### Product metadata (_meta.yaml)

```yaml
name: KanIA
stage: idea | mvp | growth | scale
version: "0.1.0"
description: "AI front desk for Colombian pet boarding businesses"
north_star: monthly_active_boarding_facilities
created: "2026-01-01"
```

---

## .product/ Directory Structure

```
.product/
├── _meta.yaml          # Product identity + stage
├── vision/             # Mission, positioning
├── customers/          # ICP, JTBD, segments, interviews
├── brand/              # Guidelines, design tokens, glossary
├── features/           # Feature specs with lifecycle (F-XXX.md)
├── strategy/           # GTM, pricing, competitive analysis
├── experiments/        # Validation experiments (X-XXX.md)
└── playbooks/          # Launch, release playbooks
```

---

## Feature Lifecycle

```
DISCOVERY → DEFINED → VALIDATED → PLANNED → BUILDING → SHIPPED → MEASURING
```

### Auto-bridge triggers

| Status reached | Prompt |
|---------------|--------|
| validated | "Create backlog epic from F-XXX?" |
| planned (no epic_id) | "Feature F-XXX planned but no epic. Create one?" |
| shipped | "Create experiment to measure F-XXX impact?" |
