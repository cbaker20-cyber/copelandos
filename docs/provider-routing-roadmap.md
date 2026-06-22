# Provider Routing Roadmap

CopelandOS should route AI work by task type, cost, privacy, speed, and tool capability. The current code has safe routing scaffolds; this document defines the path from static selection to a resilient provider layer.

## Current State

- `config/providers.json` defines cloud, gateway, and local provider profiles.
- `src/providerRouter.js` selects the first configured provider in a task-specific route.
- `/api/providers` lists honest provider statuses.
- `/api/providers/route` explains route decisions without calling the provider.
- `/api/providers/local-fallback` represents Ollama as a local fallback without pretending it is running.
- `/api/council` is currently mock/scaffold mode.

## Target Routing Model

```text
task profile
  -> normalize task type
  -> privacy filter
  -> budget guard
  -> tool capability filter
  -> health checked route
  -> provider call
  -> retry / failover
  -> local fallback if configured
  -> route telemetry
```

## Task Profiles

| Task type | Primary need | Preferred route |
|---|---|---|
| `fast` | low latency | Groq, Cerebras, Gemini, OpenAI, Ollama |
| `reasoning` | deeper planning | Anthropic, OpenAI, Gemini, OpenRouter, Ollama |
| `coding` | implementation help | Anthropic, OpenAI, OpenRouter, Gemini, Ollama |
| `summarization` | cheap speed | Groq, Cerebras, Gemini, OpenAI, Ollama |
| `research` | breadth and context | OpenAI, Anthropic, Gemini, OpenRouter, Ollama |
| `planning` | structured next steps | Anthropic, OpenAI, Gemini, OpenRouter, Ollama |
| `music` | music-domain reasoning | OpenAI, Anthropic, Gemini, OpenRouter, Ollama |
| `security_review` | conservative review | Anthropic, OpenAI, Gemini, OpenRouter, Ollama |
| `council` | multi-model critique | OpenRouter Fusion, Anthropic, OpenAI, Gemini, Ollama |

## Failover Rules

1. Never show an unconfigured provider as connected.
2. Retry only on retryable failures: rate limit, timeout, or server error.
3. Do not retry unsafe tool calls automatically.
4. Do not escalate from free to paid provider unless the route policy permits it.
5. Prefer local Ollama for private notes when quality risk is acceptable.
6. Record the selected provider, reason, retry count, and fallback chain without logging secrets.

LiteLLM's router documents retries, fallbacks, cooldowns, timeouts, deployment ordering, and load balancing as first-class routing concepts. CopelandOS should implement a smaller version of those ideas rather than depending on ad hoc provider loops. Source: [LiteLLM router docs](https://docs.litellm.ai/docs/routing).

## OpenRouter and Council Mode

OpenRouter's `openrouter/auto` can select a model based on prompt complexity and return which model answered. This is useful for "AI council" or mixed workloads, but CopelandOS should still:

- constrain allowed model families when privacy or budget matters,
- log the selected model,
- avoid using auto routing for reproducibility-sensitive tasks,
- keep council output draft-only until reviewed.

Source: [OpenRouter Auto Router docs](https://openrouter.ai/docs/guides/routing/routers/auto-router).

## Ollama Local Fallback

Ollama exposes a local API at `http://localhost:11434/api` by default. CopelandOS should use it only when `OLLAMA_BASE_URL` is configured and validated as an HTTP(S) URL with no embedded credentials.

Source: [Ollama API introduction](https://docs.ollama.com/api/introduction).

## Next Implementation Tasks

1. Add a `routePolicy` object to each task type: privacy floor, max cost tier, tool-call requirement, and council eligibility.
2. Add provider health checks that are separate from static env-var configuration.
3. Add structured route telemetry that redacts prompts and secrets.
4. Add test cases for budget guard behavior.
5. Add test cases for local fallback URL validation.
6. Add a no-subscription mode that only selects free-tier providers and local fallback.
7. Add council result synthesis that clearly labels model disagreement and unsupported claims.
