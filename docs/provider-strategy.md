# CopelandOS Provider Strategy

CopelandOS is designed to avoid single-subscription lock-in. The multi-provider router selects the best available AI provider for each task type, falls back gracefully when providers are unavailable, and always represents a local Ollama fallback — even if it is not currently running.

## Design principles

1. **No single subscription dependency** — Keep multiple paid, free-tier, and local routes available instead of depending on one subscription.
2. **No fake connections** — A provider is only shown as "configured" when the required environment variable is present. Never fake a connection.
3. **Local fallback always available** — Ollama is always represented as a fallback option even if not running.
4. **Rate-limit aware** — Route decisions can avoid providers marked as rate-limited and return retry/fallback metadata for callers.
5. **Budget aware** — Request profiles can require free/no-paid routes or a maximum cost tier.
6. **Tool-support aware** — Routes that require tool calling or structured output filter providers that lack those capabilities.

## Provider inventory (`config/providers.json`)

| Provider | Type | Cost tier | Speed | Tool calling | Privacy |
|---|---|---|---|---|---|
| OpenRouter (free) | cloud | free | medium | no | cloud |
| OpenRouter Fusion | cloud | pay-per-token | slow | yes | cloud |
| Groq | cloud | free-tier | fast | yes | cloud |
| Cerebras | cloud | free-tier | ultra-fast | no | cloud |
| Gemini Flash | cloud | free-tier | fast | yes | cloud |
| Anthropic (Claude) | cloud | pay-per-token | medium | yes | cloud |
| OpenAI | cloud | pay-per-token | medium | yes | cloud |
| Ollama | local | free | slow | no | local |
| LiteLLM | gateway | depends | depends | yes | depends |

## Routing strategy

Each task type has an ordered fallback chain. The router picks the first configured provider that also satisfies the task constraints:

- **fast**: Groq → Cerebras → Gemini → OpenAI → Ollama
- **reasoning**: Anthropic → OpenAI → Gemini → OpenRouter → Ollama
- **coding**: Anthropic → OpenAI → OpenRouter → Gemini → Ollama
- **summarization**: Groq → Cerebras → Gemini → OpenAI → Ollama
- **research**: OpenAI → Anthropic → Gemini → OpenRouter → Ollama
- **planning**: Anthropic → OpenAI → Gemini → OpenRouter → Ollama
- **music**: OpenAI → Anthropic → Gemini → OpenRouter → Ollama
- **security_review**: Anthropic → OpenAI → Gemini → OpenRouter → Ollama
- **council**: OpenRouter Fusion → Anthropic → OpenAI → Gemini → Ollama
- **local_fallback**: Ollama

## No-subscription routes

The following providers have free tiers that work without a paid subscription (account registration required):
- Groq (`GROQ_API_KEY`)
- Cerebras (`CEREBRAS_API_KEY`)
- Gemini Flash (`GEMINI_API_KEY`)
- OpenRouter free models (`OPENROUTER_API_KEY`)
- Ollama (local, no key required)

`POST /api/providers/route` accepts optional constraints:

- `requiresToolCalling`
- `requiresStructuredOutput`
- `privacy: "local-only"`
- `maxCostTier`
- `noPaidProviders`
- `avoidProviders`
- `rateLimitedProviders`

## Failover policy

- Maximum 2 retries per task
- Retry on: rate-limited (429), timeout, server error (5xx)
- Never spend above the cheapest configured cost tier unless council mode is active
- Always fall back to Ollama if all cloud providers fail (when running)

## API endpoints

- `GET /api/providers` — List all providers with honest connection status
- `POST /api/providers/route` — Get routing decision for a task type
- `GET /api/providers/local-fallback` — Get Ollama fallback status
- `GET /api/providers/no-subscription` — Get routes available without paid subscription

## Implementation

`src/providerRouter.js` — Pure routing logic, no actual API calls. Wraps `config/providers.json`.
