# CopelandOS Roadmap

Approved priorities. Security tasks in `docs/cursor-ready-issues.md` take precedence over feature work.

## Current sprint: Security foundation

### PR 1 — Deployment consolidation (complete)

- Document canonical single-Worker topology (`wrangler.toml` + `worker.js` + `frontend/` assets).
- Deprecate `functions/api/[[route]].js`; do not expand it.
- Reconcile `wrangler.jsonc` (static-only Cloudflare bot config) with `wrangler.toml`.
- Update `SETUP.md` and add `docs/deployment.md`.

### PR 2 — Authentication and authorization (complete)

- Bearer-token access control for Gmail, vault writes, and provider-backed routes (`API_AUTH_TOKEN`).
- Threat model documented in `docs/auth-model.md`.
- CORS remains origin restriction only, not authentication.

### PR 3 — Request validation and limits (complete)

- Body-size limits, JSON validation, and field length caps on high-risk routes.
- Provider-backed route rate limiting with `429` + `Retry-After`.
- Baseline security headers on all Worker responses.
- Safe error responses that do not expose upstream bodies.

### PR 4 — OAuth callback hardening

- Add OAuth `state` and a safer Gmail enrollment flow (no refresh tokens in HTML).
- Review least-privilege Gmail scopes.

### PR 5 — GitHub project supervisor

- Read-only GitHub status for the five registry projects.
- PR/check summaries with connector or narrowly scoped GitHub App credentials.
- No merges, branch deletion, or deployment.

### PR 6 — Local-agent pairing

- Design authenticated pairing and encrypted transport.
- Add status polling, confirmation receipts, audit events, and a kill switch.
- Keep arbitrary shell and general UI control out of scope.

## Foundation (complete)

- Project and model registries
- Permission engine and command router
- Vault module and Obsidian URI builders
- Canonical Worker route foundation
- Local-agent skeleton and allowlist
- Jarvis dashboard with honest connection states and push-to-talk voice
- Tests and architecture/security documentation

## Later

- School calendar/assignment connectors with privacy review
- Research library ingestion with citations
- JazzBackend practice helpers
- Optional voice synthesis and wake-free push-to-talk improvements
- Automation schedules only after duplicate-work and permission controls exist

For detailed module descriptions, see [docs/roadmap.md](docs/roadmap.md).
