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
3. Ignore or defer high-risk items unless explicit human confirmation exists.
4. Generate a plan for each safe candidate.
5. Route model work only through configured providers.
6. Check every tool/MCP operation before use.
7. Create vault notes for decisions, research, and task briefs.
8. Create implementation branches and draft PRs only after relevant tests pass.
9. Record tests/checks and safety notes.
10. Build a morning report with what worked, what is scaffolded, what is blocked, and what needs review.

## Stop conditions

- Repository is inaccessible or push is denied.
- A task requires secrets or private student data.
- A tool is missing from the allowlist.
- A model provider is not configured.
- Tests fail in a way that cannot be fixed safely in scope.
- The task requires sending email, merging PRs, deploying, deleting files, or arbitrary shell execution.
- The implementation would require claiming OMR, provider connectivity, or live integrations that have not been implemented and tested.

## Morning report template

```markdown
# Morning Report - YYYY-MM-DD

## Summary
- What changed overnight.

## What Works Now
- Implemented and tested behavior.

## Proposed or Scaffolded
- Designs, docs, configs, and non-live integrations.

## Tests and Checks
- Commands run and results.

## Safety Notes
- Boundaries preserved.

## Blockers
- Inaccessible repos, missing datasets, missing credentials, or missing approvals.

## Next Steps
- Review PRs, connect credentials, or choose implementation follow-ups.
```

## Current status

- CopelandOS command-center registry is implemented as read-only config and pure functions.
- Dashboard panel displays the loop from Worker data.
- Draft PR creation is still a supervised automation outcome, not a Worker runtime feature.
- GitHub status return is planned and must be read-only until explicitly reviewed.
