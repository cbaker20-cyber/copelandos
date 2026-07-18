# Security Audit (2026-07-18)

Post-queue review after completing Tasks 1–4 in `docs/cursor-ready-issues.md`.

## Queue status

| Task | Status |
|---|---|
| 1. Deployment consolidation | Complete |
| 2. Authentication and authorization | Complete |
| 3. Request validation and limits | Complete |
| 4. OAuth callback hardening | Complete |

No remaining cursor-ready security tasks. This audit closed residual edge cases.

## Findings and fixes

### 1. Legacy Pages Function still executable (fixed)

`functions/api/[[route]].js` retained pre-hardening behavior: no API auth, no OAuth `state`, token-in-HTML OAuth callback, and `gmail.modify` scope. If accidentally deployed via Pages, it bypassed the canonical Worker controls.

**Fix:** Return `410 Gone` for every route except `/api/health`, pointing operators to `worker.js`.

### 2. OAuth denial callbacks (fixed)

Google may redirect to `/api/auth/callback?error=access_denied` without a `code`. The Worker previously reported `Missing OAuth code.` and did not surface the filtered provider error.

**Fix:** `parseOAuthCallbackQuery()` returns a safe `400` with filtered `details` when `error` is present.

### 3. CORS rejections missing security headers (fixed)

`403 Origin not allowed` responses omitted the baseline security header set applied elsewhere.

**Fix:** Merge `securityHeaders()` into the CORS rejection response.

### 4. Enrollment pickup ID validation (fixed)

`/api/auth/enrollment/pickup` accepted arbitrary strings as `pickupId`.

**Fix:** Require UUID format in `validateRouteBody()`.

## Accepted residual risks

| Area | Risk | Mitigation already in place |
|---|---|---|
| In-memory rate limiting | Per-isolate only | Documented in `docs/request-limits.md`; upgrade path via KV/WAF |
| In-memory OAuth pickup store | Not durable across isolates | 5-minute TTL + one-time use; operator retries enrollment |
| Dashboard without `API_AUTH_TOKEN` | Protected routes fail closed | Documented in `docs/auth-model.md` |
| `foundationApi` validation errors | Some `400` responses include field messages | Messages are bounded validation text, not upstream bodies |
| Local agent | No pairing transport yet | Out of scope until PR 6 |

## Regression tests

See `test/security-audit.test.js` for:

- Legacy Pages `410` guard
- OAuth denial callback handling
- CORS `403` security headers
- Pickup UUID validation

Run the full suite with `npm test`.

## Next security work

Feature PRs may resume. Future hardening candidates (not in the security queue):

- GitHub supervisor with narrowly scoped credentials (Roadmap PR 5)
- Local-agent authenticated pairing (Roadmap PR 6)
- Distributed rate limiting via Cloudflare KV or WAF rules
