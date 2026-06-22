# CopelandOS Dream Integrations

This is the ambition map for CopelandOS as a command center. It is intentionally a roadmap, not a claim that every connector is live.

## North Star

```text
phone / Siri / Shortcut / share sheet
  -> CopelandOS inbox
  -> classifier
  -> planner
  -> provider router or AI council
  -> safe tool and MCP registry
  -> Obsidian memory
  -> Cursor / Codex task
  -> draft PR
  -> review status back into CopelandOS
```

The system should feel fast and personal while behaving like a cautious engineering workflow: capture first, classify risk, plan, route to the least risky capable tool, create draft artifacts, and report status without merging, deploying, or sending messages automatically.

## Integration Registry

`config/integrations.json` is the source of truth for command-center surfaces. It separates:

- `internal-module`: implemented in the Worker and safe to mark as available.
- `internal-scaffold`: designed but not fully live.
- `external-service`: requires env configuration and still reports `configured-not-probed` unless the route performs a live check.
- `external-client` and `future-client`: phone/widget/client surfaces that must be configured outside the Worker.

`GET /api/integrations` returns the registry and honest runtime status. `GET /api/integrations/control-loop` returns the ordered phone-to-report loop for the dashboard.

## Dream Surfaces

| Surface | Role | Current status | Safety boundary |
|---|---|---|---|
| iPhone Shortcuts | Dictate or share an idea into `/api/capture/idea` | Scaffold | Capture text only |
| iOS widget / App Intent | Quick capture, inbox count, morning report | Scaffold | No device control |
| Mobile web dashboard | Today view, capture, project status | Implemented foundation | Worker CORS boundary |
| Obsidian Git vault | Private durable memory | Mock unless GitHub vault env is set | Blocks private student data |
| Cursor / Codex queue | Generate scoped task prompts | Prompt generation foundation | Draft PR only |
| GitHub PR supervisor | Read PR/check status | Not live-probed | Read-only, no merge |
| Gmail draft | Human-reviewable drafts | Draft-only route | Never send |
| Local agent | Approved local actions | Not connected by default | No shell/delete/screen control |
| MCP registry | Approved tool server list | Scaffold/allowlist | Unknown servers blocked |
| AI council | Multi-role review | Mock mode | No claim of live council |

## Tool And MCP Safety

The registry follows allowlist-first security guidance: tools and servers are treated as untrusted until explicitly approved, high-impact operations require confirmation, and destructive operations stay blocked. MCP security discussions consistently emphasize strict schemas, least privilege, tool allowlists, and user approval for destructive calls.

Relevant sources:

- Model Context Protocol security guidance from the Coalition for Secure AI: https://www.coalitionforsecureai.org/wp-content/uploads/2026/03/model-context-protocol-security-1.pdf
- MCP security overview from Palo Alto Networks: https://live.paloaltonetworks.com/t5/community-blogs/mcp-security-exposed-what-you-need-to-know-now/ba-p/1227143
- MCP security checklist emphasizing approval and allowlists: https://www.networkintelligence.ai/blogs/model-context-protocol-mcp-security-checklist/

## Provider Inspiration

CopelandOS should avoid one paid-model dependency. Inspiration:

- OpenRouter provider routing and model fallback docs describe provider selection and ordered model fallbacks: https://openrouter.ai/docs/guides/routing/provider-selection.mdx and https://openrouter.ai/docs/guides/routing/model-fallbacks
- OpenRouter reliability notes distinguish provider failover from model fallbacks: https://openrouter.ai/blog/insights/reliability-failover/
- LiteLLM documents retries, cooldowns, load balancing, and fallbacks: https://docs.litellm.ai/docs/routing and https://docs.litellm.ai/docs/proxy/reliability
- Ollama documents local REST APIs and local authentication expectations: https://docs.ollama.com/api and https://docs.ollama.com/api/authentication

## UI Inspiration Boundaries

The dashboard can use common command-center patterns: compact cards, system signals, status badges, command palette, mobile-first capture, and morning report cards. Do not copy copyrighted UI, brand assets, movie assets, or Marvel/Jarvis imagery. The current UI uses original styling and generic command-center language.

## Next Implementation Steps

1. Add persisted idea storage before relying on the inbox across Worker restarts.
2. Add a read-only GitHub status connector that summarizes draft PRs and checks without merge/close permissions.
3. Add a morning-report endpoint assembled from status, projects, inbox, provider status, and PR summary.
4. Add iOS Shortcut export documentation with screenshots after a real Shortcut is manually built and tested.
5. Keep all new integrations in `config/integrations.json` before enabling API routes or UI claims.
