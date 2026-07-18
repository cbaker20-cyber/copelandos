# API Authentication Model

Threat assumptions and access-control design for CopelandOS Worker routes. Read this before changing `src/auth.js` or protected-route lists.

## Threat model

### Assets

- Provider API keys (`OPENAI_API_KEY`, `CEREBRAS_KEY`, `SERPER_KEY`, etc.)
- Gmail OAuth credentials and mailbox content
- GitHub vault credentials and note content
- In-memory idea inbox state on the Worker

### Trust boundaries

| Caller | Trust level | Notes |
|---|---|---|
| Same-origin browser dashboard | Low | Any script on the page can call `/api/*`; CORS does not authenticate a user |
| Cross-origin browser (allowed origin) | Low | `ALLOWED_ORIGIN` limits which sites may read responses; it does not prove identity |
| Apple Shortcuts / phone capture | Low | May use a separate `CAPTURE_TOKEN`; still not a user session |
| Direct HTTP client (curl, scripts) | Untrusted | Can reach public Worker URLs without a browser |

### Assumptions

1. **CORS is not authentication.** Exact-origin CORS reduces accidental cross-site browser access but does not stop direct API calls or a compromised allowed origin.
2. **Single-operator deployment.** CopelandOS is a personal Worker, not multi-tenant SaaS. One shared `API_AUTH_TOKEN` is acceptable for this phase; per-user sessions are a later PR.
3. **Secrets live only in Cloudflare `env`.** The token is never returned by API responses or embedded in static HTML.
4. **Fail closed on protected routes.** When `API_AUTH_TOKEN` is unset, Gmail, vault writes, and provider-backed routes return `503` instead of running unauthenticated.
5. **Bearer tokens in transit require HTTPS.** Cloudflare terminates TLS; do not call the Worker over plain HTTP in production.

### Out of scope (this PR)

- OAuth `state` validation and safer refresh-token enrollment (Task 4) — see [gmail-oauth.md](gmail-oauth.md)
- Per-route rate limits and body-size caps (Task 3) — see [request-limits.md](request-limits.md)
- Browser session cookies or refreshable login flows
- Local-agent pairing transport

## Access control

### Token

Set `API_AUTH_TOKEN` in Cloudflare Worker secrets (minimum 24 random characters).

Clients send:

```http
Authorization: Bearer <API_AUTH_TOKEN>
```

Query-string tokens are not accepted on protected routes (they leak in logs and referrers).

### Route classes

| Class | Routes | Rationale |
|---|---|---|
| **Public** | `/api/health`, `/api/status`, `/api/projects`, registry reads, permission rules, brain/orchestration status | Capability and registry metadata only; no secret-backed side effects |
| **Gmail** | `/api/mail/*`, `/api/email/draft`, `/api/auth/gmail`, `/api/auth/callback`, `/api/auth/enrollment/pickup` | Uses Gmail OAuth refresh token |
| **Vault write** | `/api/vault/write`, `/api/obsidian/save`, `/api/idea`, `/api/capture/idea`, `/api/ideas/:id/convert` | Creates or updates vault content via GitHub or mock store |
| **Provider-backed** | `/api/ai`, `/api/search`, `/api/hermes/route`, `/api/automation/route` | Calls external APIs billed to configured keys |

A route in multiple classes requires auth once (any protected class match).

### Responses

| Condition | Status | Body |
|---|---|---|
| `API_AUTH_TOKEN` not configured | `503` | `{ "ok": false, "error": "API authentication is not configured. Set API_AUTH_TOKEN." }` |
| Token missing or wrong | `401` | `{ "ok": false, "error": "Authentication required. Send Authorization: Bearer <API_AUTH_TOKEN>." }` |
| Valid bearer token | — | Handler proceeds |

Error bodies intentionally omit whether the token was missing vs invalid.

### Capture token interaction

`/api/capture/idea` remains additionally gated by `CAPTURE_TOKEN` when that secret is set. When `API_AUTH_TOKEN` is also configured, both checks must pass: send `Authorization: Bearer <API_AUTH_TOKEN>` and include `CAPTURE_TOKEN` as `?token=` query parameter or a second bearer value is not supported on one header.

When `API_AUTH_TOKEN` is **not** configured, a valid `CAPTURE_TOKEN` (bearer or `?token=`) satisfies access control for `/api/capture/idea` only. This preserves Apple Shortcuts GET capture without storing the full API token in a URL.

## Operational guidance

1. Generate a long random token: `openssl rand -base64 32`
2. Store as `API_AUTH_TOKEN` via `wrangler secret put API_AUTH_TOKEN`
3. Configure the dashboard or scripts to send the `Authorization` header on protected calls
4. Rotate the token by updating the secret and all clients together; there is no grace period in this design

## Future work

- Short-lived session tokens with HttpOnly cookies for the dashboard
- Scoped tokens (read-only vs write vs provider)
- Cloudflare Access or OAuth login for human operators
