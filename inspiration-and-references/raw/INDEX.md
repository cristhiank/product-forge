# Reasoning Traces — Data Mining Index

**Extracted:** 2026-03-11T20:24:32  
**Sessions scanned:** 689  
**Target models:** claude-opus-4.6, claude-opus-4.6-1m, gpt-5.4  

## Files

| File | Model | Events | Size | Description |
|------|-------|--------|------|-------------|
| `claude-opus-4.6-reasoning.jsonl` | claude-opus-4.6 | 7,668 | 10710 KB | All reasoning events (JSONL) |
| `claude-opus-4.6-reasoning-samples.md` | claude-opus-4.6 | 50 | 407 KB | Top 50 longest traces (browsable) |
| `claude-opus-4.6-1m-reasoning.jsonl` | claude-opus-4.6-1m | 3,275 | 4776 KB | All reasoning events (JSONL) |
| `claude-opus-4.6-1m-reasoning-samples.md` | claude-opus-4.6-1m | 50 | 481 KB | Top 50 longest traces (browsable) |
| `gpt-5.4-reasoning.jsonl` | gpt-5.4 | 1,534 | 2290 KB | All reasoning events (JSONL) |
| `gpt-5.4-reasoning-samples.md` | gpt-5.4 | 50 | 290 KB | Top 50 longest traces (browsable) |

## Model Statistics

| Model | Events | Sessions | Reasoning Chars | Avg Length | Max Length |
|-------|--------|----------|-----------------|------------|------------|
| claude-opus-4.6 | 7,668 | 424 | 3,029,703 | 395 | 23,663 |
| claude-opus-4.6-1m | 3,275 | 63 | 2,453,772 | 749 | 21,879 |
| gpt-5.4 | 1,534 | 16 | 1,361,533 | 887 | 10,726 |

## JSONL Schema

```json
{
  "session_id": "uuid",
  "timestamp": "ISO 8601",
  "model": "model name",
  "turn_id": "turn number",
  "user_context": "truncated user message (2000 chars max)",
  "reasoning_text": "FULL reasoning trace",
  "reasoning_chars": "int",
  "visible_content": "model's visible output (1000 chars max)",
  "tool_calls": [
    "tool names"
  ],
  "output_tokens": "int",
  "repo": "owner/repo",
  "branch": "branch name"
}
```

## Model Profiles (Analysis Output)

| File | Description |
|------|-------------|
| `MODEL_PROFILE_GPT-5.4.md` | Full personality archetype, clarity/confusion triggers, behavior patterns, influence levers |
| `MODEL_PROFILE_OPUS-4.6.md` | Full personality archetype, clarity/confusion triggers, behavior patterns, influence levers |
| `MODEL_PROFILE_OPUS-4.6-1M.md` | Full personality archetype + comparison table vs standard Opus |
| `MODEL_COMPARISON.md` | Cross-model comparison: thinking styles, influence matrix, optimal use cases |
| `MODEL_COMPARISON_GPT-5.4_VS_OPUS-FAMILY.md` | Reconciliation of the local synthesis with Windows/upstream profiles; differences, shared principles, and evidence caveats |
| `reasoning-analysis.json` | Raw quantitative analysis (pattern rates, structural stats, voice metrics) |

## Key Findings

| Signal | GPT-5.4 | Opus 4.6 | Opus 4.6-1M |
|--------|---------|----------|-------------|
| Archetype | Contemplative Analyst | Rapid Operator | Systematic Synthesizer |
| Self-correction | 2.1/10K (low) | 6.0/10K (high) | 6.4/10K (highest) |
| Uncertainty | **23.8/10K** | 2.8/10K | 3.5/10K |
| Instruction adherence | 0.8/10K | **1.4/10K** | 0.5/10K |
| Override tendency | **0.5/10K** | 0.2/10K | 0.2/10K |
| Avg reasoning before code edit | 934 chars | 54 chars | 992 chars |
| Dominant thinking mode | Analytical (46%) | Operational (47%) | Operational+Analytical |

## Mining Ideas

- **Reasoning patterns**: How does each model structure its thinking? (headers, questions, self-correction)
- **Planning depth**: Compare average reasoning length before tool calls vs direct responses
- **Self-correction frequency**: Search for patterns like 'wait', 'actually', 'let me reconsider'
- **Uncertainty signals**: 'maybe', 'I think', 'not sure', 'probably'
- **Tool usage reasoning**: How models decide which tools to call
- **Multi-step planning**: How models decompose complex tasks
