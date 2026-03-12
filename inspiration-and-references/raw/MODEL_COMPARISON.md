# Model Reasoning Comparison — GPT-5.4 vs Opus 4.6 vs Opus 4.6-1M

> Cross-model analysis from 12,477 reasoning events across 503 sessions (6.84M chars)

---

## At a Glance

| Dimension | GPT-5.4 | Opus 4.6 | Opus 4.6-1M |
|-----------|---------|----------|-------------|
| **Archetype** | Contemplative Analyst | Rapid Operator | Systematic Synthesizer |
| **Avg reasoning** | 892 chars | 395 chars | 754 chars |
| **Median reasoning** | 469 chars | 97 chars | 300 chars |
| **Dominant mode** | Analytical (46%) | Operational (47%) | Operational (49%) + Analytical (29%) |
| **Self-correction** | 2.1/10K (low) | 6.0/10K (high) | 6.4/10K (highest) |
| **Uncertainty** | 23.8/10K (very high) | 2.8/10K (low) | 3.5/10K (low) |
| **Confidence** | 2.6/10K | 5.1/10K | 3.4/10K |
| **Planning** | 8.5/10K | 26.1/10K | 21.7/10K |
| **Proactiveness** | 2.7/10K | 3.1/10K | 3.2/10K |
| **Instruction ref.** | 0.8/10K | 1.4/10K | 0.5/10K |
| **Override tendency** | 0.5/10K | 0.2/10K | 0.2/10K |
| **"I" per 10K** | 72.0 | 31.7 | 34.1 |
| **Top starter** | "It" (1190) | "Let" (2942) | "The" (2003) |
| **Chars before edit** | 934 | 54 | 992 |

---

## The Three Thinking Styles

### GPT-5.4: Think → Decide → Act
```
I'm considering whether to refresh conversation lists immediately or wait.
For effective state updates, creating a controller could manage changes...
Maybe I should also check the authorization policies related to this.
```
**Narrates** its thought process. Uses "I" heavily. Hedges with "maybe", "perhaps". Converges slowly but accurately.

### Opus 4.6: Act → Check → Correct → Act
```
Let me check the router to understand the settings.
Actually, from my knowledge of Keycloak 26, organizations are imported via realm import.
Now examining doc_ingest.py.
```
**Commands** itself to act. "Let me..." is its signature. Self-corrects mid-stream with "actually". Tight feedback loops.

### Opus 4.6-1M: Gather → Synthesize → Verify → Act
```
The issue is that consumed_at is null in the channel_link_codes table.
Now I'll systematically go through each of the 20 previous findings.
But wait, I need to check what the other workers are doing before I finalize.
```
**Declares** findings. Tracks state across large contexts. Corrects strategies (not just facts). Methodical.

---

## Influence Matrix

How each model responds to different prompt strategies:

| Strategy | GPT-5.4 | Opus 4.6 | Opus 4.6-1M |
|----------|---------|----------|-------------|
| **"Think step by step"** | ✅ Natural mode | ⚠️ Still acts fast, steps are shallow | ✅ Produces deeper steps |
| **Numbered checklists** | ✅ Likes them | ✅ Loves them (21/10K usage) | ✅ Effective |
| **"CRITICAL/MUST" language** | ➖ Doesn't change behavior much | ⚠️ Overtriggers, over-scopes | ⚠️ Gets diluted in long context |
| **Contract/schema format** | ✅ Processes well | ✅ Best format for Opus | ✅ Good but may internalize silently |
| **"Review and suggest"** | ✅ Strong — its analytical strength | ⚠️ Reviews then immediately acts | ✅ Strong — synthesizes well |
| **"Just do it"** | ❌ Still deliberates | ✅ Natural mode | ⚠️ May over-deliberate |
| **Open scope ("find issues")** | ⚠️ Uncertainty spiral | ⚠️ Exhaustive, no stopping | ⚠️ Comprehensive but slow |
| **Bounded scope** | ✅ Best results | ✅ Best results | ✅ Best results |
| **Large context (>100K)** | ⚠️ Can lose thread | ⚠️ Processes linearly | ✅ Purpose-built for this |

---

## Proactiveness: Different Flavors

All three models show similar proactiveness *rates* (~3/10K) but express it differently:

| Model | Proactiveness Style | Example |
|-------|-------------------|---------|
| **GPT-5.4** | Notices & suggests | "I should also check the authorization policies related to this" |
| **Opus 4.6** | Expands & executes | "Let me also check the hub for context" → (immediately checks) |
| **Opus 4.6-1M** | Gathers & connects | "Let me also get the rest of the homepage content... and check if there's additional content" |

**To channel proactiveness:**
- GPT-5.4: Give it explicit permission to act on suggestions ("fix anything you find")
- Opus 4.6: Give it explicit *bounds* ("check at most 5 related files")
- Opus 4.6-1M: Give it *priority signals* ("focus on P0 issues only")

---

## Instruction Adherence vs. Autonomy Spectrum

```
← Adheres Strictly                              Operates Autonomously →
    Opus 4.6 (1.4/10K)   GPT-5.4 (0.8/10K)   Opus 4.6-1M (0.5/10K)
    Cites rules            Internalizes rules    Rules dissolve into context
    Low override (0.2)     Higher override (0.5)  Low override (0.2)
    Follows letter          Follows spirit         Follows implicitly
```

**The paradox:** Opus 4.6 cites rules the most but overrides the least — it's a rule-follower. GPT-5.4 cites rules the least *of the explicit citers* but overrides the most — it's a pragmatist. Opus 4.6-1M barely mentions rules at all — it's autonomous.

### Implications for prompt design:
- **Opus 4.6**: State rules clearly and it will follow them. Use "MUST/PREFER/MAY" tiers.
- **GPT-5.4**: State rules as positive constraints with escape hatches. It will pragmatically adapt.
- **Opus 4.6-1M**: Repeat rules throughout the context. Require deviation logging. Verify through output structure, not reasoning traces.

---

## Optimal Use Cases

| Use Case | Best Model | Why |
|----------|-----------|-----|
| Code review / bug hunting | GPT-5.4 | Deep analytical reasoning, catches subtle issues |
| Rapid multi-file execution | Opus 4.6 | Fast action loops, high throughput |
| Architecture synthesis | Opus 4.6-1M | Cross-file connections, systematic coverage |
| Contract-driven tasks | Opus 4.6 | Best at following structured specs |
| Creative/design exploration | GPT-5.4 | Deliberates options before converging |
| Regression/audit | Opus 4.6-1M | Natural regression-tracking mode |
| Sub-agent coordination | Opus 4.6-1M | Better task decomposition, less over-spawning |
| Quick fixes (<5 files) | Opus 4.6 | Minimal deliberation overhead |
| Multi-model council chairman | Opus 4.6-1M | Best synthesis of diverse inputs |

---

## Key Takeaway

The three models represent a spectrum from **deliberation** to **execution**:

- **GPT-5.4** thinks deeply before acting — use it when accuracy of *reasoning* matters more than speed
- **Opus 4.6** acts rapidly and self-corrects — use it when speed and throughput matter, especially with good test coverage
- **Opus 4.6-1M** synthesizes broadly then acts carefully — use it when the problem requires connecting information across a large surface area

None is universally better. The art is matching the model's natural reasoning rhythm to the task at hand.
