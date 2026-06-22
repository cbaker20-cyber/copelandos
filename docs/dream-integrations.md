# Dream Integrations

CopelandOS should become a mobile-first command center without pretending unfinished connectors are live. The safe target architecture is:

```text
phone / Siri / Shortcut / share sheet
  -> CopelandOS inbox
  -> classifier
  -> planner
  -> provider router or AI council
  -> safe tool and MCP registry
  -> Obsidian memory
  -> Cursor/Codex task
  -> draft PR
  -> review status back into CopelandOS
```

The current implementation now has a config-backed integration registry in `config/integrations.json`, a read-only/check module in `src/integrationRegistry.js`, and Worker routes at `/api/integrations`, `/api/integrations/check`, and `/api/integrations/control-loop`.

## Current Foundation

- Ideas can be captured through `/api/capture/idea` and reviewed in the dashboard.
- The deterministic classifier and planner already provide safe triage and task briefs.
- Provider routing is configured through `config/providers.json` and never marks providers connected without credentials.
- Tool and MCP safety is allowlist-first through `config/tools.json` and `config/mcp-servers.json`.
- Gmail remains draft-only.
- Obsidian writes validate paths and block obvious secrets or private student data.

## Integration Registry

`config/integrations.json` is the high-level map for command-center surfaces:

- `iphone-shortcuts`: Siri, widget, share sheet, and x-callback capture scaffold.
- `copelandos-inbox`: internal idea inbox.
- `idea-classifier`: deterministic classifier before AI planning.
- `planner`: review-first plan and task brief generator.
- `provider-router`: environment-configured AI routing.
- `ai-council`: mock/scaffolded multi-model review.
- `tool-mcp-registry`: safe tool and MCP allowlist.
- `obsidian-vault`: private Git-backed memory.
- `cursor-codex-task-queue`: prompt generation and future task queue.
- `github-pr-supervisor`: read-only PR/check summary scaffold.
- `gmail-draft`: draft-only communication.
- `morning-report`: daily status summary scaffold.
- `local-agent`: localhost allowlist bridge scaffold.

The registry distinguishes `configured`, `connected`, `available`, and `scaffold`. External services are never marked live-connected by environment variables alone.

## Mobile Command Surface

The phone should be the primary capture device:

- Siri phrase: "Capture in CopelandOS."
- Share sheet action: send selected text or URL to the inbox.
- Home Screen widget: one-tap idea capture and morning report.
- Lock Screen widget: capture text or voice note with no execution.
- x-callback result: return the captured idea ID and triage status to Shortcuts.

Apple documents the Shortcuts URL scheme as `shortcuts://run-shortcut?name=[name]&input=[input]&text=[text]`, and x-callback URLs can return a textual result through `x-success`. Use that pattern only to trigger local Shortcut workflows; server-side capture should still use an authenticated Worker endpoint when auth is added.

Source: <https://support.apple.com/guide/shortcuts/run-a-shortcut-from-a-url-apd624386f42/ios> and <https://support.apple.com/guide/shortcuts/use-x-callback-url-apdcd7f20a6f/ios>.

## Provider Routing

Provider routing should remain conservative:

- Use the first configured provider for the task type.
- Prefer free-tier or local models for low-risk summarization and capture enrichment.
- Use paid/high-quality models for security review or complex planning only when configured.
- Keep Ollama as local fallback for privacy-first/offline work.
- Show unavailable providers as not configured, not as broken.

OpenRouter separates model routing from provider routing and supports provider ordering and fallback settings. LiteLLM documents retries, cooldowns, load balancing, and ordered fallbacks. CopelandOS should borrow those patterns as design inspiration, while keeping implementation explicit and testable in `config/providers.json`.

Sources: <https://openrouter.ai/docs/guides/routing/provider-selection.mdx>, <https://docs.litellm.ai/docs/routing>, and <https://docs.litellm.ai/docs/proxy/reliability>.

## Tool And MCP Safety

MCP should be treated as a governed toolchain, not a random plugin list:

- Every tool/server must appear in a registry before discovery or execution.
- High-risk operations require confirmation even if the server is allowlisted.
- Destructive operations remain blocked.
- Tool arguments should be schema-validated before live execution is added.
- Audit logs should record decisions without storing secrets.

MCP gateway guidance emphasizes centralized enforcement, allow/deny filtering, parameter sanitization, human approval for sensitive tools, and structured audit logs.

Sources: <https://www.docker.com/blog/mcp-security-explained/> and <https://microsoft.github.io/agent-governance-toolkit/integrations/mcp-trust-guide/>.

## Dashboard Inspiration

The dashboard should feel like a calm command center:

- Clear status chips instead of fake glowing "online" states.
- Mobile-first panels for capture, inbox, providers, integrations, and tools.
- One persistent command dock.
- Morning report card with "what changed", "what is blocked", and "what to do next".
- No copyrighted UI/assets/code. Avoid Marvel/Jarvis assets and clone-free design.

## Next Integrations

1. Add authenticated mobile capture once auth tasks are complete.
2. Persist task queue entries for Cursor/Codex prompts.
3. Add read-only GitHub PR/check polling behind explicit configuration.
4. Add morning report generation as a dashboard draft and Obsidian note.
5. Add optional provider health probes that update `connected` separately from `configured`.
