# CopelandOS

CopelandOS is a static browser UI backed by a Cloudflare Worker API. The API can call configured AI providers and Serper, read Gmail, save Gmail drafts, and write notes to a GitHub-backed vault.

## Canonical architecture

The canonical deployment is defined by `wrangler.toml`:

- `frontend/index.html` is served as the static asset UI.
- `worker.js` is the canonical Worker entry point and serves `/api/*`.
- `functions/api/[[route]].js` is a legacy Cloudflare Pages Functions implementation retained for migration/reference. It is security-patched too, but new behavior should be implemented in `worker.js` first and the legacy file should not be deployed as a second backend.

Cloudflare PR #1 adds a `wrangler.jsonc` that declares only `frontend/` assets and omits the canonical `worker.js` entry point. Do not merge that configuration until it is reconciled with this architecture.

## Security defaults

- Browser requests are allowed only from the exact `ALLOWED_ORIGIN`. With no configured origin, cross-origin browser requests are denied.
- Gmail's compatibility route `/api/mail/send` creates a draft; it never calls the Gmail send endpoint.
- Secrets belong in Cloudflare secret storage, never in Git or client-side code.
- `.env.example` contains placeholders only. Real `.env`, `.dev.vars`, Wrangler state, and dependencies are ignored.

## Local checks

No third-party Node packages are required for the security tests.

```bash
npm test
```

See `SETUP.md` for deployment details and `docs/cursor-ready-issues.md` for the security-first work queue.
