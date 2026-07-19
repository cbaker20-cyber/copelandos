# Dream Integrations

CopelandOS is moving toward a phone-first command center that captures intent, turns it into safe plans, routes model work through configured providers, writes durable memory, and returns review status. The roadmap is intentionally honest: config can describe an integration, but it cannot make that integration connected.

## Target pipeline

```text
phone / Siri / Shortcut / share sheet
  -> CopelandOS inbox
  -> classifier
  -> planner
  -> provider router or council
  -> safe tool / MCP registry
  -> Obsidian memory
  -> Cursor / Codex task prompt
  -> draft PR
  -> review status back into CopelandOS
```

## What works now

- `POST /api/capture/idea` captures ideas into the inbox.
- `src/ideaClassifier.js` classifies ideas with deterministic rules.
- `src/planner.js` creates reviewable plans and task briefs.
- `src/providerRouter.js` and `src/modelRouter.js` select only configured providers.
- `src/toolRegistry.js` and `config/mcp-servers.json` enforce allowlist-first tool safety.
- `src/vault.js` creates safe Obsidian-style notes and returns mock previews when no private vault is configured.
- `config/integrations.json` and `src/integrationRegistry.js` expose a read-only integration map without activating external systems.

## Proposed integrations

| Integration | Purpose | Current state | Safety boundary |
|---|---|---|---|
| iPhone Shortcuts | Dictate or share an idea into the inbox | Scaffolded | Capture only; no execution |
| Mobile widget | One-tap capture and morning status | Planned | Display and enqueue only |
| Obsidian Git vault | Durable private memory | Scaffolded | Mock unless private repo env is configured |
| Cursor/Codex task queue | Turn triaged ideas into scoped prompts | Scaffolded | Generate prompts only |
| Provider router | Route tasks by capability and configured credentials | Implemented | No fake provider connections |
| AI council | Multi-role critique for complex plans | Mock/scaffolded | No claim of live multi-model consensus |
| Tool/MCP registry | Explicit allowlist and blocked actions | Implemented | Unknown tools fail closed |
| Draft PR workflow | Tested branches with draft PRs | Planned | No merge, deploy, or ready-for-review automation |
| Morning report | Overnight summary in dashboard/vault | Planned | Dashboard-first; email draft only |

## Safety rules

- Do not store private student data in the vault or dashboard.
- Do not send email; Gmail remains draft-only.
- Do not merge PRs, deploy, delete files, or install arbitrary MCP servers.
- Do not expose upstream provider error bodies.
- Do not show a provider, tool, vault, GitHub connector, or mobile connector as connected without a real tested connector/probe.
- Keep CORS restricted to the exact configured `ALLOWED_ORIGIN`; CORS is not authentication.

## Next build steps

1. Add a capture-only Shortcut token for public mobile capture.
2. Add a private vault connector with narrow repository permissions.
3. Add a read-only GitHub supervisor for draft PR and check status.
4. Add a morning report view that summarizes inbox, tasks, PRs, checks, blockers, and safety notes.
