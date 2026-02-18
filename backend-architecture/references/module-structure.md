# Module Structure and Composition

## Module Registration and Composition Root

Each module exposes an entry point to register its services, configuration, and routes with the host's dependency injection and routing system.

The host entry point:
- Wires cross-cutting services (configuration, HTTP clients, auth, telemetry)
- Registers each module through its entry point
- Maps each module's endpoints through its routing entry point
- Runs migrations through shared helpers

The host does not contain domain logic or module-specific wiring. Module internals are never registered directly from the host.

Where a module depends on cross-cutting infrastructure (container clients, HTTP client factories, external SDK clients), the host registers those shared services and the module receives them through constructor injection. This is not a violation — shared infrastructure belongs in the host. What must not leak into the host is module-internal wiring (specific storage classes, domain services, feature handlers).

## Internal Structure Details

### Contracts

The public surface. DTOs, interfaces, and events that other modules or runtimes may depend on. The only part of a module visible outside.

### Domain

Business rules and invariants for parts of the module that need them. For simple features, entities can be light data holders. For complex features, entities and aggregates own consistency rules.

### Application

Orchestration and use-case coordination. Handlers and services call domain logic, infrastructure, and other modules through contracts.

### Infrastructure

Database mapping, repositories, external API clients, and other technical details.

### API

Transport-specific handlers: controllers, minimal API routes, gRPC service implementations.

### Options

Strongly typed configuration for the module.

## Feature-First Organization

Not every feature needs a full set of domain, application, and infrastructure types. For simple flows, a feature can be just:
- A request handler
- A persistence method
- A thin endpoint

Introduce richer structure incrementally as complexity demands it.

## Visibility Rules

Everything that is not a contract type defaults to internal visibility. Only contracts are intended for cross-module use.

## Reference Rules

- The host entry point references all modules and shared packages
- Each module can reference the shared kernel, shared infrastructure, and other modules' contract surfaces only
- Modules never reference each other's internal implementation
- Architecture tests enforce these boundaries
