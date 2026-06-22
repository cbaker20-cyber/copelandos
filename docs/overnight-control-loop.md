# Overnight Control Loop

The overnight loop is the operating rhythm for ambitious autonomous work without unsafe claims or unreviewed side effects.

## Loop Diagram

```text
1. Capture
   phone / dashboard / issue / note

2. Classify
   project, skill, risk, suggested action

3. Plan
   steps, warnings, roles, tests

4. Route
   provider router or mock council structure

5. Check tools
   allowlist, MCP policy, confirmation rules

6. Write memory
   sanitized Obsidian note or mock preview

7. Create task
   Cursor/Codex prompt or branch task

8. Implement
   scoped changes only

9. Verify
   tests, syntax checks, diff checks

10. Draft PR
   summary, working scope, scaffolded scope, checks, safety notes, next steps

11. Report
   morning report and project status update
```

## Risk Gates

Stop or require explicit human confirmation for:

- Sending email.
- Publishing announcements.
- Writing private student data.
- Deleting files.
- Running arbitrary shell commands through product features.
- Installing random MCP servers.
- Deploying.
- Merging PRs.
- Marking unverified providers/tools connected.
- Claiming scientific, OMR, or music correctness without tests and evidence.

## Command Center Status Terms

- `implemented`: Code exists in this repo and is covered by relevant tests or checks.
- `documented`: Workflow is described but not automated.
- `scaffold-only`: Shape exists for future work but no live runner or connector is active.
- `configured`: Required env vars are present.
- `connected`: A live verification route succeeded. This should be rare in the foundation phase.
- `mock mode`: Safe preview output without side effects.

## Morning Report Template

```markdown
# Morning Report

## Overnight Summary
- Completed:
- Draft PRs opened:
- Checks run:

## What Works Now
- 

## Proposed / Scaffolded
- 

## Blockers
- Repo access:
- Missing credentials:
- Missing data/provenance:
- Failing checks:

## Safety Notes
- Gmail:
- Student privacy:
- Secrets:
- Providers/tools:
- Deploy/merge:

## Next Steps
1. 
2. 
3. 
```

## Project Status Workflow

For every repo:

1. Read the issue.
2. Inspect the repository.
3. Make documentation or code changes only within the requested scope.
4. Add tests when behavior or config modules change.
5. Run relevant checks.
6. Commit and push the branch.
7. Open a draft PR when tooling and permissions allow.
8. Record blockers instead of inventing results.

## Integration Registry

`config/integrations.json` is the source of truth for:

- Capture surfaces.
- Brain/planner modules.
- Provider routing.
- Tool/MCP safety.
- Obsidian memory.
- Cursor/Codex task queue.
- Draft PR review loop.
- Morning report.

The registry is exposed by `GET /api/integrations` and summarized in `GET /api/status`.

## Source Notes

- Docker MCP security guidance recommends allowlists, logging, secret controls, and gateway-style mediation: https://www.docker.com/blog/mcp-security-explained/
- Anthropic/Zuplo MCP gateway discussion frames allowlists as capability grants: https://zuplo.com/blog/anthropic-made-the-case-for-mcp-gateways
- LiteLLM routing documents retries, fallbacks, cooldowns, and ordered deployments: https://docs.litellm.ai/docs/routing
- OpenRouter Auto Router documents model selection and allowed model restrictions: https://openrouter.ai/docs/guides/routing/routers/auto-router
