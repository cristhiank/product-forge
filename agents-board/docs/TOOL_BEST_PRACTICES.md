# MCP Tool Design Best Practices

These guidelines describe how to keep an MCP integration accurate, cheap, and reliable.

## Current implemented tool surface

Agent Collaboration Board intentionally exposes **two** MCP tools:

1. `task` — task lifecycle (`create`, `list`, `archive`)
2. `board` — sandboxed JavaScript execution against an injected `board` API object (`board.help()` is the canonical reference)

The design goal is to keep the LLM-facing tool surface small and stable.

## Why fewer tools wins

More tools generally reduce reliability:

- **Tool selection gets harder** as the catalog grows
- **Token overhead increases** because tool schemas consume context
- **Latency/cost increase** due to larger prompts and more round-trips

## Recommended design patterns

### 1) Prefer an operation-based tool over many small tools

If you must add a tool, prefer a single tool with an `operation` field over many narrowly-scoped tools.

### 2) Use code execution for composition

When an API has many operations, a code-execution tool enables the model to:

- chain reads and writes in one call
- filter/transform results before returning
- implement control flow (loops, guards, retries)

### 3) Keep parameters flat

Prefer:

- `filters: { tags: [...] }` (fine)
- or even `tags: [...]` (better when possible)

Avoid deeply nested shapes where the model can easily misplace fields.

### 4) Make discovery cheap

Provide a single, canonical introspection entry point:

- `board.help()` to enumerate methods, permissions, and examples

### 5) Make defaults safe

- enforce strict role-gated writes
- apply reasonable limits on list/search results
- include timeouts and resource caps for code execution

## References

- OpenAI Function/Tool calling guidance: keep tool sets small
- Anthropic MCP guidance: code execution as a gateway for large tool surfaces
