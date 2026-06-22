# Provider Routing Roadmap

CopelandOS should avoid dependence on a single paid subscription. The router should pick the best configured provider for the task, explain fallback chains, and keep local Ollama as a privacy-first fallback when a local server is configured.

## What Works Now

- `config/providers.json` defines providers, task strengths, cost tiers, privacy tiers, and ordered routes.
- `src/providerRouter.js` lists provider status and explains routing decisions without calling providers.
- `/api/providers`, `/api/providers/route`, `/api/providers/local-fallback`, and `/api/providers/no-subscription` expose honest status.
- Tests cover missing env vars, configured providers, legacy env vars, free-tier routes, council providers, and local fallback.

## Proposed Router Behavior

| Task Type | Preferred Route | Notes |
|---|---|---|
| Fast capture classification | Groq, Cerebras, Gemini, OpenAI, Ollama | Favor low latency and free tiers |
| Planning/reasoning | Anthropic, OpenAI, Gemini, OpenRouter, Ollama | Favor stronger reasoning |
| Coding | Anthropic, OpenAI, OpenRouter, Gemini, Ollama | Require tests and review |
| Research | OpenAI, Anthropic, Gemini, OpenRouter, Ollama | Require citations |
| Council | OpenRouter Fusion, Anthropic, OpenAI, Gemini, Ollama | Only for complex tasks |
| Local fallback | Ollama | Never claim live unless probed |

## OpenRouter/Fusion-Style Routing

OpenRouter supports a unified API and model-routing features such as `openrouter/auto` and fallback model lists. CopelandOS can use this as a council or overflow route, but should log the selected model for reproducibility and cost review.

## LiteLLM-Style Failover

LiteLLM documents router settings for routing strategy, retries, and fallback chains. A future CopelandOS gateway could use the same concepts:

- `num_retries` before fallback.
- Context-window fallback for long planning tasks.
- Cooldown for unhealthy providers.
- Budget ceilings by task category.
- Structured logs that omit prompt secrets and student data.

## Local Ollama Fallback

Ollama exposes local REST APIs for chat/generate. CopelandOS should keep Ollama as a local fallback when `OLLAMA_BASE_URL` is configured, but should not display it as connected until a future health probe confirms the server is reachable.

## Next Implementation Tasks

1. Add provider health probes with timeouts and redacted errors.
2. Add budget and provider-selection audit records.
3. Add context-size routing hints.
4. Add a tested provider-call wrapper that never exposes upstream error bodies.
5. Add local Ollama probe route that is disabled unless explicitly configured.

## References

- OpenRouter model routing: <https://openrouter.ai/docs/features/model-routing>
- LiteLLM routing docs: <https://docs.litellm.ai/docs/routing>
- LiteLLM proxy configuration: <https://docs.litellm.ai/docs/proxy/configs>
- Ollama API docs: <https://docs.ollama.com/api>
