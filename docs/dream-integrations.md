# CopelandOS Dream Integrations

This is the ambitious command-center map for CopelandOS. It is a roadmap, not a claim that every integration is connected today.

## North Star

```text
phone / Siri / Shortcut / Share Sheet
  -> CopelandOS inbox
  -> classifier
  -> planner
  -> provider router / AI council if needed
  -> safe tool registry
  -> Obsidian memory
  -> Cursor / Codex task
  -> draft PR
  -> review status back into CopelandOS
```

CopelandOS should feel like a mobile-first operations center: capture thoughts quickly, turn them into safe plans, route work to the right agent/provider, and return honest project status in the morning.

## Integration Registry

`config/integrations.json` is the source of truth for command-center integrations. It records:

- `stage`: `implemented`, `scaffolded`, or `planned`
- `entrypoints`: Worker routes or user surfaces
- `requiredEnvVars`: prerequisites without storing secret values
- `allowedActions`: explicitly permitted behavior
- `blockedActions`: actions that must never execute through this path
- `privacyNotes`: student-data, secret, or cloud-provider cautions
- `nextStep`: the next safe implementation move

The runtime wrapper in `src/integrationRegistry.js` never marks an integration `connected` without a future live probe. This preserves the existing CopelandOS rule against fake connected states.

## Priority Integrations

| Integration | Current stage | Safe near-term goal |
|---|---:|---|
| iPhone Shortcuts and widgets | scaffolded | Importable capture Shortcut that posts JSON to `/api/capture/idea` |
| Share Sheet capture | scaffolded | Capture selected text/link into the inbox with source metadata |
| Idea inbox | implemented | Durable KV/D1 persistence and status filters |
| Classifier and planner | implemented | Add AI critique after deterministic classification |
| Provider router | scaffolded | Health-checked failover, budget guard telemetry, local fallback display |
| Tool/MCP registry | implemented | Audit log for every allow/deny decision |
| Obsidian Git vault | scaffolded | Private vault workflow with mobile-safe Git sync |
| Cursor/Codex queue | scaffolded | Durable queue records with branch, PR, check, and review status |
| Morning report | planned | Read-only GitHub status digest and next-action list |

## Safe Tool Families

- `read-only`: GitHub status, docs, search, and vault reads.
- `draft-only`: Gmail drafts and event communication drafts. Sending is blocked.
- `safe-write`: sanitized vault notes and bounded task prompt generation.
- `confirmation-required`: local agent actions, issue creation, and calendar drafts.
- `blocked`: email send, deploy, merge, deletion, arbitrary shell, screen control.

## Inspiration and Sources

- Apple documents using Shortcuts `Get Contents of URL` for API requests, including `POST` requests with JSON bodies. Source: [Apple Shortcuts API request guide](https://support.apple.com/guide/shortcuts/request-your-first-api-apd58d46713f/ios).
- MCP safety patterns emphasize deny-by-default tool allowlists, discovery-time filtering, execution-time checks, scoped credentials, and audit logs. Sources: [AppSentinels MCP access control](https://appsentinels.ai/blog/mcp-access-control-how-to-enforce-least-privilege-across-ai-agent-tool-chains/) and [Rhumb tool-level permission scoping](https://rhumb.dev/blog/tool-level-permission-scoping-mcp).
- LiteLLM uses router-level fallbacks, retries, timeouts, and cooldowns across deployments/providers. Source: [LiteLLM routing and load balancing](https://docs.litellm.ai/docs/routing).
- OpenRouter `openrouter/auto` can choose a model based on prompt complexity and report the selected model. Source: [OpenRouter Auto Router docs](https://openrouter.ai/docs/guides/routing/routers/auto-router).
- Ollama exposes a local API by default at `http://localhost:11434/api`, which makes it a practical privacy-first fallback when running locally. Source: [Ollama API introduction](https://docs.ollama.com/api/introduction).

## Non-Goals

- No autonomous email sending.
- No automatic PR merges or deploys.
- No unreviewed MCP installation.
- No arbitrary shell execution.
- No storage of secrets or private student data.
- No claim that a provider, vault, local agent, or GitHub supervisor is live unless a specific probe confirms it.
