# Provider Routing Roadmap

CopelandOS should route AI work by task type, cost, risk, privacy, and provider availability. The current implementation is deliberately conservative: it selects the first configured provider in a route and reports clear errors when nothing is configured. Future failover should be added with tests before live retries are enabled.

## Current Implementation

Files:

- `config/providers.json`
- `src/providerRouter.js`
- `test/provider-router.test.js`
- `config/models.json`
- `src/modelRouter.js`
- `test/model-router.test.js`

Working behavior:

- Providers are shown as configured only when the expected env var is present.
- The router returns `ok: false` when no provider is configured.
- Free/no-subscription route metadata is available.
- Ollama is represented as local fallback, but not marked running unless `OLLAMA_BASE_URL` is configured.
- Council providers are selected only from configured providers.
- Provider status never returns API keys.

## Route Profiles

| Task type | Default route intent | Notes |
|---|---|---|
| `fast` | Groq, Cerebras, Gemini, OpenAI, Ollama | Mobile capture classification and quick summaries |
| `reasoning` | Anthropic, OpenAI, Gemini, OpenRouter, Ollama | Complex planning and review |
| `coding` | Anthropic, OpenAI, OpenRouter, Gemini, Ollama | Cursor/Codex prompt generation and implementation review |
| `summarization` | Groq, Cerebras, Gemini, OpenAI, Ollama | Morning reports and PR summaries |
| `research` | OpenAI, Anthropic, Gemini, OpenRouter, Ollama | Citation-heavy notes and project research |
| `planning` | Anthropic, OpenAI, Gemini, OpenRouter, Ollama | Multi-step tasks and overnight control loop |
| `music` | OpenAI, Anthropic, Gemini, OpenRouter, Ollama | JazzBackend, MusicXML, harmony/rhythm tasks |
| `security_review` | Anthropic, OpenAI, Gemini, OpenRouter, Ollama | Auth, CORS, permission, secret handling |
| `council` | OpenRouter Fusion, Anthropic, OpenAI, Gemini, Ollama | Multi-role synthesis only when configured |

## Inspiration

OpenRouter model fallback docs describe ordered model arrays that can retry on downtime, rate limits, context errors, and moderation refusals. They also distinguish model-level fallbacks from provider-level failover:

- https://openrouter.ai/docs/guides/routing/model-fallbacks
- https://openrouter.ai/blog/insights/reliability-failover/

LiteLLM documents Router-based load balancing, fallbacks, retries, cooldowns, and routing strategies:

- https://docs.litellm.ai/docs/proxy/reliability
- https://berriai-litellm.mintlify.app/sdk/router

Ollama is useful for a local/private fallback, but CopelandOS must not assume a Cloudflare Worker can reach a user's laptop localhost. Local fallback belongs behind the reviewed local-agent/pairing architecture:

- https://github.com/ollama/ollama-python

## Desired Decision Inputs

Future routing decisions should include:

- `taskType`: fast, coding, research, planning, music, security_review, etc.
- `riskLevel`: safe, medium, high.
- `privacyTier`: public, project-private, personal-private, student-private.
- `budgetTier`: free-only, low-cost, paid-ok, council-ok.
- `latency`: realtime, interactive, batch.
- `toolCallingRequired`: true/false.
- `structuredOutputRequired`: true/false.
- `contextTier`: short, medium, long.
- `localPreferred`: true/false.

## Failover Policy

Add failover only after mocks prove the behavior. The safe target:

1. Try the first configured provider.
2. Retry at most `maxRetries` for transient errors.
3. Fail over only on explicit retryable classes:
   - 429/rate-limited.
   - timeout.
   - 5xx/server-error.
4. Do not retry on:
   - auth failure.
   - malformed prompt.
   - policy/safety refusal.
   - unsupported tool call.
5. Log provider ID, model alias, task type, and error class, but not prompt secrets or full upstream bodies.
6. Return the actual provider/model used.
7. For paid escalation, require task profile policy and show why.

## AI Council

Council mode is for tasks that benefit from multiple roles: security, architecture, UX, tests, and domain review. It should not multiply cost by default.

Safe council stages:

1. **Mock council now**: create role prompts and mock role outputs for planning.
2. **Single-provider council later**: one configured provider simulates multiple roles.
3. **Multi-provider council after tests**: route roles across configured providers with budget caps.
4. **OpenRouter Fusion style routing**: optional route when `OPENROUTER_API_KEY` is configured and a budget policy permits it.

Council must never:

- Send tools directly.
- Merge PRs.
- Deploy.
- Send emails.
- Store private student data.
- Claim external reviewers approved work.

## Local Ollama Fallback

Ollama can be valuable for private/offline tasks:

- Drafting project plans.
- Summarizing local notes.
- Reviewing non-sensitive code snippets.
- Brainstorming music/project ideas.

Constraints:

- `OLLAMA_BASE_URL` is only a configuration hint.
- Worker-to-localhost is not generally possible.
- The local agent must authenticate, be allowlisted, and never expose arbitrary shell.
- Lower model quality means local fallback should label uncertainty.

## API Roadmap

Existing:

- `GET /api/providers`
- `POST /api/providers/route`
- `GET /api/providers/local-fallback`
- `GET /api/providers/no-subscription`
- `POST /api/ai/route`

Proposed:

- `POST /api/providers/explain`: richer route explanation with budget/privacy inputs.
- `POST /api/providers/simulate-failover`: test-only route using mocked provider outcomes.
- `GET /api/providers/policy`: public route policy without secrets.
- `POST /api/council/plan`: council prompt bundle without live provider calls.
- `POST /api/council/execute`: future, env-gated, budget-gated, tool-free live synthesis.

## Tests To Add Before Live Failover

- Selects first configured provider for each task type.
- Falls back on mocked 429.
- Falls back on mocked timeout.
- Does not fall back on mocked auth failure.
- Does not expose upstream error body.
- Does not mark unconfigured providers as configured.
- Does not call paid provider when `budgetTier` is `free-only`.
- Keeps Ollama `connected: false` unless an actual probe succeeds in the local-agent layer.
- Returns full fallback chain and selected provider ID.

## Dashboard UX

Render provider cards with:

- Provider name.
- Configured/not configured.
- Cost tier.
- Privacy tier.
- Tool calling support.
- Structured output support.
- "Not probed" status when applicable.
- Route order by task type.
- Local fallback warning when Worker cannot reach local services.

Avoid:

- Green "connected" badges from env vars alone.
- Hidden paid escalation.
- Suggesting local models are private if traffic leaves the local machine.
