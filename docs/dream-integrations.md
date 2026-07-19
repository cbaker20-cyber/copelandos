# CopelandOS Dream Integrations

CopelandOS should become a mobile-first command center that captures ideas from the phone, turns them into safe plans, routes model work through configured providers, writes durable memory, and returns review status without pretending tools are connected before they are.

## Target Architecture

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

## What Works Now

- `GET` or `POST /api/capture/idea` captures ideas into the CopelandOS inbox when authorized by `API_AUTH_TOKEN` or the capture-only `CAPTURE_TOKEN`.
- `src/ideaClassifier.js` classifies captured ideas with deterministic rules.
- `src/planner.js` creates reviewable plans and task briefs.
- `src/providerRouter.js` and `src/modelRouter.js` select only configured providers.
- `src/toolRegistry.js` and `config/mcp-servers.json` enforce allowlist-first tool and MCP safety.
- `src/vault.js` can create safe Obsidian-style notes and returns mock previews when the private vault is not configured.
- `config/integrations.json` and `src/integrationRegistry.js` define the command-center integration map without activating external systems.

## Proposed Integrations

| Integration | Purpose | Current State | Safety Boundary |
|---|---|---|---|
| iPhone Shortcuts | Dictate or share an idea into the inbox | Scaffolded | Capture only; no execution |
| Mobile widget | One-tap capture and morning status | Planned | Display and enqueue only |
| Obsidian Git vault | Durable private memory | Scaffolded | Mock unless private repo env is configured and a write route is invoked |
| Cursor/Codex task queue | Turn triaged ideas into scoped prompts | Scaffolded | Generate prompts only |
| Provider router | Route tasks by capability and configured credentials | Implemented | No fake configured or connected providers |
| AI council | Multi-role critique for complex plans | Mock/scaffolded | No claim of live multi-model consensus |
| Tool/MCP registry | Explicit allowlist and blocked actions | Implemented | Unknown tools fail closed |
| Draft PR workflow | Tested branches with draft PRs | Planned | No merge, deploy, or ready-for-review automation |
| Morning report | Overnight summary in dashboard/vault | Planned | Dashboard-first; email draft only |

## Safety Rules

- Do not store private student data in the vault or dashboard.
- Do not send email; Gmail remains draft-only.
- Do not merge PRs, deploy, delete files, install arbitrary MCP servers, or run arbitrary shell commands from the Worker.
- Do not expose upstream provider error bodies that may contain sensitive data.
- Do not show a provider, tool, vault, GitHub connector, or external integration as connected without an actual connector/probe.
- Keep CORS restricted to the exact configured `ALLOWED_ORIGIN`; CORS is not authentication.

## Next Build Steps

1. Add a read-only GitHub supervisor for draft PR and check status.
2. Add a morning report view that summarizes inbox, tasks, PRs, checks, blockers, and safety notes.
3. Add connector-specific health probes that do not send user content.
4. Promote integrations from scaffolded to live only after probes and route-specific tests exist.
