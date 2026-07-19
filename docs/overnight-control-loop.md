# Overnight Control Loop

The overnight control loop turns captured intent into reviewable work. It is ambitious, but it must remain honest: no external integration is live unless credentials, probes, tests, and safety controls prove it.

## Loop overview

```text
1. Capture from phone/Siri/Shortcut/share sheet
2. Store in CopelandOS inbox
3. Classify risk, project, and skill
4. Plan the next safe action
5. Route model work through configured providers or local fallback
6. Use AI council only when real providers are configured; otherwise mock/scaffold
7. Check tool and MCP permissions
8. Write or preview Obsidian memory
9. Generate Cursor/Codex task prompt
10. Open draft PR after tests
11. Return PR/check status to CopelandOS morning report
```

`GET /api/integrations/control-loop` exposes this map for the dashboard. It reports implemented modules as ready, scaffolded systems as scaffolded, and external systems as not connected unless future live probes exist.

## Roles

| Role | Responsibility | Current surface |
|---|---|---|
| Inbox | Store captured ideas | `/api/capture/idea`, `/api/ideas` |
| Classifier | Label category, skill, risk | `src/ideaClassifier.js` |
| Planner | Turn ideas into reviewable steps | `src/planner.js` |
| Provider router | Select configured AI provider | `src/providerRouter.js`, `src/modelRouter.js` |
| Tool registry | Allow/deny tool and MCP calls | `src/toolRegistry.js` |
| Vault | Store durable memory | `src/vault.js` |
| Task queue | Produce scoped prompts | `/api/agents/*-prompt`, idea prompt routes |
| Status reporter | Summarize PR/check state | Planned |

## Nightly runbook

1. Load inbox and project registry.
2. Group ideas by project, risk, and urgency.
3. Produce a reviewable plan for safe ideas.
4. Route model work only through configured providers.
5. Check every tool request against the registry before preparing work.
6. Write or preview vault notes after content checks.
7. Generate Cursor/Codex prompts for human-reviewed tasks.
8. Open or update only draft PRs through reviewed automation, not Worker runtime code.
9. Collect test/check status read-only.
10. Render a morning report in the dashboard.

## Non-goals

- No email sending.
- No PR merge, ready-for-review changes, deploy, branch deletion, or repository deletion.
- No arbitrary shell or package installation.
- No screen, mouse, keyboard, or screenshot control.
- No random MCP install behavior.
- No private student data access or persistence.

## Fail-closed rules

- Unknown integrations return `allowed: false`.
- Scaffold-only integrations return `ok: false` and `connected: false`.
- Configured environment variables mean configuration exists, not that a live connector is connected.
- `/api/status` must not claim external integrations are connected.
- Gmail remains draft-only.

## Dashboard expectations

The dashboard card should be a status map, not an execution console. It can show:

- Step number
- Step name
- Source and target
- `ready` for implemented internal modules
- `scaffold-only` or `planned` for future work

It must not provide buttons that execute overnight work automatically.
