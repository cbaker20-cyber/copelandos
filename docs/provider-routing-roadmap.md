# Provider Routing Roadmap

CopelandOS should route AI work without depending on one paid subscription and without pretending unavailable providers are connected.

## Current Scope

Implemented:

- `config/providers.json` provider inventory.
- `src/providerRouter.js` pure routing helpers.
- `src/modelRouter.js` Worker model routing for `/api/ai`.
- `GET /api/providers`.
- `POST /api/providers/route`.
- `GET /api/providers/local-fallback`.
- `GET /api/providers/no-subscription`.
- `GET /api/integrations` integration status for the provider router.

Not implemented:

- Live provider health checks.
- Per-provider latency measurements.
- Budget ledger.
- Automatic retries across providers for `/api/ai` after a failed live call.
- LiteLLM proxy deployment.
- Guaranteed local Ollama availability.

## Routing Principles

1. Free-tier first when the task allows it.
2. Paid providers only when configured and policy allows.
3. Local fallback should be visible but not claimed running without a probe.
4. Council routing may use a higher-quality or multi-model route only when complexity justifies it.
5. Provider status must separate `configured`, `connected`, and `selected`.
6. Upstream error bodies should not be exposed if they may contain sensitive content.

## Suggested Task Profiles

| Task type | Preferred route | Notes |
|---|---|---|
| `fast` | Groq -> Cerebras -> Gemini -> OpenAI -> Ollama | Low-latency summaries and classifications |
| `reasoning` | Anthropic -> OpenAI -> Gemini -> OpenRouter -> Ollama | Planning and analysis |
| `coding` | Anthropic -> OpenAI -> OpenRouter -> Gemini -> Ollama | Repo work and implementation |
| `summarization` | Groq -> Cerebras -> Gemini -> OpenAI -> Ollama | Morning report and notes |
| `research` | OpenAI -> Anthropic -> Gemini -> OpenRouter -> Ollama | Needs citation discipline |
| `security_review` | Anthropic -> OpenAI -> Gemini -> OpenRouter -> Ollama | Never skip human review |
| `council` | OpenRouter Fusion -> Anthropic -> OpenAI -> Gemini -> Ollama | Only for complex work |

## OpenRouter-Style Auto Routing

OpenRouter's `openrouter/auto` pattern is useful when prompt type varies and the router can choose from an allowed model set. CopelandOS should only use this after:

- Budget limits are configured.
- Allowed model families are explicit.
- Response metadata records the selected model.
- Multi-turn sessions use a stable session id when consistency matters.

## LiteLLM-Style Failover

LiteLLM's router pattern suggests:

- Ordered deployment tiers.
- Retries before moving to lower-priority routes.
- Cooldowns for rate-limited deployments.
- Explicit fallback lists after retries are exhausted.

CopelandOS can adopt the pattern without requiring a LiteLLM proxy in the foundation phase. The first implementation should be config-only plus tests.

## Ollama Fallback

Ollama is the privacy-first local option. The registry should show it as a possible fallback when `OLLAMA_BASE_URL` is configured, but not as connected until a local health check succeeds.

Recommended future probe:

- `GET <OLLAMA_BASE_URL>/api/tags` with timeout.
- Display model list count only.
- Do not send prompts during status checks.
- Fail closed if local agent policy blocks the probe.

## Test Plan

Add or keep tests for:

- No provider configured returns `ok: false`.
- Legacy env keys are supported where documented.
- Configured provider is selected by task type.
- Local fallback is represented but not claimed running.
- Free-tier routes are discoverable.
- Integration registry reports provider router connected as `false`.
- Future failover should hide sensitive upstream error bodies.

## Source Notes

- OpenRouter Auto Router: https://openrouter.ai/docs/guides/routing/routers/auto-router
- OpenRouter model routing overview: https://openrouter.ai/blog/insights/model-routing/
- LiteLLM routing: https://docs.litellm.ai/docs/routing
- LiteLLM retries and fallbacks: https://docs.litellm.ai/docs/completion/reliable_completions
- Ollama API: https://github.com/ollama/ollama/blob/main/docs/openapi.yaml
