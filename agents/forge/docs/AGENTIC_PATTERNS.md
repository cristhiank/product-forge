# Building Effective Agents — Anthropic Patterns Reference

> Extracted from Anthropic's "Building Effective Agents" engineering blog and "Advanced Tool Use" documentation. These are the canonical agentic architecture patterns recommended by the Claude creators.

---

## Core Philosophy

> "The most successful implementations weren't using complex frameworks or specialized libraries. Instead, they were building with simple, composable patterns."

**Three core principles:**
1. Maintain **simplicity** in your agent's design
2. Prioritize **transparency** by explicitly showing the agent's planning steps
3. Carefully craft your agent-computer interface (ACI) through thorough tool **documentation and testing**

**When NOT to use agents:** Start with the simplest solution. Many applications need just optimized single LLM calls with retrieval and examples. Only increase complexity when it demonstrably improves outcomes.

---

## The Five Agentic Patterns

### Pattern 1: Prompt Chaining

```
[LLM Call 1] → gate → [LLM Call 2] → gate → [LLM Call 3] → output
```

**What:** Decompose task into fixed sequential steps. Each LLM call processes the output of the previous one. Programmatic gates between steps check quality.

**When:** Task can be cleanly decomposed into fixed subtasks. Trade latency for accuracy — each call is an easier task.

**Examples:**
- Generate marketing copy → translate to another language
- Write outline → check outline meets criteria → write document from outline

**Forge mapping:** EXPLORE → IDEATE → DESIGN → PLAN → EXECUTE — this is prompt chaining with human gates.

---

### Pattern 2: Routing

```
         ┌→ [Specialized Handler A]
[Classify] → [Specialized Handler B]
         └→ [Specialized Handler C]
```

**What:** Classify input, direct to specialized followup task. Separation of concerns — each handler has an optimized prompt.

**When:** Distinct categories that are better handled separately. Classification must be accurate.

**Examples:**
- Customer service: general questions vs refund requests vs technical support → different processes
- Route easy questions to Haiku (cheap/fast), hard questions to Opus (capable)

**Forge mapping:** Intent Classification tree routes to EXPLORE, IDEATE, DESIGN, PLAN, EXECUTE, VERIFY, PRODUCT, MEMORY based on classification.

---

### Pattern 3: Parallelization

```
Sectioning:                    Voting:
         ┌→ [Subtask A] ─┐            ┌→ [Attempt 1] ─┐
[Input] ─┼→ [Subtask B] ─┼→ [Merge]   [Input] ─┼→ [Attempt 2] ─┼→ [Aggregate]
         └→ [Subtask C] ─┘            └→ [Attempt 3] ─┘
```

**What:** Work simultaneously on a task, aggregate outputs programmatically.

**Two variations:**
- **Sectioning:** Break into independent subtasks run in parallel
- **Voting:** Same task multiple times for diverse outputs

**When:** Subtasks can be parallelized for speed, or multiple perspectives improve confidence.

**Examples:**
- Sectioning: Guardrails (one model handles query, another screens content)
- Voting: Code vulnerability review with multiple prompts

**Forge mapping:** Experts Council (3-model voting), parallel workers via copilot-cli-skill (sectioning).

---

### Pattern 4: Orchestrator-Workers

```
[Orchestrator LLM]
    ├→ [Worker 1] ─┐
    ├→ [Worker 2] ─┼→ [Orchestrator synthesizes]
    └→ [Worker N] ─┘
```

**What:** Central LLM dynamically breaks down tasks, delegates to worker LLMs, synthesizes results. Subtasks are NOT pre-defined — determined by orchestrator based on input.

**When:** Complex tasks where you can't predict required subtasks. Key difference from parallelization: flexibility.

**Examples:**
- Coding products that make complex changes to multiple files
- Search tasks gathering info from multiple sources

**Forge mapping:** This IS the Forge coordinator pattern. Forge = orchestrator, subagents = workers.

---

### Pattern 5: Evaluator-Optimizer

```
[Generator LLM] → [Evaluator LLM] → feedback → [Generator LLM] → ...
```

**What:** One LLM generates, another evaluates and provides feedback, in a loop.

**When:** Clear evaluation criteria exist, and iterative refinement provides measurable value.

**Examples:**
- Literary translation with nuanced critique
- Complex search requiring multiple rounds of analysis

**Forge mapping:** EXECUTE → VERIFY loop. VERIFY provides structured critique, EXECUTE revises.

---

## Agent-Computer Interface (ACI) Design

> "Think about how much effort goes into human-computer interfaces (HCI), and plan to invest just as much effort in creating good agent-computer interfaces (ACI)."

### Tool Definition Quality

- **Put yourself in the model's shoes** — is it obvious how to use this tool from the description?
- **Write great docstrings** — include example usage, edge cases, input format requirements, boundaries from other tools
- **Name parameters clearly** — especially when using many similar tools
- **Test extensively** — run many example inputs, observe mistakes, iterate
- **Poka-yoke (error-proof)** — change arguments so mistakes are harder to make

### Tool Format Selection

- Give the model enough tokens to "think" before writing itself into a corner
- Keep format close to what the model has seen naturally in training data
- No formatting overhead (accurate line counts, string escaping)

### Three Advanced Tool Features

1. **Tool Search Tool** — discover tools on-demand instead of loading all upfront. 85% reduction in token usage. Use when: >10 tools, tool definitions >10K tokens.

2. **Programmatic Tool Calling** — Claude writes orchestration code instead of individual tool calls. Intermediate results processed in code, only final output enters context. 37% token reduction on complex tasks.

3. **Tool Use Examples** — concrete usage patterns alongside JSON schemas. Improved accuracy from 72% to 90% on complex parameter handling.

---

## Agent Loop Best Practices

```
while task_not_complete:
    1. Gather context (tools, environment)
    2. Take action (tool calls, code generation)
    3. Verify results (test, check, compare)
    4. Assess progress (are we closer to goal?)
    5. Adjust strategy if needed
```

**Ground truth is essential:** At each step, agents need environmental feedback (tool results, test output, code execution) to assess progress. Don't rely on the model's self-assessment alone.

**Human checkpoints:** Pause for human feedback at key decision points or when encountering blockers.

**Stopping conditions:** Include maximum iterations to maintain control. Don't let agents run unbounded.

---

## Production Readiness Checklist

- [ ] Extensive testing in sandboxed environments
- [ ] Appropriate guardrails for irreversible actions
- [ ] Clear success criteria measurable without human judgment
- [ ] Feedback loops (test results, tool outputs) for self-correction
- [ ] Maximum iteration limits
- [ ] Human escalation paths for blockers
- [ ] Cost monitoring (agentic systems trade cost for performance)
