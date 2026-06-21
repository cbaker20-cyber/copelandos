# CopelandOS Provider Strategy

CopelandOS is designed to avoid single-subscription lock-in. The multi-provider router selects the best available AI provider for each task type, falls back gracefully when providers are unavailable, and always represents a local Ollama fallback — even if it is not currently running.

## Design principles

1. **Free-tier first** — Prefer providers with free tiers (Groq, Cerebras, Gemini, OpenRouter) before paid providers.
2. **No fake connections** — A provider is only shown as "configured" when the required environment variable is present. Never fake a connection.
3. **Local fallback always available** — Ollama is always represented as a fallback option even if not running.
4. **Rate-limit aware** — The router returns ordered fallback chains for clients to use after 429/timeout/server-error responses.
5. **Budget aware** — `maxCostTier` can constrain routing so paid providers are skipped when the task should stay free-tier/local.
6. **Tool-support aware** — `requiresToolCalling` and `requiresStructuredOutput` skip providers that cannot satisfy the task profile.

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

Each task type has an ordered fallback chain. The router picks the first configured provider:

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

Example task profile:

```json
{
  "taskType": "coding",
  "requiresToolCalling": true,
  "requiresStructuredOutput": true,
  "maxCostTier": "free-tier"
}
```

If no matching provider has the required env var, the router returns `ok: false` with a clear `No provider configured` message and the local Ollama fallback representation.

## Implementation

`src/providerRouter.js` — Pure routing logic, no actual API calls. Wraps `config/providers.json`.
