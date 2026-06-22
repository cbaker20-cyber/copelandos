# Dream Integrations

CopelandOS should feel like a mobile command center, but its foundation must stay honest: capture is live, planning is review-first, provider/tool status is explicit, and external side effects are blocked unless a future PR adds reviewed authorization.

## Target Flow

```text
phone / Siri / Shortcut / share sheet
  -> CopelandOS inbox
  -> classifier
  -> planner
  -> provider router or AI council
  -> safe tool and MCP registry
  -> Obsidian memory
  -> Cursor or Codex task prompt
  -> draft PR
  -> review status back into CopelandOS
```

## What Works Now

- Mobile/web idea capture through `POST /api/capture/idea`.
- In-memory idea inbox routes for capture, listing, and prompt generation.
- Deterministic classifier and planner scaffolds for safe triage.
- Provider routing that only marks providers configured when env vars exist.
- Tool and MCP allowlist checks for dangerous operations.
- Vault note generation with mock mode when the private GitHub vault is not configured.
- Dashboard panels for projects, ideas, provider status, tool/MCP policy, and the integration control loop.

## Proposed Integrations

| Integration | Proposed Use | Current Stage | Safety Boundary |
|---|---|---|---|
| iPhone Shortcuts widget | Dictate or share text into the inbox | Ready for setup | Capture only; no execution |
| Share sheet | Send URL/text snippets from Safari or apps | Planned | Strip private data before storing |
| Obsidian Git vault | Durable memory, daily notes, project updates | Mock or configured | Private vault only; no secrets |
| Cursor/Codex queue | Generate scoped implementation prompts | Prompt generation | Draft PRs only |
| GitHub supervisor | Read PR/check/review state | Planned | Read-only token, no merge/delete |
| Provider router | Choose configured model per task | Implemented | No fake connected states |
| AI council | Multi-role planning for hard tasks | Mock scaffold | No provider call unless configured |
| Morning report | Daily project status and blockers | Planned | Summary only, no automatic sends |

## Source Notes

- Apple Shortcuts supports actions such as `Get Contents of URL`, widgets, and JavaScript-on-webpage workflows for user-triggered capture: <https://support.apple.com/guide/shortcuts/welcome/ios>.
- Obsidian Git documents automatic commit/sync and startup pull workflows for vault backup: <https://publish.obsidian.md/git-doc/Features>.
- MCP security guidance consistently recommends allowlists, least privilege, per-tool authorization, confirmations, and auditability: <https://modelcontextprotocol.io/specification> and <https://github.com/modelcontextprotocol>.
- OpenRouter documents multi-model routing and model fallback patterns: <https://openrouter.ai/docs/features/model-routing>.
- LiteLLM documents routing strategies, retries, and fallback configuration for provider failover: <https://docs.litellm.ai/docs/routing>.
- Ollama exposes local model APIs suitable for a privacy-first fallback when a local server is actually running: <https://docs.ollama.com/api>.

## Non-Goals

- Do not use copyrighted UI/assets or branded fictional assistant assets.
- Do not send email; Gmail remains draft-only.
- Do not execute arbitrary shell or local UI control.
- Do not deploy, merge, or delete files automatically.
- Do not store private student data.
- Do not claim integrations are connected until the Worker can verify them.
