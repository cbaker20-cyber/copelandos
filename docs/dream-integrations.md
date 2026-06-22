# Dream Integrations

CopelandOS should feel like a mobile-first command center, but the reliable foundation is intentionally conservative: capture ideas, classify them, plan next steps, route to configured providers, use allowlisted tools, write reviewed memory, and open draft PRs. No integration should claim to be connected unless a credential or local endpoint is actually configured.

```text
phone/Siri/Shortcut/share sheet
  -> CopelandOS inbox
  -> classifier
  -> planner
  -> provider router / AI council when needed
  -> safe tool + MCP registry
  -> Obsidian memory
  -> Cursor/Codex task
  -> draft PR
  -> review status back into CopelandOS
```

## Integration Map

| Integration | Current Scope | Future Scope | Safety Boundary |
| --- | --- | --- | --- |
| iPhone Shortcuts | POST ideas to `/api/capture/idea` | Siri phrase, share sheet, clipboard capture, widget launcher | Inbox-only; no command execution from phone input |
| Home Screen Widget | Open dashboard or Shortcut | Read-only daily mission and PR status summary | Show status only; no write actions |
| Obsidian Git Vault | Safe vault document builders and mock/GitHub persistence | Daily notes, project status, decisions, morning report | Reject obvious secrets and private student data |
| Cursor/Codex Queue | Generate scoped prompts | Queue reviewed tasks from triaged ideas | Draft PR only; no merge/deploy |
| Provider Router | Credential-gated provider selection | Budget-aware failover and optional AI council | Never mark unconfigured providers connected |
| Tool/MCP Registry | Allowlist-first tool and server registry | Per-tool scopes, audit log, confirmation UI | Block arbitrary shell, deletion, sending, deploys |
| Morning Report | Scaffold through status/project endpoints | Draft daily report to vault/dashboard | Draft-only, review before sharing |

## Source Inspiration

- Apple documents Shortcuts URL schemes, share sheet launch, x-callback-url, and widgets in the Shortcuts User Guide: [run a shortcut from a URL](https://support.apple.com/guide/shortcuts/run-a-shortcut-from-a-url-apd624386f42/ios), [launch from another app](https://support.apple.com/guide/shortcuts/launch-a-shortcut-from-another-app-apd163eb9f95/ios), and [run from a widget](https://support.apple.com/guide/shortcuts/run-shortcuts-from-the-home-screen-widget-apd029b36d05/ios).
- The Obsidian Git plugin describes commit/pull/push workflows and cautions that mobile Git support is unstable: [Vinzent03/obsidian-git](https://github.com/Vinzent03/obsidian-git).
- The MCP tool specification stresses human confirmation for sensitive tool invocations, input validation, access controls, output sanitization, timeouts, and logging: [MCP Tools](https://modelcontextprotocol.io/specification/draft/server/tools).
- LiteLLM routing docs describe ordered fallback chains and retries after failures: [LiteLLM fallbacks](https://docs.litellm.ai/docs/proxy/reliability).
- OpenRouter documents `openrouter/fusion` as bounded multi-model deliberation with panel and judge calls: [Fusion Router](https://openrouter.ai/docs/guides/routing/routers/fusion-router).
- Ollama documents local API access at `localhost:11434`, useful as an explicit local fallback: [Ollama generate API](https://docs.ollama.com/api/generate).

## Non-Goals

- No Jarvis/Marvel assets, names, icons, sounds, or copied UI.
- No Gmail sends. Gmail remains draft-only.
- No arbitrary shell execution or local UI control.
- No automatic deployment, auto-merge, branch deletion, or direct pushes to `main`.
- No storage of private student data or secrets in vault notes.
