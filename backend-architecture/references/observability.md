# Observability and Telemetry

## Principles

- Important actions and flows must be observable end to end
- Telemetry is consistent across runtimes and languages
- Logs are structured and queryable
- Metrics measure latency, throughput, and error rates
- Traces connect operations across modules and runtimes

## Implementation Standards

### All Runtimes

- Use OpenTelemetry SDKs where available
- Export telemetry over OTLP to a shared collector
- Use shared semantic conventions for tags, including at minimum: tenant identifier, module name, feature/use-case name, plus domain-specific resource identifiers meaningful for tracing

### Backend Host

- Structured logs with stable event names and fields
- Metrics for: latency and throughput of key operations, error rates and retries, background job behavior
- Distributed traces that:
  - Start spans at the first user action
  - Propagate context across modules and external runtime calls
  - Wrap significant external calls

### External Runtimes

- Wrap core operations and external calls in spans
- Include the same correlation identifiers as the host
- Emit JSON structured logs as minimum when full OTEL instrumentation is not yet available

## Correlation Identifiers

Every inbound request or event generates a correlation ID at the platform boundary. This ID:

- Is included in all log scopes for the operation's duration
- Is passed through middleware context alongside user, conversation, and channel identifiers
- Must be propagated to external runtimes via request headers or environment
- Appears in all structured log entries so a single operation can be traced across modules and processes
