# Provider Routing Roadmap

CopelandOS provider routing exists to avoid single-subscription dependency and to keep model usage honest. The router should select only configured providers, explain fallback chains, preserve a local Ollama option, and escalate to an AI council only when the task benefits from multiple roles.

## What Works Now

- `config/providers.json` lists cloud, gateway, and local providers.
- `src/providerRouter.js` selects the first configured provider for a task type.
- `GET /api/providers` returns provider status without fake connections.
- `POST /api/providers/route` explains selected provider, fallback chain, configured providers, and local fallback.
- `GET /api/providers/no-subscription` lists configured free-tier options.
- `GET /api/integrations` now shows the provider router in the command-center integration registry.

## Routing Principles

1. Free-tier and local options first when quality is adequate.
2. Paid providers only when the configured route and task risk justify it.
3. Tool-calling routes prefer providers that support tools.
4. Research and privacy-sensitive tasks must be explicit about cloud routing.
5. Ollama is a local fallback, not proof that a local model server is running.
6. Council mode is for complex, ambiguous, or high-risk planning; it is not the default.

## Inspiration

LiteLLM documents routing concepts such as fallbacks, retries, timeouts, cooldowns, and load balancing. OpenRouter documents provider preferences such as explicit provider order, fallback controls, provider filtering, and price/throughput/latency sorting. CopelandOS should use those ideas conservatively through its own audited config rather than dynamically enabling arbitrary providers.

## Proposed Profiles

| Profile | Preferred route | Escalation rule |
|---|---|---|
| `fast` | Groq, Cerebras, Gemini, OpenAI, Ollama | Use for quick summaries and classification |
| `coding` | Anthropic, OpenAI, OpenRouter, Gemini, Ollama | Add security reviewer role for risky code |
| `planning` | Anthropic, OpenAI, Gemini, OpenRouter, Ollama | Escalate to council when plan touches multiple repos |
| `music` | OpenAI, Anthropic, Gemini, OpenRouter, Ollama | Preserve musical constraints and MusicXML safety |
| `security_review` | Anthropic, OpenAI, Gemini, OpenRouter, Ollama | Require explicit risk notes |
| `local_fallback` | Ollama | Use when privacy or offline work matters more than model quality |

## Next Config Fields

Future provider entries can add:

- `maxDailyCostUsd`
- `requiresHumanApprovalAboveCostTier`
- `dataRetentionTier`
- `toolUsePolicy`
- `rateLimitPolicy`
- `lastHealthProbe`
- `supportsVision`
- `supportsMusicXmlReasoning`

These fields should be read-only metadata until there are tests and UI labels for each.

## Council Routing

Council mode should assemble roles before choosing providers:

```text
task risk/category
  -> role set
  -> provider route per role
  -> budget/privacy preflight
  -> prompt generation
  -> merged plan with disagreements
```

Council mode may use OpenRouter Fusion or multiple configured providers, but only when each provider is honestly configured and the UI shows which providers are involved.

## Tests To Maintain

- No provider is marked connected solely because it appears in config.
- Legacy env keys continue to work where documented.
- `Ollama` appears as local fallback but not as a fake running service.
- Unknown task profiles fall back to reasoning routes safely.
- Free-tier route messages remain useful when no free provider is configured.
- Integration status summaries do not leak env var values.

## Non-Goals

- No automatic provider signup.
- No scraping provider dashboards.
- No storing prompts/completions in the repo.
- No routing private student data to cloud providers.
- No claims that LiteLLM gateway behavior exists until a gateway is configured, tested, and documented.
