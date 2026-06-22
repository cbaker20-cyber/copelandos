# Dream Integrations

CopelandOS should feel like a mobile-first command center without pretending every connector is live. The near-term architecture is:

```text
iPhone / Siri / Shortcut / share sheet
  -> CopelandOS inbox
  -> deterministic classifier
  -> planner / AI council when needed
  -> provider router
  -> safe tool and MCP registry
  -> Obsidian Git memory
  -> Cursor or Codex task prompt
  -> draft PR
  -> review status back into CopelandOS
```

## Current Foundation

- `POST /api/capture/idea` accepts safe idea capture from dashboard, Siri, Shortcuts, mobile web, and manual sources.
- `src/ideaClassifier.js` classifies ideas with deterministic rules before any AI layer is added.
- `src/planner.js`, `/api/plan`, `/api/plan/brief`, and `/api/council` scaffold planning and mock council review.
- `src/providerRouter.js` and `src/modelRouter.js` route only to configured providers and keep local Ollama as an explicit fallback.
- `config/tools.json`, `config/mcp-servers.json`, and `src/toolRegistry.js` enforce allowlist-first tool/MCP behavior.
- `src/vault.js` can create Obsidian-ready notes and mock vault writes unless a private GitHub vault is configured.
- `config/integrations.json` is the registry for integration stages, endpoints, allowed actions, blocked actions, and required env vars.

## Integration Ideas

| Integration | User experience | Safe first step | Boundary |
|---|---|---|---|
| Siri idea capture | "Hey Siri, capture Copeland idea..." | Shortcut posts text to `/api/capture/idea` | Text only; no private student data |
| Share sheet capture | Send URLs, snippets, and notes from any app | Shortcut limits accepted input types | Store source metadata and URL, not full private content by default |
| Home Screen widget | One-tap capture, morning report, inbox count | Widget runs a local Shortcut | Widget shows scaffolded status unless Worker confirms data |
| Obsidian memory | Captured ideas become daily notes, project notes, or decision logs | `/api/vault/write` preview or private GitHub write | Never make vault public; reject obvious secrets |
| Cursor/Codex queue | Turn triaged idea into scoped implementation prompt | Generate prompt with repo, forbidden actions, and PR requirement | Does not execute IDE actions |
| Draft PR supervisor | Show PRs, checks, and review needs | Read-only GitHub summary route | No merge, deploy, ready-for-review, or branch deletion |
| Morning report | "What changed overnight?" | Draft Obsidian daily note from inbox/project/PR summaries | No email send; no unsupported completion claims |

## Inspiration And Sources

- Apple documents running Shortcuts from URL schemes with `shortcuts://run-shortcut?name=...&input=...&text=...` and running Shortcuts from widgets. CopelandOS should use that pattern for phone-local capture setup, not background execution claims. Sources: [Apple Shortcuts URL scheme](https://support.apple.com/guide/shortcuts/run-a-shortcut-from-a-url-apd624386f42/ios), [Apple Shortcuts widgets](https://support.apple.com/guide/shortcuts/run-shortcuts-from-the-home-screen-widget-apd029b36d05/ios).
- Apple also documents limiting Shortcut input types. The share-sheet workflow should restrict inputs to text, URLs, and clipboard content. Source: [Apple Shortcuts input types](https://support.apple.com/guide/shortcuts/input-types-apd7644168e1/ios).
- MCP security guidance emphasizes least privilege, consent, scope minimization, and tool filtering. CopelandOS should keep explicit allowlists and blocked actions in config before any server is installed. Sources: [MCP authorization](https://modelcontextprotocol.io/docs/tutorials/security/authorization), [MCP security best practices](https://modelcontextprotocol.io/docs/tutorials/security/security_best_practices).
- LiteLLM documents retries, fallbacks, cooldowns, and ordered routing. CopelandOS should mirror the concept at the policy layer while keeping actual provider calls test-backed before enabling them. Sources: [LiteLLM routing](https://docs.litellm.ai/docs/routing), [LiteLLM fallbacks](https://docs.litellm.ai/docs/proxy/reliability).
- Ollama documents a local API served by default on localhost. CopelandOS should treat Ollama as a privacy-preserving local fallback only when `OLLAMA_BASE_URL` is configured and reachable. Source: [Ollama API](https://docs.ollama.com/api/generate).

## Non-Goals

- No Jarvis/Marvel assets, voices, or copied UI.
- No automatic email sending.
- No arbitrary shell execution or screen control.
- No provider/tool connected states without evidence.
- No storage of private student data.
