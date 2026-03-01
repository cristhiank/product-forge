---
name: backend-architecture
description: >-
  Use when creating, modifying, or reviewing any backend code — APIs, endpoints,
  controllers, services, handlers, database schemas, migrations, repositories,
  modules, middleware, background jobs, event handlers, configuration, or tests.
  Provides architecture patterns and structural rules for project layout, module
  boundaries, domain modeling, data persistence, error handling, observability,
  streaming, and contract governance. Applies to any language, framework, or
  business domain.
---

# Backend Architecture

Architectural principles, patterns, and structural rules for building backend platforms. Technology-agnostic and domain-agnostic.

When in doubt, this skill wins over personal preference or what is easiest right now.

## When This Skill Activates

1. **Assess fit** — Identify which principles below apply to the current task and codebase. Skip sections that don't apply — not every task needs every principle. A one-endpoint change doesn't need a bounded context analysis.
2. **Cite decisions** — When making an architecture choice, briefly note which principle guided it and what alternative was considered. Example: "Using metadata field over schema migration (data-persistence pragmatism: shape still evolving, module-private data)."
3. **Flag deviations** — If you intentionally deviate from a principle, note why. Deviations with good rationale are fine — silent deviations erode trust.
4. **Adapt to stack** — These patterns are expressed generically. Translate to the project's actual idioms. See [stack-adaptation.md](references/stack-adaptation.md) when the mapping is not obvious.
5. **Propagate to workers** — When spawning sub-agents or workers for backend implementation tasks, instruct them to load this skill.

## Architecture Decision Artifacts

When facing a non-trivial architecture choice, produce the appropriate artifact inline:

**Quick Decision** (default — use for most choices):
> **Decision**: [what] | **Principle**: [which one] | **Alternative**: [rejected option and why]

**Tradeoff Matrix** (use when 2+ viable approaches compete):

| Criteria | Option A | Option B |
|----------|----------|----------|
| [relevant dimension] | [assessment] | [assessment] |

**Module Design Record** (use when introducing a new module or bounded context):

| Aspect | Decision |
|--------|----------|
| Bounded context | [name and responsibility] |
| Modeling style | Transaction-style / Focused domain / Full DDD |
| Data ownership | [tables or stores owned] |
| Contract surface | [interfaces and DTOs exposed] |
| Key risks | [top 2-3] |

For common "choose X vs Y" decisions, see [decision-frameworks.md](references/decision-frameworks.md).

## Core Architectural Principles

1. **Monolith first, modular always** — Prefer a single deployable backend structured as well-isolated modules. Only extract capabilities into separate runtimes with a strong technical forcing function.

2. **Bounded contexts over layers** — Organize by business capability and domain language, not horizontal layers. Layers exist inside modules, not across the system.

3. **Explicit contracts everywhere** — In-process: interfaces, DTOs, events. Cross-process: OpenAPI/AsyncAPI specs. No implicit coupling through shared tables or ad-hoc HTTP calls.

4. **External runtimes are replaceable** — Defined by their protocols, not implementation. Replaceable as long as they conform to the contract.

5. **Streaming as first-class integration** — Long-running or conversational operations use streaming APIs and ordered event sequences.

6. **Single data owner per concept** — Each concept has one owning bounded context. Others access through APIs, read services, or derived read models.

7. **Observability is consistent and polyglot** — All runtimes emit telemetry with shared conventions. No custom schemes per component.

8. **Architecture is enforced, not aspirational** — Constraints are encoded in automated tests and CI. Documents define rules; tests enforce them.

## Platform Mental Model

### Logical Capabilities

Before writing code, identify and name business capabilities explicitly. Each becomes a candidate bounded context.

A good capability list:
- Uses business language, not technical language
- Has clear ownership boundaries
- Avoids overlap (shared vocabulary = probably one context)
- Fits on a whiteboard

### Runtime Building Blocks

Two main runtime types:

1. **Core platform host** — Modular monolith. Exposes HTTP APIs and streaming endpoints. Owns most domain logic and data. Provides cross-cutting services (auth, tenancy, telemetry).

2. **External runtimes** — Separate containerized processes. Implement versioned protocols (OpenAPI/AsyncAPI). Communicate through generated clients. Exist only when forced by language, isolation, or scaling needs.

### Control Plane vs Execution Plane

- **Control plane** — APIs that configure resources and settings. Handled by core host.
- **Execution plane** — Long-running or compute-intensive operations. Shared between host and external runtimes via well-defined protocols.

## Pragmatic Domain Modeling

Use DDD ideas where they help; avoid ceremony where they do not. Choose the simplest modeling style that works.

### Three Modeling Styles

1. **Transaction-style handlers (default)** — For CRUD, enrichment, orchestration. Simple handlers, entities as data holders, no aggregates or repositories unless complexity demands it.

2. **Focused domain models (selective)** — For real business rules and invariants. Behavior on entities where it protects invariants. Small aggregates for transactional consistency. Value objects only when earned.

3. **Full DDD (exception)** — For core complexity areas only. Domain services, domain events, elaborate aggregates. The exception, not the default.

### Value Object Rules

Create a value object only when it: enforces non-trivial invariants, encapsulates reused parsing/formatting logic, or crosses boundaries where a primitive would be ambiguous. Do not wrap every string or ID by default.

### Domain vs Application Logic

- **Domain logic** — Business rules and invariants. Belongs close to entities/aggregates.
- **Application logic** — Orchestration (calling services, persisting, messaging). Lives in handlers/services in the application layer.

If logic is about calling systems in order → application layer. If logic is about what is allowed to change → closer to the entity.

### Performance and Data Locality

- Keep structures flat and close to storage
- Fetch only needed fields
- Avoid deep object graphs and unnecessary mapping
- Direct projections into DTOs on hot read paths
- Load only data needed to validate a change on write paths

## Solution Layout

```
src/
  app/                          # Web host / entry point
  shared/
    kernel/                     # Cross-cutting building blocks (no domain logic)
    infrastructure/             # Cross-cutting infra (database, telemetry)
  modules/
    module-a/
    module-b/

tests/
  module-a.tests/
  module-b.tests/
  app.tests/
```

Reference rules:
- Host references all modules and shared packages
- Modules reference shared kernel, shared infrastructure, and other modules' **contract surfaces only**
- Modules never reference each other's internal implementation

## Module Internal Structure

Feature-first organization inside each module:

```
module/
  contracts/                    # DTOs, interfaces, events (PUBLIC surface)
  domain/
    entities/
    value-objects/
    services/
  application/
    features/
      feature-a/
      feature-b/
  infrastructure/
    persistence/
    services/                   # External clients, adapters
  api/                          # Controllers, routes, gRPC implementations
  options/                      # Strongly typed configuration
  module-registration           # DI and endpoint registration entry point
```

**Contracts** are the only part visible outside the module. Everything else defaults to internal visibility.

Not every feature needs full domain/application/infrastructure layers. A simple feature can be just a handler, persistence method, and endpoint. Introduce richer structure as complexity demands.

For detailed module internals, see [module-structure.md](references/module-structure.md).

## Module Registration

Each module exposes an entry point to register services, configuration, and routes. The host wires cross-cutting services and registers modules through their entry points. The host never contains domain logic or module-specific wiring.

## Bounded Contexts

A well-defined bounded context:
- Owns a cohesive set of concepts in consistent domain language
- Has a clear data ownership boundary (no shared tables)
- Exposes a public contract surface and hides everything else
- Can be developed and tested in relative isolation

Favor autonomy over reuse. Shared code without domain meaning belongs in a shared kernel.

## Key Reference Documents

| Topic | Reference |
|-------|-----------|
| Module internals and composition | [module-structure.md](references/module-structure.md) |
| External runtimes and containers | [external-runtimes.md](references/external-runtimes.md) |
| Data, persistence, and migrations | [data-persistence.md](references/data-persistence.md) |
| Contracts, streaming, and events | [contracts-streaming.md](references/contracts-streaming.md) |
| Config, background jobs, middleware | [cross-cutting.md](references/cross-cutting.md) |
| Testing strategy | [testing-strategy.md](references/testing-strategy.md) |
| Observability and telemetry | [observability.md](references/observability.md) |
| Error handling | [error-handling.md](references/error-handling.md) |
| Common architecture decision trees | [decision-frameworks.md](references/decision-frameworks.md) |
| Translating patterns across stacks | [stack-adaptation.md](references/stack-adaptation.md) |

## Evolution Path

- New capabilities start as modules inside the core host
- Extract to external runtime when forced by language, isolation, or scaling
- Split modules into finer-grained bounded contexts when they grow too large
- Data ownership stays with the owning bounded context
- Contracts evolve with semantic versioning

## When in Doubt

1. Ask which bounded context owns the business concept and place code there.
2. If multiple modules need the same capability, start with a contract in the owning module.
3. If tempted to reach into another module's internals, add an interface in the provider's contracts or introduce an event.
4. If code feels generic but is only used once, keep it local. Do not move to shared prematurely.
5. If unsure about rich domain modeling, start with a simple handler. Add modeling when real complexity appears.
6. If a rule must be broken, document why and treat it as explicit technical debt.

The goal: a platform that is coherent and easy to reason about, with simple code for simple things and strong boundaries where complexity actually lives.
