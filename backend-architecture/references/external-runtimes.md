# External Runtimes and Container Patterns

## When to Introduce an External Runtime

Only when there is a clear forcing function:
- A different language is required
- The workload needs independent scaling
- Process isolation is necessary for security or stability
- A third-party system mandates a specific integration model

When introducing a new external runtime, document: its language, the interface it exposes, how it receives configuration, and which bounded context owns it.

## External Runtime Requirements

An external runtime must:
- Be packaged as a container image
- Run as a non-root user on a minimal base image
- Expose HTTP APIs and/or streams matching a published OpenAPI/AsyncAPI spec
- Read configuration from environment variables and mounted volumes
- Emit structured logs and OpenTelemetry telemetry
- Pass a conformance test suite maintained in the platform repository

The owning module in the core host defines:
- The semantics of the runtime
- The contract and versioning policy
- The orchestration and lifecycle of runtime instances

## Container Baseline Rules

All external runtime containers must follow:
- Multi-stage builds producing small runtime images
- Non-root user with least privileges needed
- Health and readiness endpoints
- Configuration from environment variables, files, or secrets — never baked into the image
- Clean startup and shutdown (graceful termination, signal handling)
- Idempotent handling of retries where applicable

## Container Hardening

Containers executing untrusted or agent-generated code must apply defense in depth:

1. **User isolation** — Non-root user. Prevent privilege escalation.
2. **Filesystem** — Read-only root filesystem. Writable paths scoped, size-limited, cannot execute binaries.
3. **Capabilities** — Drop all OS-level capabilities by default. Re-add only what is strictly required.
4. **Resource limits** — Enforce memory, CPU, process count, and disk quotas.
5. **Syscall filtering** — Restrictive syscall whitelist permitting only what the workload needs.
6. **Network** — Restrict outbound access. Use host-level firewall rules or sandboxed network for egress blocking. Document accepted network exposure as explicit technical debt.
7. **Execution timeout** — Per-operation timeouts at process level. Kill on expiry.

## Container Lifecycle Management

When the core host manages container instances dynamically (per-session, per-conversation, etc.):

- **Session mapping** — In-memory mapping from logical session identifier to container state (ID, port, last activity, status)
- **Lazy creation** — Create containers on first use, not eagerly
- **Health gating** — Wait for health endpoint before routing requests
- **Idle cleanup** — Background task periodically destroys containers exceeding idle timeout
- **Graceful shutdown** — On platform stop, destroy all active containers
- **Retry on failure** — If unreachable, destroy and recreate once before returning error

## Data Access Rules

External runtimes:
- Do not access the core database directly
- Read data and configuration through volume mounts and APIs
- Write data through APIs called from the host that persist into stores owned by the relevant module
