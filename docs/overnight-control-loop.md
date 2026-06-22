# Overnight Control Loop

The overnight sprint loop is ambitious but review-first. The goal is to turn mobile ideas into safe, inspectable work products without claiming autonomous completion beyond evidence.

## Registry-Backed Loop

`config/integrations.json` defines the canonical order:

1. `mobile-intake` - phone, Siri, Shortcut, share sheet, or mobile web.
2. `copelandos-inbox` - safe idea storage.
3. `idea-classifier` - deterministic category, skill, risk, and suggested action.
4. `planner` - structured plan and optional mock council review.
5. `provider-router` - configured provider selection and fallback explanation.
6. `tool-allowlist` - tool/MCP permission check.
7. `obsidian-memory` - vault preview or private GitHub vault write.
8. `cursor-codex-task` - scoped prompt for implementation/review.
9. `draft-pr-review` - read-only PR/check summary, planned.
10. `morning-report` - Obsidian daily report draft, planned.

## API Surface

- `GET /api/integrations` returns integrations, control loop, and summary.
- `GET /api/integrations/control-loop` returns the ordered loop.
- `POST /api/integrations/check` returns one integration's configuration state.
- `GET /api/status` includes the integration registry summary.

No route performs a live external probe yet. `connected` remains false in the integration registry until a connector is explicitly implemented and tested.

## Nightly Operating Rules

- Work from issues and project registry, not vague ambition.
- Prefer docs, scaffolds, tests, and draft PRs over unsupported claims.
- Run relevant checks before opening each PR.
- Do not deploy, merge, send email, delete files, add secrets, or store private student data.
- If a repo is inaccessible, record the blocker and do not invent work.
- If OMR or scientific results are not implemented and tested, say so plainly.

## Morning Report Shape

```markdown
# Morning Report - YYYY-MM-DD

## Summary
- What changed overnight.

## What Works Now
- Tested and existing behavior.

## Proposed / Scaffolded
- Docs, configs, API routes, UI panels, or plans that need review.

## Checks
- Commands run and outcomes.

## Safety Notes
- Boundaries preserved.

## Blockers
- Inaccessible repos, missing datasets, missing credentials, failing checks.

## Next Steps
- Review PRs, provide missing access/data, choose implementation priorities.
```

## Dashboard Contract

The dashboard should show the loop as "ready", "scaffolded", or "planned", not as fully connected. Status copy should teach the user that `configured` means environment variables exist, while `connected` requires a verified probe.

## Next Implementation Tasks

- Add a persistent queue for inbox-to-task state transitions.
- Add `morning-report` vault helper and tests.
- Add read-only GitHub PR/check summaries with sanitized upstream errors.
- Add duplicate-work detection before scheduled task creation.
- Add authentication/session boundary before exposing command-center routes beyond the trusted origin.
