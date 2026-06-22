# Provider Routing Roadmap

CopelandOS should route work to the cheapest safe provider that is actually configured, then fail over without hiding uncertainty. The current implementation is a policy and status layer; provider calls must stay test-backed before more live routing is added.

## Current Behavior

- `src/providerRouter.js` reads `config/providers.json`.
- `GET /api/providers` lists providers with honest `configured` and `connected: false` states.
- `POST /api/providers/route` explains the selected provider or why no provider is configured.
- `GET /api/providers/local-fallback` shows Ollama as a local fallback without assuming it is running.
- `GET /api/providers/no-subscription` lists configured free-tier routes.
- `src/modelRouter.js` normalizes task types and chooses the first configured provider in `config/models.json`.

## Target Routing Policy

| Task profile | Preferred route | Notes |
|---|---|---|
| Fast classification | Groq -> Cerebras -> Gemini -> Ollama | Low latency and low cost first |
| Coding | Anthropic -> OpenAI -> OpenRouter free -> Gemini -> Ollama | Keep code tasks explainable and review-backed |
| Planning | Anthropic -> OpenAI -> Gemini -> OpenRouter free -> Ollama | Favor reasoning quality, but only if configured |
| Summarization | Groq -> Cerebras -> Gemini -> OpenAI -> Ollama | Cheap summarization by default |
| Music | OpenAI -> Anthropic -> Gemini -> OpenRouter free -> Ollama | Preserve musical correctness tests before expansion |
| Security review | Anthropic -> OpenAI -> Gemini -> OpenRouter free -> Ollama | No action execution, review only |
| Council | OpenRouter Fusion -> Anthropic -> OpenAI -> Gemini -> Ollama | Budget-gated, high-complexity tasks only |

## Failover Model

LiteLLM's router documents retries, fallbacks, cooldowns, and ordered deployment escalation. CopelandOS should copy the operational idea, not the implementation, by keeping explicit task routes in config and returning explainable decisions. Sources: [LiteLLM routing](https://docs.litellm.ai/docs/routing), [LiteLLM fallbacks](https://docs.litellm.ai/docs/proxy/reliability).

Planned failover fields:

- `maxRetries`: current config uses 2.
- `retryOn`: rate limit, timeout, and server error.
- `cooldown`: future health memory for providers that fail repeatedly.
- `budgetGuard`: never escalate above the cheapest configured tier unless council mode is intentionally selected.
- `contextFallback`: future routing for prompts too long for a selected model.

## OpenRouter / Fusion-Style Council

OpenRouter-style routing is useful when CopelandOS wants a model marketplace or multi-model council, but it should be treated as a paid or budgeted path. The current registry labels `openrouter-fusion` as council routing and does not claim it is connected without `OPENROUTER_API_KEY`.

## Ollama Local Fallback

Ollama exposes local model APIs when running on localhost. CopelandOS should use `OLLAMA_BASE_URL` as the activation signal and still probe health before reporting `connected`. Source: [Ollama API](https://docs.ollama.com/api/generate).

## Tests To Preserve

- No provider key means no provider is selected.
- A configured provider is selected by ordered route.
- Legacy env var names still work where supported.
- Local fallback is represented as local/offline but not running unless proven.
- Foundation status never fakes provider or integration connections.

## Next Implementation Tasks

- Unify `src/providerRouter.js` and `src/modelRouter.js` around one config source.
- Add schema validation for provider config at startup/test time.
- Add deterministic provider health probe functions that return sanitized errors only.
- Add budget-tier tests before enabling any paid escalation.
- Add request logging that records provider ID, task type, and fallback reason without prompts or secrets.
