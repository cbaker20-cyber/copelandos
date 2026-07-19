# CopelandOS Dream Integrations

CopelandOS should become a mobile-first command center that captures ideas from the phone, turns them into safe plans, routes model work through configured providers, writes durable memory, and returns review status without pretending tools are connected before they are.

## Target architecture

```text
phone / Siri / Shortcut / share sheet
  -> CopelandOS inbox
  -> classifier
  -> planner
  -> provider router or AI council
  -> safe tool / MCP registry
  -> Obsidian memory
  -> Cursor / Codex task
  -> draft PR
  -> review status back into CopelandOS
```

## What works now

- `GET` or `POST /api/capture/idea` captures ideas into the CopelandOS inbox.
- `src/ideaClassifier.js` classifies captured ideas with deterministic rules.
- `src/planner.js` creates reviewable plans and task briefs.
- `src/providerRouter.js` and `src/modelRouter.js` select only configured providers.
- `src/toolRegistry.js` and `config/mcp-servers.json` enforce allowlist-first tool and MCP safety.
- `src/vault.js` can create safe Obsidian-style notes and returns mock previews when the private vault is not configured.
- The dashboard is mobile-responsive and shows disconnected systems honestly.
- `config/integrations.json` and `src/integrationRegistry.js` define the command-center integration map without activating external systems.

## Proposed integrations

| Integration | Purpose | Current state | Safety boundary |
|---|---|---|---|
| iPhone Shortcuts | Dictate or share an idea into the inbox | Scaffolded | Capture only; no execution |
| Mobile widget | One-tap capture and morning status | Planned | Display and enqueue only |
| Obsidian Git vault | Durable private memory | Scaffolded | Mock unless private repo env is configured |
| Cursor/Codex task queue | Turn triaged ideas into scoped prompts | Scaffolded | Generate prompts only |
| Provider router | Route tasks by capability and configured credentials | Implemented | No fake configured or connected providers |
| AI council | Multi-role critique for complex plans | Mock/scaffolded | No claim of live multi-model consensus |
| Tool/MCP registry | Explicit allowlist and blocked actions | Implemented | Unknown tools fail closed |
| Draft PR workflow | Tested branches with draft PRs | Planned | No merge, deploy, or ready-for-review automation |
| Morning report | Overnight summary in dashboard/vault | Planned | Dashboard-first; email draft only |

## Inspiration and sources

- Apple App Shortcuts expose app actions to Siri, Spotlight, widgets, and Shortcuts when implemented through App Intents and `AppShortcutsProvider`: <https://developer.apple.com/documentation/appintents/app-shortcuts>
- The Model Context Protocol safety guidance says hosts must provide consent, access control, and tool safety because tools can represent arbitrary code execution: <https://modelcontextprotocol.io/specification/2025-06-18>
- OpenRouter describes provider-layer failover and model fallback arrays as separate reliability layers: <https://openrouter.ai/docs/guides/routing/model-fallbacks>
- LiteLLM documents router retries, load balancing, cooldowns, and fallbacks across model groups: <https://docs.litellm.ai/docs/router_architecture>
- Obsidian Git supports automatic commit-and-sync on desktop but warns that mobile support is unstable: <https://github.com/Vinzent03/obsidian-git>
- GitSync offers mobile Git sync triggers, widgets, and Siri Shortcuts for repository-backed notes: <https://gitsync.viscouspotenti.al/>

These are product and architecture references only. CopelandOS must not copy copyrighted UI, assets, icons, or branded fictional assistant designs.

## Safety rules

- Do not store private student data in the vault or dashboard.
- Do not send email; Gmail remains draft-only.
- Do not merge PRs, deploy, delete files, or install arbitrary MCP servers.
- Do not expose upstream provider error bodies that may contain sensitive data.
- Do not show a provider, tool, vault, GitHub connector, or external integration as connected without an actual connector/probe.
- Keep CORS restricted to the exact configured `ALLOWED_ORIGIN`; CORS is not authentication.
- Require `API_AUTH_TOKEN` or the scoped capture token where current protected routes demand it.

## Next build steps

1. Keep mobile capture scoped to idea intake through `CAPTURE_TOKEN` and route validation.
2. Add a private vault connector with narrow repository permissions.
3. Add a read-only GitHub supervisor for draft PR and check status.
4. Add a provider health probe endpoint that never sends user content.
5. Add a morning report view that summarizes inbox, tasks, PRs, checks, blockers, and safety notes.
