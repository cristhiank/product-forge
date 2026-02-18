# Cross-Cutting Concerns

## Configuration

- Each module defines a strongly typed options class and configuration section
- Services consume configuration through binding or injection, not by accessing raw values
- Distinguish between static configuration (loaded once at startup) and dynamic configuration (reloadable at runtime)
- External runtimes read configuration from environment variables and mounted files
- The host validates all required configuration sections at startup. Missing or invalid values fail fast with clear error messages. Validation runs as a dedicated function, not scattered through module registration.

## Background Processing

Each module owns its own background workers for periodic tasks and long-running operations. Background workers follow the same collaboration rules: module interfaces and contracts, no bypassing domain rules.

### Batch Processing Pattern

Workers that poll and process batches follow this pattern:

1. **Periodic timer** — Configurable poll interval
2. **Batch lease** — Lease a batch of jobs with a TTL. Other workers will not pick up leased jobs until the lease expires
3. **Process or retry** — On success, mark complete. On failure, increment attempt counter and schedule retry with backoff. After max attempts, move to dead-letter state
4. **Graceful cancellation** — Handle cancellation signals to break cleanly on shutdown. Catch and log all other exceptions without crashing the loop

## Retry and Backoff

Operations that can fail transiently use exponential backoff:

- `delay = base * 2^(attempt - 1)`
- Clamp at a ceiling (e.g., 5 minutes)
- Enforce minimum base delay (e.g., 50ms) even if config provides zero
- Track attempt count per job and stop after configured maximum

Retry parameters (base delay, max attempts, ceiling) are configurable per module through the options system.

## Middleware Pipeline

Ordered middleware pipeline for cross-cutting message processing:

- Each middleware implements inbound and outbound processing methods
- Executed in deterministic order (numeric priority or explicit registration order)
- Any middleware may short-circuit the pipeline
- Pipeline configured at startup, does not change at runtime

Standard middleware includes rate limiting, guardrails (input validation, PII filtering), and logging. New middleware added by implementing the interface and registering at startup.

## Tool Provider Abstraction

When the platform provides tools to an AI agent, tool providers implement a common interface:

- **List tools** — Return catalog with name, description, parameter schema
- **Execute tool** — Execute named tool with arguments, return result or error
- **Initialize / close** — Lifecycle management for providers holding resources

A tool provider registry aggregates tools from multiple providers, detects name collisions at initialization, and routes calls to the correct provider. Execution errors are caught per-provider and returned as error results (not thrown exceptions) so the agent loop can continue.

## Security and Multi-Tenancy

At an architectural level:

- Every request and operation is associated with a tenant and user where applicable
- Resources belong to a single tenant
- Multi-tenancy enforced at three levels:
  - **API level** — Authorization and claims
  - **Data level** — Tenant columns, filters, or row-level security
  - **External runtime level** — Careful scoping of data and instructions per tenant and operation

For early versions, external runtimes may operate on trusted internal networks. Authentication and signatures should be introduced as the platform matures.

The specific multi-tenancy model (shared database with tenant columns, schema-per-tenant, database-per-tenant) should be specified in a dedicated document. Whatever model is chosen is enforced consistently across all modules and runtimes.
