# Request Validation and Limits

Design for Task 3 security hardening in `src/requestLimits.js`.

## Goals

- Reject oversized or malformed request bodies before route handlers run.
- Enforce field length limits on high-risk inputs (AI prompts, Gmail drafts, vault writes, search queries).
- Rate-limit provider-backed routes to reduce API-key abuse.
- Add baseline security headers on Worker responses.
- Return safe, generic errors for upstream/provider failures.

## Limits

| Control | Value | Applies to |
|---|---|---|
| Max JSON body | 64 KiB | All `POST`/`PUT`/`PATCH` `/api/*` routes |
| Max text field | 16 KiB | AI messages, vault content, idea text, email body |
| Max short field | 512 chars | Subject lines, search queries, titles |
| Max email field | 320 chars | Gmail `to` addresses |
| Max AI messages | 50 items | `/api/ai` |
| Provider rate limit | 30 requests / minute / client | Provider-backed routes |

## Provider-backed routes

Rate limiting applies to routes that call external billed APIs:

- `/api/ai`
- `/api/search`
- `/api/hermes/route`
- `/api/automation/route`
- `/api/idea`

Client identity uses `CF-Connecting-IP`, then the first `X-Forwarded-For` hop, then `anonymous`. The limiter is in-memory per Worker isolate (best-effort; not a global quota). For stronger limits, add Cloudflare WAF or KV-backed counters later.

Blocked requests return `429` with `Retry-After`.

## Validation flow

```text
Request
  → CORS check
  → API auth (Task 2)
  → provider rate limit
  → body size + JSON parse
  → route field validation
  → route handler
```

Invalid JSON returns `400` with `Invalid JSON body.` Oversized bodies return `413`. Field violations return `400` with the field name and limit.

## Safe error responses

- Provider failures return `503` with `<provider> request failed.` — no upstream response bodies.
- Search failures return `500` with `Search request failed.`
- Gmail list failures return `500` with `Gmail list failed.`
- Unhandled exceptions return `500` with `Internal server error.`

OAuth error responses continue to filter fields through `sanitizeOAuthError()`.

## Security headers

All Worker responses include:

| Header | Value |
|---|---|
| `X-Content-Type-Options` | `nosniff` |
| `X-Frame-Options` | `DENY` |
| `Referrer-Policy` | `strict-origin-when-cross-origin` |
| `Permissions-Policy` | `camera=(), microphone=(), geolocation=()` |
| `Content-Security-Policy` | `default-src 'self'; frame-ancestors 'none'` |

CORS headers are merged after these baseline values.

## Out of scope (later tasks)

- OAuth `state` validation and safer refresh-token enrollment (Task 4)
- Per-user session tokens
- Global distributed rate limiting via KV/Durable Objects
