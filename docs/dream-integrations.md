# CopelandOS Dream Integrations

CopelandOS should become a mobile-first command center without becoming an unsafe autopilot. The system can capture intent from the phone, classify it, plan it, route model work, write safe memory, generate implementation prompts, and surface draft PR/review status. It must not send email, merge code, deploy, delete files, store private student data, or claim a provider/tool is connected without evidence.

## Reference Architecture

```text
phone / Siri / Shortcut / share sheet
  -> CopelandOS inbox
  -> classifier
  -> planner
  -> provider router or AI council
  -> safe tool and MCP registry
  -> Obsidian memory
  -> Cursor / Codex task prompt
  -> draft PR
  -> review status back into CopelandOS
```

## Integration Registry

`config/integrations.json` is the source of truth for command-center integrations. It lists each surface, allowed actions, blocked actions, connection mode, and privacy notes.

Current registry surfaces:

| Integration | Status | Role |
|---|---|---|
| iPhone Shortcuts and Widgets | scaffolded | Mobile capture through Shortcuts, widgets, and share sheet workflows |
| CopelandOS Idea Inbox | active | Stores captured ideas and supports triage |
| Provider Router | active | Selects configured providers and explains fallbacks |
| Tool and MCP Allowlist Registry | active | Blocks unknown tools, unsafe tool actions, and inactive MCP servers |
| Obsidian Git Vault | scaffolded | Private memory writes and Obsidian URI helpers |
| Cursor and Codex Task Queue | scaffolded | Generates reviewed implementation prompts |
| Morning Report and Project Status | planned | Read-only status digest for projects, checks, blockers, and reviews |

API:

- `GET /api/integrations`
- `GET /api/integrations?category=capture`
- `POST /api/integrations/check`
- `GET /api/status` includes an integration summary

## Inspiration Sources

- Apple Shortcuts documents shortcuts as multi-step actions and supports running Shortcuts from widgets on iPhone and iPad: [Shortcuts User Guide](https://support.apple.com/guide/shortcuts/welcome/ios), [Shortcuts widgets](https://support.apple.com/guide/shortcuts/run-a-shortcut-from-a-widget-apd029b36d05/ios).
- Obsidian Git provides automatic commit-and-sync workflow patterns for a Markdown vault: [Vinzent03/obsidian-git](https://github.com/Vinzent03/obsidian-git).
- MCP tools are model-controlled, but the MCP docs recommend visible exposed tools and human confirmation for sensitive operations: [MCP tools docs](https://modelcontextprotocol.io/docs/concepts/tools).
- LiteLLM routing references fallbacks, retries, timeouts, cooldowns, and load balancing: [LiteLLM routing](https://docs.litellm.ai/docs/routing).
- OpenRouter provider routing supports ordered providers, fallback controls, provider filtering, and price/throughput/latency sorting: [OpenRouter provider routing](https://openrouter.ai/docs/features/provider-routing).
- Local model fallback should stay privacy-first and honest about whether a local server is actually running: [Ollama](https://ollama.com/).

These sources are architectural inspiration only. CopelandOS should not copy UI, assets, code, or brand style from third-party products.

## Safety Rules

- CORS remains restricted to the exact configured `ALLOWED_ORIGIN`.
- CORS is not authentication.
- Gmail remains draft-only.
- Unknown MCP servers and unknown tools are blocked.
- Scaffold-only integrations are not shown as connected.
- No autonomous email send, deploy, PR merge, file deletion, screen control, or arbitrary shell execution.
- No private student data in vault writes or project reports.
- No secrets or OAuth tokens in captured ideas, vault notes, reports, or PR bodies.

## Implementation Phases

1. Stabilize capture and registry visibility.
2. Add mobile Shortcut/share sheet recipes and dashboard quick capture.
3. Add project-aware classifier outputs for CopelandOS, Score Scanner, Band Council, JazzBackend, and Connectome.
4. Add morning report generation from local project registry and explicit GitHub read summaries.
5. Add Obsidian memory handoff after content safety checks.
6. Add task-queue status cards for draft PRs and review blockers.
7. Add provider budget controls and council escalation reasons.

## Non-Goals

- No Marvel/Jarvis assets or copied UI.
- No fake connected states.
- No live tool execution through MCP until each server and action is reviewed.
- No unsupported claims that sibling projects have implemented features that are still only plans.
