# Claude Opus Agentic Prompting — Best Practices Reference

> Consolidated from Anthropic's official docs, Building Effective Agents (Anthropic Engineering), Advanced Tool Use, Claude Opus 4.6 system prompt analysis, and community research. Last updated: 2026-03-07.

---

## 1. Core Principles for Agentic Claude Prompts

### 1.1 Be Clear and Direct — Treat Prompts as Specifications

Claude responds best to explicit, unambiguous instructions. Think of the prompt as a **formal specification**, not a conversational hint.

**Golden rule:** Show your prompt to a colleague with minimal context. If they'd be confused, Claude will be too.

- Be specific about output format, constraints, and success criteria
- Use numbered lists when order matters
- Provide context/motivation — explain *why* a behavior is important; Claude generalizes from explanations

### 1.2 Positive Framing Over Negative

Tell Claude **what to do**, not just what not to do. Combined framing (prohibition + alternative) yields the highest compliance:

```
❌ Weak:   "Do not use markdown in your response"
✅ Better: "Your response should be composed of smoothly flowing prose paragraphs."
✅ Best:   "Do not use markdown formatting. Instead, write in natural prose paragraphs."
```

For agentic constraints, combine **hard boundary + redirect**:
```
❌ "Don't edit files yourself"
✅ "Do not edit files. Instead, construct a Mission Brief and dispatch via task()."
```

### 1.3 Give Claude a Role

A single sentence focusing Claude's behavior makes a measurable difference:
```
"You are a dispatch coordinator. You classify work, construct Mission Briefs, and call task() to dispatch subagents."
```

### 1.4 Use XML Tags for Structure

Claude is specifically optimized for XML-tagged prompts. Use consistent, descriptive tags to separate concerns:

```xml
<instructions>Your behavioral rules</instructions>
<context>Relevant findings and code</context>
<examples>Concrete demonstrations of correct behavior</examples>
<constraints>Hard boundaries and forbidden actions</constraints>
```

**Best practices:**
- Consistent tag names across all prompts
- Nest tags for hierarchical content
- Separate instructions from variable data
- Put longform data at the TOP (above queries) — improves quality by up to 30%

---

## 2. Claude Opus 4.6 — Model-Specific Behaviors

### 2.1 Overtriggering on Tools and Skills

Opus 4.6 is **significantly more responsive** to system prompts than previous models. Prompts designed to reduce undertriggering now **overtrigger**.

```
❌ Old style (causes overtriggering):
   "CRITICAL: You MUST use this tool when..."
   "If in doubt, use [tool]"
   "Default to using [tool]"

✅ New style (calibrated for Opus 4.6):
   "Use this tool when..."
   "Use [tool] when it would enhance your understanding of the problem."
```

### 2.2 Excessive Subagent Spawning

Opus 4.6 has a **strong predilection for subagents** and may spawn them when a direct approach suffices. Add explicit guidance:

```
"Use subagents for tasks requiring multiple files or complex reasoning.
 For simple lookups (single file, single grep), use direct tool calls instead."
```

### 2.3 Overengineering and Scope Creep

Opus 4.6 tends to **add unnecessary abstractions, extra files, and flexibility not requested**:

```
"Keep solutions minimal and focused on the stated requirements.
 Do not add abstractions, helper utilities, or flexibility beyond what was explicitly requested.
 Prefer modifying existing files over creating new ones."
```

### 2.4 Overthinking and Excessive Exploration

At higher effort settings, Opus 4.6 does significantly more upfront exploration than needed:

```
"Replace blanket defaults with targeted instructions."
"Think proportionally — match investigation depth to task complexity."
```

### 2.5 Adaptive Thinking

Opus 4.6 uses **adaptive thinking** (decides dynamically when/how much to think). Key tips:

- Prefer **general instructions** over prescriptive step-by-step plans — Claude's reasoning often exceeds what a human would prescribe
- Use `<thinking>` tags in few-shot examples to show reasoning patterns
- Ask Claude to **self-check**: "Before you finish, verify your answer against [criteria]"

---

## 3. Agentic System Design Patterns

### 3.1 The Five Canonical Patterns (from Anthropic Engineering)

| Pattern | When to Use | Key Principle |
|---------|------------|---------------|
| **Prompt Chaining** | Task decomposes into fixed sequential subtasks | Trade latency for accuracy — each step is easier |
| **Routing** | Distinct categories need different handling | Separation of concerns — specialized prompts per category |
| **Parallelization** | Independent subtasks or need for diverse perspectives | Sectioning (parallel subtasks) or Voting (same task, multiple attempts) |
| **Orchestrator-Workers** | Complex tasks with unpredictable subtasks | Central LLM delegates dynamically to specialized workers |
| **Evaluator-Optimizer** | Clear evaluation criteria, iterative refinement adds value | Generate → Evaluate → Refine loop |

### 3.2 Keep It Simple

> "The most successful implementations weren't using complex frameworks. They were building with simple, composable patterns." — Anthropic Engineering

- Start with the **simplest solution possible**
- Only add agentic complexity when simpler solutions demonstrably fall short
- Many applications need just optimized single LLM calls with retrieval and examples

### 3.3 Agent-Computer Interface (ACI) Design

Invest as much effort in your tool interfaces as HCI designers invest in human interfaces:

- **Tool descriptions = docstrings for a junior developer** — include example usage, edge cases, format requirements
- **Minimize formatting overhead** — avoid formats requiring accurate line counts or string escaping
- **Keep formats natural** — close to what the model has seen in training data
- **Poka-yoke (error-proof)** — change arguments so mistakes are harder to make
- **Test extensively** — run many example inputs and iterate on tool definitions

---

## 4. Long-Horizon Agentic Workflows

### 4.1 State Management

- Use **structured formats** (JSON, tables) for status tracking
- Use **unstructured text** for progress notes
- Use **git** for state tracking — Claude excels at discovering state from git history
- Emphasize **incremental progress** — "Focus on completing one component at a time"

### 4.2 Multi-Context Window Workflows

1. **First context window:** Set up framework (write tests, create setup scripts)
2. **Subsequent windows:** Iterate on a todo-list
3. **Tests in structured format:** Keep in `tests.json` — "It is unacceptable to remove or edit tests"
4. **QoL scripts:** Create `init.sh` to prevent repeated setup work
5. **Fresh start > compaction:** Claude is extremely effective at discovering state from the filesystem:
   ```
   "Call pwd; you can only read and write files in this directory."
   "Review progress.txt, tests.json, and the git logs."
   "Run a fundamental integration test before implementing new features."
   ```
6. **Provide verification tools:** Playwright MCP, test runners, linters

### 4.3 Balancing Autonomy and Safety

Without guidance, Opus 4.6 may take irreversible actions (deleting files, force-pushing). Add:

```
"For potentially irreversible actions (file deletion, force push, external posts),
 confirm with the user before proceeding."
```

---

## 5. Tool Use Best Practices

### 5.1 Parallel Tool Calling

Opus 4.6 excels at parallel execution. To boost to ~100%:
```
"When multiple independent operations are needed, make ALL tool calls in a single response."
```

To reduce over-parallelism:
```
"Only parallelize when operations are truly independent. Sequential calls are fine when
 each step depends on previous results."
```

### 5.2 Explicit Action vs. Suggestion

Claude may suggest instead of act. Be explicit:
```
❌ "Can you suggest some changes?"
✅ "Make the changes directly."
✅ "When you have enough context, take action rather than suggesting."
```

### 5.3 Self-Verification

```
"Before completing, verify your work:
 1. Run the test suite
 2. Check for compilation errors
 3. Confirm all planned changes were made
 4. Review for unintended side effects"
```

---

## 6. Instruction Compliance Patterns

### 6.1 The Combined Framing Pattern

For maximum compliance, pair every prohibition with a positive redirect:

| Pattern | Compliance | Example |
|---------|-----------|---------|
| Negative only | High | "Do not generate SQL DELETE statements." |
| Positive only | Medium-High | "Use SQL SELECT statements." |
| **Combined** | **Very High** | "Do not generate DELETEs. Instead, use SELECTs or explain usage." |

### 6.2 Anti-Pattern Tables

Highly effective for agentic instruction — show the wrong way AND the right way:

```markdown
| ❌ Do Not | ✅ Do Instead |
|-----------|--------------|
| Edit files directly | Construct Mission Brief → dispatch subagent |
| Run build/test | Dispatch execute subagent |
| Skip verification | Run tests after every logical unit |
```

### 6.3 Examples as Anchors

3-5 diverse examples are one of the most reliable steering mechanisms:

```xml
<examples>
  <example>
    <input>User says "just fix it"</input>
    <correct_response>Dispatch subagent immediately</correct_response>
    <incorrect_response>Edit files directly</incorrect_response>
  </example>
</examples>
```

### 6.4 Pre-Action Checkpoints

Force the model to verify before acting:

```
"Before EVERY tool call, run this mental check:
 - Am I about to call edit? → STOP. Dispatch instead.
 - Am I about to call bash with build? → STOP. Dispatch instead."
```

---

## 7. Reducing Hallucinations in Agentic Coding

From Anthropic's latest guidance:

- Ask Claude to **quote evidence** before making claims
- Use **verification tools** (tests, linters, type checkers) after every change
- Never fabricate file paths — "If a path doesn't exist, say 'not found'"
- Encourage Claude to **admit uncertainty** rather than guess

---

## 8. Sources

1. [Anthropic Prompting Best Practices](https://platform.claude.com/docs/en/build-with-claude/prompt-engineering/claude-prompting-best-practices) — Official reference for all Claude models
2. [Building Effective Agents](https://www.anthropic.com/engineering/building-effective-agents) — Anthropic Engineering blog on agentic patterns
3. [Advanced Tool Use](https://www.anthropic.com/engineering/advanced-tool-use) — Tool Search, Programmatic Tool Calling, Tool Use Examples
4. [Claude Opus 4.6 System Prompt Analysis](https://www.pantaleone.net/blog/claude-opus-4.6-system-prompt-analysis-tuning-insights-template) — Full system prompt breakdown
5. [Introducing Claude Opus 4.6](https://www.anthropic.com/news/claude-opus-4-6) — Official announcement: 1M context, agent teams, adaptive reasoning
6. [Claude Code Best Practices](https://code.claude.com/docs/en/best-practices) — CLAUDE.md patterns, agentic coding
7. [Claude Prompt Engineering Guide (GitHub)](https://github.com/ThamJiaHe/claude-prompt-engineering-guide) — Community reference
