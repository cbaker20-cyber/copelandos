# Provider Routing Roadmap

CopelandOS should route model work to the best configured provider for a task while staying honest about unavailable providers. Provider routing is separate from external integration connectivity.

## Current behavior

- Provider status is derived from configured environment variables.
- The router can explain why a provider was selected or why none is available.
- Missing providers return explicit no-provider errors.
- The dashboard shows providers as not connected unless configuration exists.

## Roadmap

1. Keep deterministic routing for common task types.
2. Add per-task constraints such as privacy tier, cost tier, structured output, and tool-calling needs.
3. Prefer local/private routes when they satisfy the task.
4. Track rate limits and temporary provider failures without exposing upstream error bodies.
5. Record provider decisions in task notes for later review.

## Non-goals

- Do not hard-code one paid provider as the only path.
- Do not expose provider keys or upstream sensitive error bodies.
- Do not claim a provider, integration, or tool is connected without a tested signal.
- Do not let provider output execute tools directly.

## Relationship to integrations

The integration registry includes `provider-router` as an implemented internal module because the routing code exists. That does not mean any external AI provider is connected. External provider availability remains a separate environment-backed status reported by provider routes.
