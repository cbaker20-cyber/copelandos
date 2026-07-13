# Free Provider Pool

CopelandOS routes AI tasks across multiple providers so you are not locked into one paid subscription. Provider selection is **policy-driven** from `config/providers.json` and environment configuration — never from hardcoded keys.

## Known free and low-cost categories

| Provider | Category | Typical use |
|---|---|---|
| Groq | Free-tier cloud | Fast classification, summarization, coding prompts |
| Cerebras | Free-tier cloud | Ultra-fast inference, idea capture classification |
| Gemini (free tier) | Free-tier cloud | Research, reasoning, multimodal tasks |
| OpenRouter (free models) | Free-tier cloud | Coding and reasoning without a paid plan |
| Ollama | Local fallback | Offline or privacy-first tasks when running locally |
| Puter.js / browser-side | Browser-side (if applicable) | Optional client-side inference; not wired in foundation |
| **FreeBuff** | **Placeholder** | Exact link and setup details are **pending** — do not treat as available |

## FreeBuff placeholder

`FreeBuff` is reserved as a provider family name only. CopelandOS reports:

```json
"freebuff": {
  "id": "freebuff",
  "status": "not_configured",
  "note": "Placeholder provider family. Exact link and setup details are pending."
}
```

Do not claim FreeBuff availability until an official integration spec exists and is tested.

## Policy rules

1. **Never hardcode API keys** in source, config committed to Git, or dashboard responses
2. **Show unavailable providers honestly** — `not_configured`, `mock_mode`, or `unavailable`
3. **Prefer free tiers** for routing when task constraints allow
4. **Fall back to Ollama** for local/offline or privacy-tier tasks when `OLLAMA_BASE_URL` is set
5. **Paid providers** (Anthropic, OpenAI) are fallbacks, not requirements

## Task-based priority

Routing strategy in `config/providers.json` selects providers by task type:

| Task type | Priority intent |
|---|---|
| `coding` | Coding prompt generation — Anthropic, OpenAI, OpenRouter free, Gemini |
| `summarization` | Fast summarization — Groq, Cerebras, Gemini |
| `fast` | Fast classification — Groq, Cerebras |
| `planning` / `reasoning` | Long-context planning — Anthropic, OpenAI, Gemini, OpenRouter |
| `local_fallback` | Offline fallback — Ollama only |
| `security_review` | Security-sensitive review — Anthropic, OpenAI first |

The provider router (`src/providerRouter.js`) picks the **first configured** provider in the route that matches task constraints. If none are configured, it returns an explicit error — never a fake success.

## Status reporting

`GET /api/integrations/status` includes `free_provider_pool` with:

- `configuredCount` / `totalFreeProviders`
- Per-provider `not_configured` or `configured` entries
- `freebuff` placeholder status (always `not_configured` until spec exists)
- `partial: true` when some but not all free providers have keys

## Environment variables (examples)

Set only in Cloudflare secrets or local `.dev.vars` — never commit:

- `GROQ_API_KEY` / `GROQ_KEY`
- `CEREBRAS_API_KEY` / `CEREBRAS_KEY`
- `GEMINI_API_KEY` / `GEMINI_KEY`
- `OPENROUTER_API_KEY` / `OPENROUTER_KEY`
- `OLLAMA_BASE_URL`

Missing keys produce `not_configured` or `mock_mode` in status responses. The dashboard must not show green “connected” badges without configured keys.
