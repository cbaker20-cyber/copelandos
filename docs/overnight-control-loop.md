# Overnight Control Loop

The overnight sprint loop is a review-first automation pattern for CopelandOS and related projects. It should produce draft work, evidence, and blockers, not unsupported claims.

## Ordered Loop

```text
1. Capture
   iPhone Shortcut, share sheet, dashboard, or manual command.

2. Inbox
   Store text, source, tags, project, urgency, and timestamp.

3. Classify
   Determine category, skill, risk, and confirmation requirement.

4. Plan
   Build a scoped task brief with warnings and success checks.

5. Route
   Pick provider route or council mode based on task type and risk.

6. Gate tools
   Check tool and MCP allowlists before any side-effecting action.

7. Remember
   Save only safe, reviewed notes to the Obsidian Git vault.

8. Queue implementation
   Generate Cursor or Codex task prompt for branch work.

9. Draft PR
   Commit, push, open a draft PR, and report exact tests/checks.

10. Morning report
    Summarize what changed, what works, what is scaffolded, blockers, and next steps.
```

## Current Support

- `GET /api/integrations/control-loop` exposes the ordered loop.
- `config/integrations.json` documents each integration boundary.
- The dashboard shows the loop and honest runtime status.
- Provider routing, tool registry, idea capture, planner, vault preview/write, and prompt generation have tests.

## Safety Invariants

- No secrets, tokens, OAuth codes, refresh tokens, real email content, `.env`, or `.dev.vars`.
- Gmail operations are draft-only.
- CORS must stay restricted to the exact `ALLOWED_ORIGIN`.
- No arbitrary shell execution.
- No deployment automation.
- No automatic PR merge.
- No deletion tools.
- No fake provider, vault, GitHub, local-agent, or MCP connected states.
- No private student data.

## Morning Report Shape

```md
# Morning Report - YYYY-MM-DD

## Summary
- What changed.
- What draft PRs were opened.
- What repositories were blocked.

## What Works Now
- Implemented routes, docs, tests, or UI.

## Scaffolded
- Designed but not live-probed integrations.

## Checks Run
- Exact commands and outcomes.

## Safety Notes
- Draft-only, read-only, no secrets, no private data.

## Next Steps
- Review PRs.
- Configure missing env vars.
- Resolve blocked repository access.
```

## Scheduler Guidance

Cron or overnight automation should:

1. Read issue scope.
2. Inspect repo status and rules.
3. Make narrow commits.
4. Push only to the assigned branch.
5. Run relevant checks.
6. Open draft PRs where supported.
7. Report blocked repositories explicitly.

It should not:

- Estimate calendar timelines.
- Claim a connector is live from configuration alone.
- Run unreviewed local machine actions.
- Communicate externally unless specifically requested.

## Next Implementation Tasks

1. Add persisted inbox storage.
2. Add `GET /api/morning-report` using only local Worker state at first.
3. Add read-only GitHub PR/check summary with strict response redaction.
4. Add a `templates/vault/morning-report.md`.
5. Add tests for integration status honesty and morning-report privacy filters.
