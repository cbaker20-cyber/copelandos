# Dream Integrations

This is the ambitious but safe CopelandOS integration map. It is a roadmap, not a claim that every connector is live.

## North-Star Flow

```text
phone / Siri / Shortcut / share sheet
  -> CopelandOS inbox
  -> classifier
  -> planner
  -> provider router or AI council when useful
  -> safe tool and MCP registry
  -> Obsidian memory
  -> Cursor / Codex task brief
  -> draft PR
  -> review status back into CopelandOS
  -> morning report
```

## Integration Tiers

### Tier 1: Implemented Foundation

- `POST /api/capture/idea` receives mobile, Siri, Shortcuts, dashboard, and manual ideas.
- `GET /api/ideas` lists the current inbox.
- The classifier assigns category, skill, risk level, and suggested action.
- The planner creates steps, warnings, and role selection.
- Provider routing reports configured providers honestly.
- Tool and MCP registries block unknown, destructive, and unreviewed capabilities.
- Vault writes sanitize note paths and return mock previews unless GitHub vault credentials are configured.
- Cursor and Codex prompts can be generated from ideas or project registry entries.

### Tier 2: Documented Setup

- iPhone Shortcut that dictates or receives share-sheet text and posts to `POST /api/capture/idea`.
- Home Screen widget that opens the dashboard or runs the capture Shortcut.
- Obsidian Git workflow for private vault sync and pull-before-write habits.
- Morning report template that summarizes captured ideas, project status, PRs, blockers, and next tasks.

### Tier 3: Scaffolded Next Work

- Durable inbox persistence.
- Read-only GitHub PR/check status connector.
- Review queue that links generated Cursor/Codex prompts to draft PRs.
- Provider health probes with rate-limit and timeout metadata.
- Optional local Ollama fallback probe through a permissioned local agent.
- Calendar drafting, never calendar publishing, after privacy review.

## Registry Source

The config source is `config/integrations.json`. API consumers should use:

- `GET /api/integrations`
- `GET /api/integrations/:id`
- `GET /api/status`

External services should remain `connected: false` unless a route performs a live verification check. Configuration is not connection proof.

## Mobile Ideas

Useful mobile commands:

- "Capture idea: fix the JazzBackend chord-tone test."
- "Capture idea: add Score Scanner glare calibration note."
- "Capture idea: Band Council Halloween social checklist."
- "Capture idea: Connectome data provenance blocker."

The phone should only capture and classify. It should not trigger code execution, email sending, deploys, file deletion, or PR merges.

## AI Council Ideas

Council mode is valuable when the task is high-risk, security-sensitive, ambiguous, or cross-repo. Recommended roles:

- Planner: decomposes task and defines acceptance checks.
- Coder: proposes implementation path.
- Security reviewer: checks auth, CORS, tool, secret, privacy, and deploy boundaries.
- Domain reviewer: music, school operations, or research context.
- Final judge: merges feedback into a minimal plan.

The current `/api/council` route is mock mode. It is useful for structure but not proof of live multi-model deliberation.

## Tool And MCP Ideas

The safe pattern is allowlist-first:

- Read-only tools can be available by default.
- Draft-only tools may create reviewable artifacts but never publish or send.
- Safe-write tools can write only validated content to controlled storage.
- Confirmation-required tools need explicit human approval.
- Blocked tools are never allowed.

Unknown MCP servers and newly discovered tools should fail closed until reviewed and added to config.

## Inspiration Sources

- Apple App Shortcuts documentation: https://developer.apple.com/documentation/appintents/app-shortcuts
- Apple App Intents overview: https://developer.apple.com/documentation/appintents/acceleratingappinteractionswithappintents
- Obsidian Git plugin: https://github.com/Vinzent03/obsidian-git
- Docker MCP security guidance: https://www.docker.com/blog/mcp-security-explained/
- OpenRouter Auto Router docs: https://openrouter.ai/docs/guides/routing/routers/auto-router
- LiteLLM routing docs: https://docs.litellm.ai/docs/routing
- Ollama API docs: https://github.com/ollama/ollama/blob/main/docs/openapi.yaml
