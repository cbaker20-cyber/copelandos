# Gmail OAuth Enrollment

Secure Gmail draft enrollment for the canonical Worker (`worker.js`).

## Threat model

- OAuth callbacks are browser redirects and cannot include `API_AUTH_TOKEN`.
- Refresh tokens are long-lived secrets and must never appear in HTML responses by default.
- OAuth `state` prevents CSRF on the callback endpoint.
- Least-privilege scopes limit blast radius if a token is compromised.

## Scopes (least privilege)

| Scope | Purpose |
|---|---|
| `gmail.compose` | Create and update drafts only (no send) |
| `gmail.readonly` | Inbox list/read routes (`/api/mail/list`, `/api/mail/read`) |

CopelandOS does **not** request `gmail.modify`, `gmail.send`, or full mailbox write access.

## Enrollment flow (default)

```text
Operator (authenticated)
  → GET /api/auth/gmail            (requires API_AUTH_TOKEN)
      → Google consent with signed state
  → GET /api/auth/callback         (state validated)
      → refresh token stored as short-lived pickup
      → HTML success page WITHOUT token
  → POST /api/auth/enrollment/pickup (requires API_AUTH_TOKEN)
      → { refresh_token } once
  → wrangler secret put GMAIL_REFRESH_TOKEN
```

### State parameter

`state` is an HMAC-signed value: `{nonce}.{timestamp}.{signature}`

- Signed with `GMAIL_OAUTH_STATE_SECRET`, or `GMAIL_CLIENT_SECRET`, or `API_AUTH_TOKEN`
- Expires after 10 minutes
- Required on `/api/auth/callback`; missing/invalid state returns `400`

### Pickup token

After a successful callback, the Worker stores the refresh token in memory keyed by `pickupId` for **5 minutes**. The callback HTML shows the `pickupId` and curl instructions, not the secret.

`POST /api/auth/enrollment/pickup`:

```json
{ "pickupId": "uuid-from-callback-page" }
```

Requires `Authorization: Bearer <API_AUTH_TOKEN>`. Returns the refresh token once; repeat calls return `410`.

## Backwards compatibility

Set `GMAIL_OAUTH_LEGACY_HTML=true` to restore the deprecated HTML page that embeds the refresh token directly. This mode is for migration only and should be disabled after enrollment.

## Configuration

| Variable | Required | Purpose |
|---|---|---|
| `GMAIL_CLIENT_ID` | Yes | Google OAuth client ID |
| `GMAIL_CLIENT_SECRET` | Yes | Signs OAuth state and exchanges codes |
| `GMAIL_OAUTH_STATE_SECRET` | No | Dedicated state-signing secret (falls back to client secret) |
| `GMAIL_OAUTH_LEGACY_HTML` | No | `true` enables deprecated HTML token rendering |
| `API_AUTH_TOKEN` | Yes for enrollment | Protects `/api/auth/gmail`, callback pickup, and provider routes |

Register redirect URI:

```text
https://<worker>/api/auth/callback
```

## Failure posture

| Condition | Status | Response |
|---|---|---|
| Missing `state` on callback | `400` | `Missing OAuth state.` |
| Invalid/expired `state` | `400` | Generic state error |
| Token exchange failure | `400` | `OAuth token exchange failed.` + filtered `details` |
| Pickup missing/expired/used | `410` | `Pickup expired, already used, or not found.` |
| Unauthenticated enrollment routes | `401` / `503` | Same as Task 2 API auth |

Upstream OAuth error bodies are filtered to `error` and `error_description` only.
