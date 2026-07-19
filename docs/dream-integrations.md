# CopelandOS Dream Integrations

CopelandOS should become a phone-first command center that captures ideas, turns them into safe plans, routes model work through configured providers, writes durable memory, and returns review status. The important boundary is honesty: disconnected systems must say they are disconnected.

## Target architecture

```text
phone / Siri / Shortcut / share sheet
  -> CopelandOS inbox
  -> classifier
  -> planner
  -> provider router or AI council
  -> safe tool / MCP registry
  -> Obsidian memory
  -> Cursor / Codex task prompt
  -> draft PR
  -> review status back into CopelandOS
```

## What works now

- `POST /api/capture/idea` captures ideas into the CopelandOS inbox.
- `src/ideaClassifier.js` classifies captured ideas with deterministic rules.
- `src/planner.js` creates reviewable plans and task briefs.
- `src/providerRouter.js` and `src/modelRouter.js` select only configured providers.
- `src/toolRegistry.js` and `config/mcp-servers.json` enforce allowlist-first tool safety.
- `src/vault.js` can create safe Obsidian-style notes and returns mock previews when the private vault is not configured.
- `config/integrations.json` and `src/integrationRegistry.js` define an integration map without activating external systems.

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

## Reference patterns

- Apple App Shortcuts/App Intents can expose app actions to Siri, Spotlight, widgets, and Shortcuts when a native app exists.
- Model Context Protocol hosts need consent, access control, and tool safety because tools can represent arbitrary code execution.
- Provider routers such as OpenRouter or LiteLLM separate fallback and retry policy from the application safety layer.
- Obsidian Git and mobile Git-sync tools are useful references for vault workflows, but CopelandOS should not depend on them being present.

## Safety rules

- Do not store private student data in the vault or dashboard.
- Do not send email; Gmail remains draft-only.
- Do not merge PRs, deploy, delete files, install MCP servers, run arbitrary shell, or control the screen.
- Do not expose upstream provider error bodies that may contain sensitive data.
- Do not show a provider, tool, vault, GitHub connector, or mobile integration as connected without a real tested connector.
- Keep CORS restricted to the exact configured `ALLOWED_ORIGIN`; CORS is not authentication.

## Next build steps

1. Add a capture-only token for mobile Shortcuts.
2. Add a private vault connector with narrow repository permissions.
3. Add a read-only GitHub supervisor for draft PR and check status.
4. Add a morning report view that summarizes inbox, tasks, PRs, checks, blockers, and safety notes.
