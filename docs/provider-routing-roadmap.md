# Provider Routing Roadmap

CopelandOS should route AI work across multiple providers without locking into one subscription, spending unexpectedly, or faking readiness.

## What Works Now

- `config/providers.json` lists provider strengths, cost tiers, privacy tiers, and fallback order.
- `src/providerRouter.js` can choose the first configured provider for a task profile.
- `/api/providers`, `/api/providers/route`, `/api/providers/local-fallback`, and `/api/providers/no-subscription` expose safe routing state.
- `/api/status` reports model provider configuration without live claims.

## Routing Principles

- `configured` means an expected environment variable exists.
- `connected` should require an explicit health check or successful request.
- Free-tier and local providers should be preferred for low-risk tasks.
- Paid providers should be selected for reasoning, coding, security review, or council tasks only when configured.
- Provider errors should fall back to the next configured provider, not to an arbitrary hidden provider.
- Budget rules should be visible in config, tests, and UI.

## Task Routing

| Task Type | Preferred Route | Notes |
| --- | --- | --- |
| `fast` | Groq, Cerebras, Gemini Flash, OpenAI, Ollama | For capture enrichment and short summaries. |
| `reasoning` | Anthropic, OpenAI, Gemini Flash, OpenRouter, Ollama | For planning and decisions. |
| `coding` | Anthropic, OpenAI, OpenRouter, Gemini Flash, Ollama | For implementation prompts and code review. |
| `research` | OpenAI, Anthropic, Gemini Flash, OpenRouter, Ollama | For cited research notes. |
| `security_review` | Anthropic, OpenAI, Gemini Flash, OpenRouter, Ollama | For high-risk change review. |
| `council` | OpenRouter Fusion, Anthropic, OpenAI, Gemini Flash, Ollama | Scaffold until budgets and providers are explicit. |
| `local_fallback` | Ollama | Privacy-first/offline fallback. |

## Inspiration

OpenRouter separates provider routing from model routing. It supports provider `order`, `only`, `ignore`, sorting, and fallback controls. That maps well to CopelandOS because we need to reason separately about "which model" and "which service/provider hosts it."

Source: <https://openrouter.ai/docs/guides/routing/provider-selection.mdx>

LiteLLM documents router load balancing, retries, cooldowns, ordered fallback chains, and proxy-level reliability. CopelandOS can use those ideas without introducing LiteLLM as a dependency yet.

Sources:

- <https://docs.litellm.ai/docs/routing>
- <https://docs.litellm.ai/docs/proxy/load_balancing>
- <https://docs.litellm.ai/docs/proxy/reliability>

Ollama exposes local APIs at `http://localhost:11434/api` by default and supports `/api/generate` and `/api/chat`. CopelandOS should use Ollama only through explicit local configuration such as `OLLAMA_BASE_URL`.

Source: <https://docs.ollama.com/api>

## Proposed Router Additions

1. Health checks:
   - Add opt-in `/api/providers/health` for configured providers.
   - Keep `connected: false` until a provider responds successfully.
   - Cache health briefly to avoid dashboard-triggered cost or rate spikes.

2. Fallback chains:
   - Return `primary`, `fallbacks`, `unconfigured`, and `budgetGuard` for every routing decision.
   - Track retry reasons without exposing provider error bodies.
   - Stop after the configured `maxRetries`.

3. Budget tiers:
   - Add request-level hints: `free-only`, `local-only`, `standard`, and `council`.
   - Block council mode unless a budget guard is acknowledged.
   - Show expected cost tier before a live call.

4. Privacy routing:
   - Prefer Ollama for private drafts, personal notes, or sensitive summaries.
   - Block provider calls when a task is tagged as private unless explicitly confirmed.

5. Structured output:
   - Prefer providers that support structured output for classifier/planner tasks.
   - Fall back to deterministic parsing if structured output is unavailable.

## Test Plan

- Provider with missing env is `configured: false` and `connected: false`.
- Provider with env is `configured: true` but still not live-connected without health.
- Routing selects the first configured provider in task order.
- Fallbacks list only configured providers after the primary.
- Free-only routing never selects paid-only providers.
- Local fallback reports Ollama as not running unless configured.
- Provider errors never expose upstream error bodies that may contain sensitive data.

## Safety Notes

- Do not store API keys in config or docs.
- Do not add arbitrary shell execution for Ollama startup.
- Do not deploy provider health checks automatically.
- Do not hide failed provider routing behind fabricated success.
- Do not send email or perform external writes from AI responses.
