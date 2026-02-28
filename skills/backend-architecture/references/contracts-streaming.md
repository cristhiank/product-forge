# Contracts, Streaming, and Event Model

## Three Kinds of Contracts

### In-Process Contracts

- Interfaces, DTOs, and events under each module's contracts surface
- Used for module-to-module collaboration inside the host
- Versioned through normal code evolution and package compatibility
- Protected by architecture tests preventing cross-module implementation references

### Service Contracts (OpenAPI)

- OpenAPI specs describe HTTP APIs crossing process boundaries
- Used to generate backend and frontend clients
- Versioned with semantic versioning: backwards-compatible additions bump minor, breaking changes bump major
- The spec is the source of truth — implementations and generated clients must follow it

### Streaming Contracts (AsyncAPI)

- AsyncAPI specs describe streaming APIs and channels
- Define event types, payload schemas, ordering and sequencing rules, terminal/error events
- Drive generated message types and conformance tests

## Governance Rules

- Each bounded context owns its contracts and specs
- Consumers do not edit specs directly; changes proposed and approved in the owning module
- Contract changes validated using unit tests, contract tests, and conformance tests for external runtimes
- Generated clients are the **only** allowed way to call external runtime endpoints. Ad-hoc HTTP calls are not allowed.

## Streaming Semantics

Streaming APIs are treated as ordered event streams for a given operation.

For any streaming operation:
- Each stream is associated with an operation identifier and correlation identifiers
- Events include sequence number, event type, and payload data per the AsyncAPI spec
- Event types follow consistent naming: `{operation}.created`, `{operation}.progress`, `{operation}.completed`, `{operation}.failed`
- Streams terminate with a completion or terminal failure/cancellation event

### Resumable Streaming

Supported by:
- Including sequence numbers and identifiers in each event
- Providing APIs to fetch events starting from a specific sequence

## Domain Events and Streaming

Inside the host, domain or integration events communicate between modules.

When streaming is involved:
- Incoming streaming events from external runtimes can be translated into domain events that modules subscribe to
- Domain events leaving the host are expressed through service contracts and AsyncAPI schemas, not internal event types

The internal event bus is not exposed to external clients or runtimes.
