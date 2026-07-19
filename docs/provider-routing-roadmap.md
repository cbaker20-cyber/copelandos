# Provider Routing Roadmap

CopelandOS should route AI work across free tiers, paid providers, gateway routing, and local fallback without depending on one subscription. The current implementation is intentionally conservative: a provider is selected only when its configured environment variable exists.

## Current implementation

- `config/providers.json` describes display names, task strengths, cost tier, speed tier, privacy tier, and fallback order.
- `src/providerRouter.js` supports status, selection, fallback explanation, council provider selection, no-subscription routes, and Ollama fallback messaging.
- `config/models.json` and `src/modelRouter.js` provide the Worker-facing model route for `/api/ai`.
- Tests cover no-provider states, configured provider selection, legacy env keys, local fallback, and honest status.

## Routing principles

1. Free-tier and local routes before paid routes when quality is sufficient.
2. Paid escalation only when the task requires it and a configured provider exists.
3. No fake live state: `configured` means an env var exists; `connected` requires a future probe.
4. Return sanitized errors; do not expose upstream provider response bodies.
5. Use task type, budget, latency, privacy, and tool-calling needs in routing decisions.
6. Keep local Ollama fallback visible but clearly marked as not running unless probed.

## Proposed routing tiers

| Tier | Providers | Use case | Guardrail |
|---|---|---|---|
| Local | Ollama | Private drafts, offline fallback, low-stakes summaries | Mark as local fallback, not connected unless probed |
| Free cloud | Groq, Cerebras, Gemini Flash, OpenRouter free models | Fast capture classification, summarization, low-cost coding help | Respect rate limits and provider terms |
| Paid direct | Anthropic, OpenAI | Complex planning, security review, high-quality coding | Budget guard before escalation |
| Gateway | LiteLLM | Unified routing and fallback across owned keys | Gateway config must be explicit |
| OpenRouter/Fusion | OpenRouter auto/fallback routing | Opportunistic model routing | Do not claim consensus unless multiple model calls are actually made |

## Implementation tasks

1. Normalize `config/providers.json` and `config/models.json` into one provider schema.
2. Add a provider health probe endpoint that checks reachability without sending user content.
3. Add per-task budget metadata: `free_only`, `allow_paid`, `local_only`, and `council_allowed`.
4. Add sanitized provider failure taxonomy: `missing_key`, `rate_limited`, `timeout`, `server_error`, `context_too_large`.
5. Add optional LiteLLM gateway support behind `LITELLM_BASE_URL`.
6. Add OpenRouter model fallback arrays only when OpenRouter is selected and explicitly configured.
7. Add tests for routing by budget, privacy, tool-calling support, and fallback order.

## Test checklist

- No env keys -> no provider selected.
- Free provider key -> free route selected for fast/summarization tasks.
- Paid provider key -> selected only in relevant routes.
- Ollama URL -> local route reports local fallback.
- Council route -> requires configured council providers or returns mock/scaffold state.
- Upstream error body -> never returned directly to clients.
