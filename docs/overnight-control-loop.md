# Overnight Control Loop

The overnight loop is an autonomous planning and implementation rhythm with hard safety stops. It can inspect, document, test, commit, push branches, and open draft PRs. It must not deploy, merge, send email, store private student data, or invent unsupported claims.

## Loop

```text
1. Read issues and repo state
2. Inspect existing docs, tests, and config
3. Choose the next safe slice
4. Update docs/config/tests
5. Run relevant checks
6. Commit and push branch work
7. Open or update a draft PR
8. Record blockers and next steps
9. Feed status back into CopelandOS
```

## CopelandOS Roles

| Role | Responsibility | Current Surface |
| --- | --- | --- |
| Inbox | Capture ideas from dashboard/mobile | `/api/capture/idea` |
| Classifier | Tag category, skill, risk, and action | `src/ideaClassifier.js` |
| Planner | Create implementation steps and task briefs | `src/planner.js` |
| Provider Router | Explain which configured provider should handle a task | `src/providerRouter.js` |
| AI Council | Multi-role review in mock mode | `/api/council` |
| Tool Registry | Allow/deny tools and MCP servers | `src/toolRegistry.js` |
| Vault | Persist reviewed notes or mock previews | `src/vault.js` |
| Task Queue | Generate Cursor/Codex prompts | `/api/agents/*-prompt` |
| Dashboard | Show status honestly | `frontend/index.html` |

## Safety Stops

Stop and report instead of continuing when:

- a repository is inaccessible,
- tests cannot run due missing dependencies,
- the task requires credentials not present in the environment,
- source data/provenance is missing,
- an action would send email, deploy, merge, delete files, or run arbitrary shell,
- a requested claim cannot be supported by implementation or tests.

## Morning Report Draft

The loop should produce a reviewable report with:

- work completed,
- checks run,
- PR links,
- access blockers,
- unsupported areas that remain documentation-only,
- next safe implementation tasks.

The report can be written to an Obsidian daily note only after validation and only if the private vault is configured.

## Dashboard Status

The dashboard should distinguish:

- `active`: local static/config module exists and can answer safely,
- `configured`: required env vars are present,
- `scaffold-only`: roadmap exists but no live connector,
- `connected`: a live connection was explicitly checked successfully.

The current integration registry deliberately sets `connected: false` for every integration because it performs no live probes.

## Sprint Guardrails

- Run tests before claiming behavior.
- Use draft PRs for review.
- Keep docs explicit about current scope versus future work.
- Do not copy third-party UI/assets/code.
- Prefer source links over unsupported summaries when documenting research inspiration.
