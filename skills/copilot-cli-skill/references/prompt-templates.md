# Prompt Templates for Copilot CLI Workers

This document provides prompt templates for common worker scenarios. These templates can be used with `$WORKER exec` or passed directly as prompts to spawned workers.

---

## Template: Standard Feature Implementation

**Use when:** Implementing a well-defined feature from a backlog item or plan.

```
Implement [feature name] per [reference].

Requirements:
- [Requirement 1]
- [Requirement 2]
- [Requirement 3]

Context:
- Files: [relevant file paths]
- Dependencies: [relevant dependencies or patterns]

Success criteria:
- [Criterion 1]
- [Criterion 2]
- All tests pass
```

**Example:**

```
Implement magic link authentication per plan.md.

Requirements:
- Generate secure token with crypto.randomBytes
- Send token via email (SendGrid)
- Validate token on GET /auth/magic-link/:token
- Expire tokens after 15 minutes

Context:
- Files: src/auth/, src/routes/auth.ts, tests/auth/
- Dependencies: Existing JWT pattern in src/auth/jwt.ts

Success criteria:
- Token generation is cryptographically secure
- Email delivery integrates with existing SendGrid setup
- Token validation includes expiration check
- All tests pass (npm test)
```

---

## Template: Bug Fix

**Use when:** Fixing a specific bug with known reproduction steps.

```
Fix: [Brief description of the bug]

Reproduction:
1. [Step 1]
2. [Step 2]
3. [Expected vs Actual behavior]

Root cause: [If known, describe; otherwise: "Unknown - investigate"]

Constraints:
- Preserve existing behavior for [related features]
- Add regression test
- No breaking changes
```

**Example:**

```
Fix: User session expires immediately after login

Reproduction:
1. User logs in with valid credentials
2. Navigate to /dashboard
3. Expected: Dashboard loads. Actual: Redirected to login page

Root cause: Unknown - investigate session storage and JWT expiration

Constraints:
- Preserve existing session duration (24 hours)
- Add regression test in tests/auth/session.test.ts
- No breaking changes to existing auth flow
```

---

## Template: Documentation

**Use when:** Creating or updating documentation.

```
[Create|Update] documentation for [topic].

Scope:
- [What to document]
- [Target audience: developers, end-users, etc.]
- [Format: README, API docs, tutorial, etc.]

Include:
- Overview / purpose
- [Relevant sections: installation, usage, examples, etc.]
- Code examples (if applicable)
- Links to related documentation

Style: [Concise, detailed, beginner-friendly, etc.]
```

**Example:**

```
Create documentation for the worker management system.

Scope:
- Document the worker management SDK API (spawnWorker, awaitWorker, validateWorker, sendMessage)
- Target audience: developers using the skill
- Format: README.md

Include:
- Overview of worker management concept
- Installation / setup
- Usage examples for each script
- Common workflows (spawn, monitor, cleanup)
- Troubleshooting section
- Links to references/ docs

Style: Concise with practical examples
```

---

## Template: Refactoring

**Use when:** Improving code structure without changing behavior.

```
Refactor: [Component or module to refactor]

Goal: [What improvement are you seeking?]
- [e.g., Improve readability]
- [e.g., Reduce duplication]
- [e.g., Improve testability]

Scope:
- Files: [specific files or directories]
- Preserve: [existing behavior, API contracts, etc.]

Constraints:
- All existing tests must pass
- No breaking changes to public APIs
- [Any other constraints]
```

**Example:**

```
Refactor: Authentication middleware

Goal: Improve testability and reduce duplication
- Extract JWT validation logic into separate function
- Mock external dependencies (database, Redis)
- Consolidate error handling

Scope:
- Files: src/middleware/auth.ts, tests/middleware/auth.test.ts
- Preserve: Existing authentication behavior and API

Constraints:
- All existing tests must pass
- No breaking changes to route handlers
- Maintain backward compatibility with existing JWT tokens
```

---

## Template: Custom Agent Task

**Use when:** You need to invoke a specific agent (Scout, Planner, etc.) with a targeted task.

```
[Agent name] task: [Brief description]

Objective: [What should the agent accomplish?]

Context:
- [Relevant background]
- [Files or areas to focus on]

Deliverable: [What output do you expect?]
- [e.g., List of patterns found]
- [e.g., Execution plan with dependencies]
- [e.g., Code snippets cached]
```

**Example (Scout):**

```
Scout task: Explore authentication patterns in the codebase

Objective: Identify all authentication mechanisms currently in use

Context:
- Focus on src/auth/, src/middleware/, src/routes/
- Look for JWT, session, OAuth patterns
- Note any third-party libraries used

Deliverable: Summary report with:
- List of authentication patterns found (with file references)
- Key functions and their signatures
- Dependencies and configuration
- Cached snippets for relevant code sections
```

**Example (Planner):**

```
Planner task: Create execution plan for rate limiting feature

Objective: Detailed step-by-step plan for implementing rate limiting

Context:
- Target: API endpoints in src/routes/
- Use Redis for rate limit storage
- Follow existing middleware pattern

Deliverable: Execution plan with:
- Atomic steps with DONE WHEN criteria
- Dependencies between steps
- Risk assessment for each step
- Estimated effort (file count, complexity)
```

---

## Template: Exploratory Research

**Use when:** You need the worker to research a topic before implementation.

```
Research: [Topic]

Questions to answer:
- [Question 1]
- [Question 2]
- [Question 3]

Sources to check:
- Codebase: [specific areas]
- External: [official docs, best practices, etc.]

Output format: [Summary, comparison table, recommendations, etc.]
```

**Example:**

```
Research: Best practices for implementing magic link authentication

Questions to answer:
- What token generation methods are most secure?
- How long should tokens remain valid?
- Should tokens be single-use or multi-use?
- What are common attack vectors and mitigations?

Sources to check:
- Codebase: existing auth patterns in src/auth/
- External: OWASP guidelines, Auth0 documentation, industry standards

Output format: Summary with:
- Recommended approach with rationale
- Security considerations
- Implementation checklist
- Code examples or patterns
```

---

## Template Variables

When using these templates, replace placeholders:

- `[feature name]` — Specific feature being implemented
- `[reference]` — plan.md, backlog item, spec document, etc.
- `[file paths]` — Relevant files or directories
- `[Agent name]` — Scout, Planner, Executor, Creative, Verifier
- `[topic]` — Subject of documentation or research
- `[component]` — Module or file being refactored

---

## Advanced: Combining Templates

For complex workflows, combine templates:

```
# Phase 1: Research
Research: Rate limiting strategies for Express.js apps
[... research template content ...]

# Phase 2: Planning
Planner task: Create execution plan for rate limiting
[... planner template content ...]

# Phase 3: Implementation
Implement rate limiting middleware per plan from Phase 2
[... standard feature template content ...]
```

---

## Tips for Effective Prompts

1. **Be specific:** Include file paths, function names, exact requirements
2. **Provide context:** Link to plans, backlog items, or existing patterns
3. **Set clear success criteria:** Define "done" explicitly
4. **Constrain scope:** Prevent scope creep with explicit boundaries
5. **Reference evidence:** Point to existing code patterns or documentation
6. **Use appropriate agent:** Match the agent to the task (Scout for exploration, Executor for implementation)
