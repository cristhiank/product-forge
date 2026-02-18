# Frontend Telemetry and Observability

Frontend telemetry tracks meaningful product moments, not raw interactions.

## Implementation

All tracking goes through a small shared wrapper so that route tracking, event naming, and user identification stay consistent and type-safe.

## What to Track

Product-significant events:
- Key workflow completions (onboarding, creation, submission)
- Feature adoption signals (first use of a capability)
- Quality signals (policy rejections, error rates, loading performance)

## Rules

- Never log sensitive content (file contents, query text, credentials, PII beyond what is necessary)
- Treat frontend events as UX signals, not ground truth for billing or auditing
- If an event does not help answer a question about activation, retention, adoption, or workflow quality, do not add it
