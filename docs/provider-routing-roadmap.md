# Provider Routing Roadmap

CopelandOS should route AI work by task profile, cost, latency, privacy, and confidence. The current implementation is a safe router scaffold: it selects only providers with configured environment variables and reports unconfigured providers honestly.

## Current Behavior

- Provider metadata lives in `config/providers.json`.
- `src/providerRouter.js` exposes status, primary selection, fallback explanation, council-provider selection, no-subscription routes, and local fallback metadata.
- No provider is marked configured without an environment variable.
- Ollama is represented as a local fallback but not claimed running unless `OLLAMA_BASE_URL` exists.
- `/api/providers`, `/api/providers/route`, `/api/providers/no-subscription`, and `/api/providers/local-fallback` expose safe status and explanations.

## Target Routing Tiers

| Tier | Best For | Preferred Providers | Notes |
| --- | --- | --- | --- |
| Fast capture | classification, summaries, quick triage | Groq, Cerebras, Gemini Flash | Favor free-tier and low latency |
| Planning | roadmaps, task briefs, architecture | Anthropic, OpenAI, Gemini, OpenRouter | Use only configured providers |
| Coding | implementation prompts and code review | Anthropic, OpenAI, OpenRouter, Gemini | Must include safe/forbidden actions |
| Research | source synthesis and citations | OpenAI, Anthropic, Gemini, OpenRouter | Web tools remain read-only |
| Music | JazzBackend/Score Scanner planning | OpenAI, Anthropic, Gemini, OpenRouter | Preserve domain-specific constraints |
| Council | high-risk or ambiguous work | OpenRouter Fusion style, Anthropic, OpenAI, Gemini | Higher cost; require explicit task value |
| Local fallback | private/offline draft work | Ollama | Lower quality expectations, privacy-first |

## Failover Policy

Use a LiteLLM-inspired approach without adopting a gateway prematurely:

1. Try the cheapest configured provider that satisfies the task profile.
2. Retry only on transient failures such as timeout, rate limit, or server error.
3. Escalate to the next configured provider in the route.
4. Escalate to council mode only when the planner marks the work as high-impact, ambiguous, or safety-sensitive.
5. Fall back to Ollama only when local fallback is configured and the task can tolerate local model quality.

Do not fail over when:

- The user lacks authorization.
- The tool registry blocks the requested action.
- The prompt contains secrets or private student data.
- The provider returns a policy or validation error that should be reviewed instead.

## AI Council

The council should be used for:

- security-sensitive code changes,
- architectural decisions with trade-offs,
- research synthesis where unsupported claims are risky,
- music-generation rules that need critic review,
- overnight sprint planning across multiple repos.

The current `/api/council` route is mock mode. Future work can connect configured providers, but should keep bounded deliberation and cost controls. OpenRouter documents Fusion as a multi-model deliberation flow where a panel produces analysis and a judge synthesizes it; that is inspiration, not a claim of current CopelandOS capability.

## Implementation Tasks

- Add budget hints to `config/providers.json` and surface them in route explanations.
- Add route tests for unknown task types falling back to reasoning.
- Add telemetry fields for `selected`, `fallbackChain`, `retryReason`, and `humanReviewRequired`.
- Add provider health probes only as explicit opt-in endpoints to avoid leaking upstream errors.
- Keep upstream error bodies out of user-facing responses.
- Consider a LiteLLM gateway only after the native router proves insufficient.

Sources: [LiteLLM fallback routing](https://docs.litellm.ai/docs/proxy/reliability), [LiteLLM Router](https://berriai-litellm.mintlify.app/sdk/router), [OpenRouter Fusion Router](https://openrouter.ai/docs/guides/routing/routers/fusion-router), and [Ollama local API](https://docs.ollama.com/api/generate).
