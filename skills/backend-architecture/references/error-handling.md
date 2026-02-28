# Error Handling

## Error Handling Styles

Choose the simplest strategy that works for the context:

| Context | Strategy |
|---------|----------|
| Invalid input at API boundary | Return structured error response with status code and error code |
| Transient infrastructure failure (file I/O, network) | Retry with exponential backoff up to max attempts |
| Background job failure | Increment attempt counter, schedule retry with backoff, dead-letter after max attempts |
| Tool execution failure | Return error as a result value (not an exception) so the caller can decide |
| Middleware filtering | Return null to short-circuit the pipeline |
| Unrecoverable error at startup | Fail fast with clear message and non-zero exit code |

## Structured Error Responses

All HTTP APIs (core host and external runtimes) return errors in a consistent shape:

```json
{
  "error": "error_code",
  "message": "Human-readable description"
}
```

- **Error codes** are stable identifiers suitable for programmatic handling
- **Messages** are for humans and may change between versions
