# CopelandOS Provider Strategy

## Philosophy

CopelandOS is designed to work without any single paid subscription. It supports a tiered strategy from free/local providers up to paid APIs, with honest status reporting — no provider is claimed as connected unless the required env var is set.

## Provider Tiers

### Tier 1: Free / Local (no subscription required)

| Provider | Env Var | Strengths | Privacy |
|---|---|---|---|
| **Groq** | `GROQ_API_KEY` / `GROQ_KEY` | Fast inference, coding, drafts | Cloud |
| **Cerebras** | `CEREBRAS_API_KEY` / `CEREBRAS_KEY` | Very fast, coding, drafts | Cloud |
| **OpenRouter (free models)** | `OPENROUTER_API_KEY` | Council routing, general, coding | Cloud |
| **Gemini 2.5 Flash** | `GEMINI_API_KEY` / `GEMINI_KEY` | Long context, research, analysis | Cloud |
| **Ollama (local)** | `OLLAMA_BASE_URL` | Privacy, offline, no API key | Local |

### Tier 2: Paid (provider credit / student credit)

| Provider | Env Var | Strengths |
|---|---|---|
| **OpenAI GPT-4o** | `OPENAI_API_KEY` | Best general-purpose |
| **Anthropic Claude** | `ANTHROPIC_API_KEY` | Reasoning, security review |

## Routing Logic

Defined in `config/providers.json` and implemented in `src/providerRouter.js`.

### Default preference order
`groq → cerebras → openrouter → gemini → openai → anthropic → ollama`

### Task-specific preference
- **Coding:** `openai → anthropic → openrouter → groq → cerebras`
- **Research:** `gemini → anthropic → openai → openrouter`
- **Council:** `openrouter → groq → cerebras → gemini`
- **Privacy:** `ollama`

### Routing rules
1. Check env vars — never claim a provider is connected without the key
2. Check task-specific strengths (e.g., tool calling, structured output)
3. Select the first configured provider in preference order
4. If nothing is configured, return `ok: false` with local fallback info and no-subscription options

## OpenRouter Council Mode

OpenRouter supports multi-model routing ("Fusion-style") through its API. When council mode is active and `OPENROUTER_API_KEY` is set, different roles can be dispatched to different free models through a single API key.

## Local Fallback (Ollama)

Even if Ollama is not running, the router always returns an Ollama entry in the fallback chain with setup instructions. This ensures the system is transparent about local options without claiming they're available when they're not.

```js
// Example local fallback
{
  provider: 'ollama',
  configured: false,
  offline: true,
  status: 'not configured — set OLLAMA_BASE_URL to enable',
  instructions: 'Install Ollama locally: https://ollama.ai'
}
```

## API Endpoint

```
GET /api/providers?taskType=coding
```

Returns all provider statuses, the selected provider, and the full fallback chain.

## Safety Guarantees

- No provider is selected unless its env var is set
- No API call is made to a provider that is not configured
- Rate limit errors are caught and the next fallback is tried
- Budget-aware routing: free-tier providers are tried first by default
- Privacy routing: Ollama can be specified for privacy-sensitive tasks

## Student / Credit Strategy

1. Start with Groq or Cerebras free tier (no credit card required)
2. Add OpenRouter free-tier models for council/multi-model
3. Use Gemini free tier for long-context research
4. Apply for OpenAI or Anthropic student credits when needed
5. Run Ollama locally for privacy-sensitive tasks

## Future Enhancements

- Rate-limit-aware retry with exponential backoff
- Cost tracking per provider
- Budget alerts
- LiteLLM gateway support for unified routing
- Model quality scoring per task type
