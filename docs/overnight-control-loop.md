# Overnight Control Loop

The overnight loop should turn capture, planning, implementation, and review into a repeatable foundation sprint. It must remain honest about what is implemented, what is scaffolded, and what is blocked.

## Architecture

```text
phone / Siri / Shortcut / share sheet
  -> CopelandOS inbox
  -> classifier
  -> planner
  -> provider router / AI council if needed
  -> safe tool registry
  -> Obsidian memory
  -> Cursor/Codex task
  -> draft PR
  -> review status back into CopelandOS
```

This flow is now represented in `config/integrations.json` and exposed through `/api/integrations/control-loop`.

## Control Phases

1. Capture:
   - Source can be dashboard, Siri, Shortcuts, mobile web, or manual.
   - Output is an inbox item, never an executed task.

2. Classify:
   - Determine project, skill, urgency, and risk.
   - Flag private/student/security-sensitive content for human review.

3. Plan:
   - Draft a safe plan or task brief.
   - Include forbidden actions and required checks.

4. Route:
   - Use deterministic rules first.
   - Use the provider router only when a provider is configured.
   - Use council mode only for complex tasks with budget/confirmation.

5. Gate:
   - Check tool and MCP allowlists.
   - Block arbitrary shell, deletion, deploy, email send, and screen control.
   - Require confirmation for high-risk actions.

6. Remember:
   - Write project updates, research notes, or daily notes to Obsidian after validation.
   - Do not write secrets or private student data.

7. Implement:
   - Generate Cursor/Codex prompts.
   - Work on branches.
   - Open draft PRs.
   - Run tests before claims.

8. Report:
   - Summarize PRs, checks, blockers, and next steps.
   - Keep communications draft-only.

## Morning Report Draft

Morning report sections:

- `Topline`: one paragraph summary.
- `Overnight PRs`: repo, branch, PR title, status.
- `Tests/checks`: exact commands and outcomes.
- `Scaffolded`: what exists but is not connected.
- `Blocked`: missing repo access, data, credentials, or review.
- `Safety`: reminders about email, secrets, private data, deploys, and merges.
- `Next actions`: short reviewed task list.

## Project Status Workflow

Each project card should show:

- Current phase.
- Latest drafted work.
- Last test/check outcome.
- Next safe task.
- Open blockers.
- Whether the work is docs-only, scaffolded, or implemented.

For repos that cannot be accessed, CopelandOS should display `access-blocked` and record the exact error without inventing work.

## Automation Boundaries

Allowed:

- Create docs.
- Add config-backed scaffolds.
- Add tests for registry and routing behavior.
- Run local tests and syntax checks.
- Commit and push branches.
- Open draft PRs where credentials and tools allow.

Blocked:

- Send Gmail messages.
- Commit secrets or `.env` files.
- Add arbitrary shell execution to the product.
- Deploy automatically.
- Merge PRs.
- Delete files or repos.
- Store private student data.
- Claim PDF/photo OMR, provider routing, or GitHub supervision works before implementation and tests.

## Dashboard Requirements

- The dashboard should show configured/scaffolded states plainly.
- External services should not be marked connected without a live probe.
- The integrations panel should explain the full control loop.
- Tool/MCP status should remain allowlist-first.
- Provider status should distinguish free-tier, paid, local, and unconfigured providers.
- Morning report should be draft-only until a human exports or sends it.

## Next Technical Tasks

1. Add authenticated mobile capture.
2. Persist task queue records.
3. Add read-only GitHub PR/check summary routes with tests.
4. Add provider health checks with no upstream error leakage.
5. Add morning report generation from project, idea, and PR status.
6. Wire Obsidian project updates to completed PR events.
