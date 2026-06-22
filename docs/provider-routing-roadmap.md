# Provider Routing Roadmap

CopelandOS should route AI work by task, cost, privacy, speed, and safety instead of depending on one subscription. The current code provides deterministic routing and honest status. Live gateway failover is future work.

## Current Implementation

- `config/models.json` powers `src/modelRouter.js` for `/api/ai` and `/api/ai/route`.
- `config/providers.json` powers `src/providerRouter.js` for provider inventory, free-tier routes, local fallback, and route explanations.
- A provider is configured only when the expected env var is present.
- No route claims a provider is connected from an env var alone.
- Ollama is represented as a local fallback, but it is not shown as running unless configured.

## Task Routes

| Task type | Route |
|---|---|
| `fast` | Groq -> Cerebras -> Gemini -> OpenAI -> Ollama |
| `reasoning` | Anthropic -> OpenAI -> Gemini -> OpenRouter -> Ollama |
| `coding` | Anthropic -> OpenAI -> OpenRouter -> Gemini -> Ollama |
| `summarization` | Groq -> Cerebras -> Gemini -> OpenAI -> Ollama |
| `research` | OpenAI -> Anthropic -> Gemini -> OpenRouter -> Ollama |
| `planning` | Anthropic -> OpenAI -> Gemini -> OpenRouter -> Ollama |
| `music` | OpenAI -> Anthropic -> Gemini -> OpenRouter -> Ollama |
| `security_review` | Anthropic -> OpenAI -> Gemini -> OpenRouter -> Ollama |
| `council` | OpenRouter Fusion -> Anthropic -> OpenAI -> Gemini -> Ollama |

## Routing Principles

1. Prefer the cheapest capable configured provider for routine work.
2. Prefer stronger reasoning providers for security, architecture, and complex planning.
3. Use free-tier and local routes for routine summarization and capture classification.
4. Escalate to council mode only for high-complexity work that benefits from multiple roles.
5. Preserve privacy by keeping local fallback visible and avoiding unnecessary cloud calls.
6. Do not send tools to providers unless the tool registry approves the action.

## OpenRouter Inspiration

OpenRouter documents provider routing controls and model fallbacks. Provider failover can keep one model available across providers, while model fallbacks allow an ordered list of models when the primary path fails.

References:

- Provider routing: https://openrouter.ai/docs/guides/routing/provider-selection.mdx
- Model fallbacks: https://openrouter.ai/docs/guides/routing/model-fallbacks
- Reliability failover explanation: https://openrouter.ai/blog/insights/reliability-failover/

CopelandOS should eventually support an OpenRouter request shape that can include ordered fallback models for approved tasks, while still logging which model actually answered.

## LiteLLM Inspiration

LiteLLM documents retries, cooldowns, load balancing, and fallbacks across model groups and providers.

References:

- Router/load balancing: https://docs.litellm.ai/docs/routing
- Proxy reliability: https://docs.litellm.ai/docs/proxy/reliability
- Router architecture: https://docs.litellm.ai/docs/router_architecture

CopelandOS can use a LiteLLM gateway later if it needs central budget controls, audit logs, and model-group failover. Until then, local deterministic routing is simpler and safer.

## Ollama Local Fallback

Ollama provides a local REST API and is useful for private, low-cost fallback when quality and speed are acceptable.

References:

- Ollama API docs: https://docs.ollama.com/api
- Ollama local authentication note: https://docs.ollama.com/api/authentication

Implementation boundary:

- Accept only `http:` or `https:` base URLs with no embedded credentials.
- Prefer localhost or private network configuration in deployment notes.
- Never expose Ollama status as connected from the cloud Worker unless a scoped local bridge confirms it.

## Future Work

1. Add a normalized `routeAiTask({ taskType, riskLevel, budgetTier, privacyTier })` interface.
2. Add provider health metadata from actual responses without exposing upstream error bodies.
3. Add budget guards for council mode.
4. Add OpenRouter fallback arrays for approved model families.
5. Add LiteLLM gateway support as `configured-not-probed` until a health endpoint is implemented.
6. Add tests for route order, fallback explanation, local fallback messaging, and no fake connected state.

## Test Requirements

Every routing change should include tests that verify:

- Missing env vars produce no selected cloud provider.
- Legacy env vars still configure the intended provider.
- Local fallback is represented without claiming it is running.
- Unknown task types normalize safely.
- Upstream failures do not leak sensitive response bodies.
