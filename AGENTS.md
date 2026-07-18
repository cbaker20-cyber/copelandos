# CopelandOS Agent Guide

Lead-engineer workflow for autonomous agents working in this repository.

## Read first

1. `README.md` — product scope and canonical architecture
2. `PROJECT_STATE.md` — current implementation status
3. `ROADMAP.md` — approved priorities
4. `docs/cursor-ready-issues.md` — security queue (work top to bottom)
5. `docs/deployment.md` — production topology

## Canonical boundaries

- `worker.js` is the only active Cloudflare Worker backend.
- `frontend/` is served by Wrangler assets from the same Worker.
- `functions/api/[[route]].js` is legacy migration evidence only. Do not add features there.
- `local-agent/` is an optional localhost service with token + allowlist.
- Gmail is draft-only. Never call the Gmail messages send endpoint.
- CORS is restricted to the exact configured `ALLOWED_ORIGIN`; CORS is not authentication.

## Workflow

1. Read the docs above and inspect open issues/TODOs.
2. Pick the highest-priority approved task from the security queue or roadmap.
3. Implement exactly one logical task per PR.
4. Add or update tests for every security behavior change.
5. Run `npm test` and syntax checks from `README.md`.
6. Update `PROJECT_STATE.md` and `ROADMAP.md` when status changes.
7. Open a branch (`cursor/<descriptive-name>-8f5a`) and draft PR; never push directly to `main`.

## Do not

- Commit secrets, tokens, OAuth codes, refresh tokens, `.env`, or `.dev.vars`.
- Invent APIs from other repositories.
- Add assistant features before security tasks in `docs/cursor-ready-issues.md` are complete.
- Weaken tests or expose upstream error bodies that may contain sensitive information.

## Cursor Cloud specific instructions

- This project has **zero runtime dependencies** (no `node_modules`, no lockfile). The startup update script (`npm install`) is effectively a no-op; nothing needs installing beyond Node.
- Requires **Node 22** (CI pins 22). `worker.js` uses JSON import attributes (`import ... with { type: 'json' }`), so older Node will fail to load it.
- Run the app (backend + dashboard) with `npx wrangler dev --port 8787 --ip 127.0.0.1`. The first `npx wrangler` invocation fetches Wrangler over the network; it is cached afterward. The dashboard is served at `/` (rendered from `src/commandCenterHtml.js`) and the API lives under `/api/*` on the same Worker. Quick liveness check: `curl http://127.0.0.1:8787/api/health`.
- No secrets are required to boot or test: the Worker runs in honest offline/demo mode and every optional integration (AI providers, Gmail, GitHub vault, search) reports "not connected" until its env vars are set. Vault/Obsidian writes fall back to `mode: "mock"`.
- Tests: `npm test` (Node built-in runner, `node --test`). One test is **pre-existing-failing**: `test/action-console.test.js` asserts the console HTML contains `Create Gmail draft`, but the redesigned phone-first console no longer renders that label. This is a code/test mismatch, not an environment problem.
- The local agent (`npm run local-agent`) is optional and independent from the Worker. It refuses to start unless `LOCAL_AGENT_TOKEN` is at least 24 characters, binds to `127.0.0.1:43120`, and requires a `Bearer` token on all requests.
