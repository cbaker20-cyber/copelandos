# CopelandOS Agent Guide

Lead-engineer workflow for autonomous agents working in this repository.

## Read first

1. `README.md` — product scope and canonical architecture
2. `PROJECT_STATE.md` — current implementation status
3. `ROADMAP.md` — approved priorities
4. `docs/cursor-ready-issues.md` — security queue (complete; work top to bottom)
5. `docs/agent-orchestration.md` — agent registry and orchestration API
6. `docs/deployment.md` — production topology

## Canonical boundaries

- `worker.js` is the only active Cloudflare Worker backend.
- `frontend/` is served by Wrangler assets from the same Worker.
- `functions/api/[[route]].js` is legacy migration evidence only. Do not add features there.
- `local-agent/` is an optional localhost service with token + allowlist.
- Gmail is draft-only. Never call the Gmail messages send endpoint.
- CORS is restricted to the exact configured `ALLOWED_ORIGIN`; CORS is not authentication.

## Workflow

1. Read the docs above and inspect open issues/TODOs.
2. Pick the highest-priority approved task from the security queue or platform maturity roadmap.
3. Implement exactly one logical task per PR.
4. Add or update tests for every security behavior change and new platform capability.
5. Run `npm test` and syntax checks from `README.md`.
6. Update `PROJECT_STATE.md` and `ROADMAP.md` when status changes.
7. Open a branch (`cursor/<descriptive-name>-8f5a`) and draft PR; never push directly to `main`.

## Do not

- Commit secrets, tokens, OAuth codes, refresh tokens, `.env`, or `.dev.vars`.
- Invent APIs from other repositories.
- Add assistant features before security tasks in `docs/cursor-ready-issues.md` are complete.
- Weaken tests or expose upstream error bodies that may contain sensitive information.
