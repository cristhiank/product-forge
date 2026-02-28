# Validation and Safety Policy

When the frontend renders content from external sources — backend APIs, AI agents, user-generated content, plugins — a policy layer must sit between the raw input and the renderer.

## Validation

Every externally-produced spec or content object must:

- Validate against a schema (using the project's validation library)
- Pass semantic checks relevant to the domain (e.g., referenced fields exist, types are compatible, required relationships are present)

If validation fails, the UI degrades gracefully — showing a fallback, a user-friendly error, or a safe subset — rather than rendering broken or unsafe content.

## Safety Posture

Default posture: **no untrusted HTML or executable content.**

- Content formatters must use safe, controlled templates
- Any HTML-like content must be stripped or sanitized by the policy layer before rendering
- The renderer must not execute arbitrary code from external inputs (no `eval`, no `dangerouslySetInnerHTML` without sanitization, no dynamic script injection)

## Quality Heuristics

The policy layer can reject, rewrite, or downgrade content that would produce poor UX:

- Visualization specs with unreasonable cardinality or density
- Layout specs that would break responsive behavior
- Content exceeding size or complexity thresholds

When rewriting, apply sensible defaults (aggregation, truncation, simplification) rather than showing an error.

Policy decisions should be observable (telemetry events) so the team can learn from rejections and rewrites over time.
