# Cursor-Ready Security Queue

Work top to bottom, one draft PR at a time. Do not add assistant features until the security tasks are complete.

## Rules

- Read `README.md`, `SETUP.md`, `wrangler.toml`, `worker.js`, and `functions/api/[[route]].js` before editing.
- Treat `worker.js` as canonical. Keep the Pages Function secure while it remains tracked, but do not expand it.
- Never commit keys, tokens, OAuth codes, refresh tokens, `.env`, `.dev.vars`, or real email content.
- Gmail remains draft-only unless a future, separately reviewed design adds a strong human-confirmed send gate.
- Never use wildcard CORS for authenticated or secret-backed routes.
- Add tests for security behavior changes.

## Task 1: Deployment consolidation

- **Status:** Complete (see `docs/deployment.md`, `PROJECT_STATE.md`).
- Decide whether to delete the legacy Pages Function or extract shared handlers. → Legacy function retained with deprecation banner; `worker.js` is canonical.
- Reconcile Cloudflare PR #1 with `wrangler.toml`; do not merge a static-only configuration over the canonical Worker. → `wrangler.jsonc` removed; `wrangler.toml` is the sole config.
- Verify one documented production topology. → Documented in `docs/deployment.md` and updated `SETUP.md`.

## Task 2: Authentication and authorization

- **Status:** Complete (see `docs/auth-model.md`, `src/auth.js`).
- Add an access-control layer in front of Gmail, vault writes, and provider-backed routes. → `API_AUTH_TOKEN` bearer check in `worker.js`.
- Do not treat CORS as authentication. → Documented in `docs/auth-model.md`; CORS unchanged.
- Document session/token threat assumptions before implementation. → `docs/auth-model.md`.

## Task 3: Request validation and limits

- Add body-size limits, strict route methods, field length limits, and safe error responses.
- Add rate limiting or Cloudflare controls for provider-backed routes.

## Task 4: OAuth callback hardening

- Add and validate OAuth `state`.
- Stop rendering refresh tokens into an HTML response; document a safer enrollment flow.
- Review least-privilege Gmail scopes.
