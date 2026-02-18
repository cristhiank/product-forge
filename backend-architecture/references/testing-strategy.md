# Testing Strategy

## Test Organization

Each module has a corresponding test project. Test projects mirror the source structure:

```
tests/
  module-a.tests/
  module-b.tests/
  app.tests/
```

External runtimes maintain their own test suites using the language-appropriate framework.

## Four Test Categories

### Unit Tests (majority)

- Test a single class or function in isolation
- Mock external dependencies (AI providers, container clients, HTTP clients, loggers)
- Use real implementations for simple value types, registries, stateless logic
- Fast: full suite runs in seconds

### Integration Tests

- Test a module's internals working together with real infrastructure (file system, temp directories)
- Use real storage against temporary directories or in-memory databases
- Verify persistence, serialization, and lifecycle within a module
- Clean up resources in teardown using framework lifecycle hooks

### API Tests (for external runtimes)

- Test the full HTTP API surface using an in-process test client
- Verify status codes, response shapes, error handling, security constraints
- No mocking — exercise the real application stack

### Architecture and Conformance Tests

- Verify module boundary rules: no cross-module implementation references
- Verify external runtimes conform to their OpenAPI spec
- Verify container security posture (non-root, read-only rootfs, resource limits)
- Treated as build blockers in CI

## What to Mock and What Not to Mock

**Mock these** — slow, non-deterministic, or external:
- AI provider and LLM clients
- Container and orchestration clients
- External HTTP APIs and third-party services
- Loggers (reduce noise; verify log calls only when logging is the behavior under test)

**Use real implementations** — fast and deterministic:
- Middleware and pipeline classes with test-specific config
- Registries and in-memory collections
- Storage against temp directories or in-memory backends
- Parsers, validators, utility functions
- Immutable DTOs and value types

The goal: **mock the boundary, test the logic.**

## Test Data Patterns

- **Factory methods** — Static helpers to create DTOs and entities with sensible defaults and optional overrides. Keeps test intent clear.
- **Temp directories** — Create unique temp directories (e.g., GUID suffixes), clean up in teardown.
- **Inline data** — For parameterized tests, use inline data attributes. Keep test data close to the test.

## Naming Conventions

Test names follow: **Method_Scenario_ExpectedBehavior**

```
Register_DuplicateName_Throws
ProcessMessage_EmptyInstructions_NoSystemMessage
Inbound_OverMaxLength_Blocked
ComputeBackoff_ThirdAttempt_Quadruples
```

Languages with underscore-prefixed test functions: **test_operation_scenario**

```
test_execute_timeout
test_upload_file_with_path
test_path_traversal_blocked
```

Names should read like specifications. Someone unfamiliar with the code should understand what is tested from the name alone.

## Async and Lifecycle

- Test async operations using the language's native async mechanism. Never block synchronously.
- Use the test framework's async lifecycle support for setup and teardown.
- Tests creating resources must clean them up via framework teardown hooks, not scattered manual cleanup.

## External Runtime Test Requirements

Every external runtime must include:
- **Unit tests** for the execution engine (core logic without HTTP layer)
- **API tests** for every endpoint (happy path, error cases, edge cases)
- **Security tests** for input validation and path traversal prevention
- **Timeout tests** verifying execution timeout enforcement
- A virtual environment or isolated dependency set

## Fitness Function Tests

Architecture and contract tests that verify:
- No module implementation references another module's implementation
- Modules use each other only through contracts
- The host does not bypass module entry points
- Only generated clients call external runtime endpoints
- External runtimes never access the core database directly
- All public APIs and streams conform to their OpenAPI/AsyncAPI specs

These run in CI as build blockers.

### Conformance Suites

Validate external runtimes against:
- Protocol behavior (all endpoints match spec)
- Security posture (non-root, read-only rootfs, resource limits)
- Observability requirements (health endpoint, structured logs)
