# Dream Integrations

This document describes the ambitious CopelandOS command-center vision without claiming connectors are already live. The current foundation has deterministic idea capture, classification, planning prompts, provider status, a tool/MCP allowlist registry, Obsidian vault helpers, and honest disconnected states. Everything below should remain draft-first, permissioned, and test-covered.

## Control Loop

```text
iPhone / Siri / Shortcut / Share Sheet
  -> CopelandOS inbox
  -> deterministic classifier
  -> planner
  -> provider router or AI council when needed
  -> safe tool and MCP registry
  -> Obsidian memory
  -> Cursor/Codex task prompt
  -> draft PR
  -> review status back into CopelandOS
```

## Working Now

- `POST /api/capture/idea` accepts text ideas from Siri, Shortcuts, mobile web, dashboard, or manual entry.
- The classifier assigns category, skill, risk, confirmation requirement, and suggested action.
- The planner can produce a structured plan, role selection, Cursor prompt, or Codex prompt.
- Provider routes list configured providers honestly; no env var means no configured provider.
- Tool and MCP registries default-deny unknown tools and permanently block send, deploy, delete, merge, and arbitrary shell actions.
- Vault helpers create bounded Markdown notes and Obsidian URIs; GitHub-backed persistence is gated by `GITHUB_TOKEN` and `GITHUB_REPO`.
- Dashboard status reports disconnected local-agent/GitHub supervisor states instead of faking live integrations.
- `config/integrations.json` now records the intended command-center surfaces and safety boundaries.

## Roadmap Integrations

| Integration | First safe milestone | Required evidence before claiming live |
|---|---|---|
| iPhone Shortcuts widget | Shortcut POSTs idea text to `/api/capture/idea` and shows the returned idea ID | Manual device test plus API test |
| Share Sheet capture | Shortcut accepts text/URL/image reference input and posts sanitized text/metadata | Shortcut export, accepted input types, test idea |
| Obsidian Git vault | Worker writes sanitized Markdown notes to a private repo branch | Private test vault, scoped token, passing path/content tests |
| Cursor/Codex queue | Prompt queue statuses for `ready-for-cursor` and `ready-for-codex` ideas | Persistent queue storage and GitHub draft PR status read |
| AI council | Council mode selects roles, creates prompt bundle, and routes only if providers are configured | Tests proving no provider is called when unconfigured |
| Provider failover | Ordered fallback chains by task profile and budget tier | Integration tests with mocked 429/5xx failures |
| MCP gateway | Registry-backed filtered discovery and per-tool approvals | Server inventory, allowlist tests, audit log schema |
| Morning report | Read-only summary of ideas, draft PRs, checks, blockers, and next actions | GitHub status reader and privacy review |

## Mobile Ideas

Use Apple Shortcuts for capture surfaces, not autonomous execution. Apple documents Share Sheet shortcuts, input type restrictions, receiving onscreen items, and Shortcuts widgets:

- https://support.apple.com/guide/shortcuts/launch-a-shortcut-from-another-app-apd163eb9f95/ios
- https://support.apple.com/guide/shortcuts/input-types-apd7644168e1/ios
- https://support.apple.com/guide/shortcuts/receive-onscreen-items-apd350ce757a/ios
- https://support.apple.com/guide/shortcuts/run-shortcuts-from-the-home-screen-widget-apd029b36d05/ios

Safe shortcut families:

- `Capture Idea`: dictate or type one thought, POST to the inbox, show idea ID.
- `Capture Page`: accept a URL from the Share Sheet, POST title/URL/notes as an idea, do not scrape private pages on-device unless reviewed.
- `Capture Score Scan Task`: save a reminder to process MusicXML/XML/MXL or a future photo-scan research task; do not claim photo OMR exists.
- `Morning Command Check`: open dashboard and show read-only status.
- `Queue Cursor Task`: mark an idea ready for a generated prompt only; do not run Cursor from the phone.

## Memory and Obsidian

Obsidian Git can provide automatic commit/pull/push for a Markdown vault, but CopelandOS should treat it as private memory storage, not as a public publishing surface. Useful references:

- https://github.com/Vinzent03/obsidian-git
- https://community.obsidian.md/plugins/obsidian-git

Safe vault rules:

- Private repo only.
- No secrets, OAuth codes, API keys, real email bodies, or private student data.
- Use bounded folders such as `Inbox/`, `Projects/`, `Decisions/`, `Research/`, and `Daily/`.
- Prefer mock previews until the vault token and repo are configured.
- Pull before manual Obsidian edits and keep mobile sync conservative to avoid conflicts.

## Provider Routing Inspiration

CopelandOS should keep its own conservative router while learning from established routing patterns:

- OpenRouter documents model fallback arrays and provider-level failover: https://openrouter.ai/docs/guides/routing/model-fallbacks
- LiteLLM documents Router fallback chains, retries, cooldowns, and load balancing: https://docs.litellm.ai/docs/proxy/reliability
- Ollama is useful as a local/private fallback, but ordinary localhost is not reachable from a Cloudflare Worker without a reviewed local-agent path.

Routing rules:

- Free-tier providers first for fast/low-risk work.
- Paid providers only when configured and justified by task type.
- Local fallback surfaced honestly as configured/not-running.
- No hidden spending or silent model substitution for safety-sensitive tasks.
- No provider is marked connected from a config file alone.

## Tool and MCP Safety

MCP tools are powerful enough to require a default-deny policy. The MCP tool specification calls for input validation, access controls, user confirmation for sensitive operations, timeouts, and audit logging:

- https://modelcontextprotocol.io/specification/draft/server/tools

CopelandOS safety posture:

- Unknown tool: blocked.
- Unknown MCP server: blocked.
- Read-only tools can run when configured.
- Draft-only tools create reviewable artifacts, not sends/publishes.
- Medium tools require human confirmation.
- High-risk actions stay blocked even if a client sends `confirmed: true`.
- Arbitrary shell, file deletion, screen control, deploy, merge, and email send remain blocked.

## UI Direction

Avoid copyrighted UI/assets and avoid making the dashboard look like it has powers it does not have. The command center should feel polished through clarity:

- Mobile-first cards for Inbox, Today, Projects, Providers, Tools, Vault, and Review Queue.
- Prominent "not connected" and "scaffold only" badges.
- One primary mobile capture action.
- Readable morning report with blockers and draft PR statuses.
- Tap-to-copy Cursor/Codex prompts.
- Accessibility: large touch targets, high contrast, keyboard navigation, and text labels.

## Next Implementation Tasks

1. Add a dashboard card that reads `GET /api/integrations`.
2. Add persistent storage for the idea inbox before using it for real overnight queues.
3. Add a read-only GitHub PR/check status collector with no merge/close/deploy permissions.
4. Add mocked provider-failover tests before making live provider calls retry.
5. Add a morning report route that summarizes only safe, public/project-local metadata.
6. Add Shortcuts setup screenshots or exported shortcut JSON after manual device validation.
