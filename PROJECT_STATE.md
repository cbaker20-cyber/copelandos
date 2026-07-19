# CopelandOS Project State

Last updated: 2026-07-18 (security audit)

## Architecture summary

CopelandOS is a personal operations foundation: a Jarvis-style dashboard backed by a single Cloudflare Worker (`worker.js`) that serves both the API and static frontend assets via `wrangler.toml`.

| Layer | Status | Notes |
|---|---|---|
| Canonical Worker (`worker.js`) | Active | All `/api/*` routes, Gmail OAuth, vault, brain pipeline |
| Frontend (`frontend/`) | Active | Served via Wrangler `[assets]` from the Worker |
| Legacy Pages Function (`functions/api/`) | Deprecated | Retained as migration evidence only |
| Local Windows agent | Skeleton | Localhost + token + allowlist; not auto-connected |
| GitHub supervisor | Stub | Reports not connected |

## What works

- Five-project registry and scoped Cursor/Codex prompt generation
- Permission engine (SAFE / MEDIUM / HIGH) with confirmation gates
- Model/provider routing with honest missing-provider errors
- GitHub-backed or mock Obsidian vault writes with path/secret checks
- Draft-only Gmail routes with medium-risk confirmation
- Brain pipeline: idea capture, triage, planning, vault conversion
- Foundation API: status, projects, commands, vault, remote status
- Push-to-talk browser voice input (no always-on microphone)
- Read-only integration roadmap registry and overnight control-loop status, with all external integrations disconnected until real probes exist
- Bearer-token access control on Gmail, vault writes, and provider-backed routes (`API_AUTH_TOKEN`)
- Request body limits, field validation, provider rate limiting, and security headers
- Gmail OAuth with signed `state`, secure refresh-token pickup, and least-privilege scopes
- Post-queue security audit: legacy Pages `410` guard, OAuth denial handling, header hardening
- CI: `npm test` + syntax checks on `main`

## Production topology

One Cloudflare Worker deployment:

```text
https://<worker-name>.<account>.workers.dev
  ├─ /              → frontend/index.html (Wrangler assets)
  ├─ /console       → command center HTML (worker.js)
  └─ /api/*         → worker.js handlers
```

See [docs/deployment.md](docs/deployment.md). The split Pages + Worker setup described in older docs is superseded.

## Security queue progress

From `docs/cursor-ready-issues.md` (work top to bottom):

| Task | Status |
|---|---|
| 1. Deployment consolidation | Complete |
| 2. Authentication and authorization | Complete |
| 3. Request validation and limits | Complete |
| 4. OAuth callback hardening | Complete |

Security queue: **complete**. Post-queue audit documented in `docs/security-audit.md`.

## Known gaps

- Dashboard and scripts must send `Authorization: Bearer <API_AUTH_TOKEN>` on protected routes
- External integration connectors remain roadmap/scaffold only; no live probes are implemented
- GitHub project supervisor not connected
- Local-agent pairing/encrypted transport not implemented
- `wrangler.jsonc` removed; `wrangler.toml` is the sole Wrangler config

## Test commands

```bash
npm test
node --check worker.js
node --check local-agent/server.js
```
