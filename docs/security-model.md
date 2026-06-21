# Security Model

## Protected assets

- Provider keys, OAuth credentials, refresh tokens, and local-agent tokens.
- Gmail content and draft recipients.
- Private vault content and GitHub credentials.
- Local files, applications, repositories, and test execution.
- School and Band Council information, especially private student data.

## Boundaries

- Browser code receives capability status, never provider credentials.
- Cloudflare secrets remain in `env` and are never logged or returned.
- Exact-origin CORS reduces browser exposure but is not authentication.
- The local agent requires a shared token and exact allowlist and binds to localhost by default.
- GitHub-backed vault paths are constructed from fixed folders and sanitized segments.

## Action rules

- SAFE actions may execute: status reads, summaries, drafting, planning, vault notes, and validated URL/URI preparation.
- MEDIUM actions require explicit confirmation and are logged in the response: issues, Gmail drafts, tasks, status updates, exact tests, and configured app launches.
- HIGH actions always return `confirmation_required` and never execute automatically: sending mail, merging, deleting, deploying, installing, arbitrary shell, secret changes, publishing, private-student access, and general screen/input control.
- Unknown actions default to HIGH.

## Known limitations

- CORS does not authenticate a user. Production access control remains a future PR.
- OAuth `state` and refresh-token enrollment still need a safer design.
- The Worker cannot securely connect to a local agent without a reviewed transport and token-storage design.
- Pattern checks can catch obvious secrets but cannot prove that free text contains no private information; users remain responsible for review.
- Provider/model identifiers may need updates as vendors change APIs.

## Failure posture

Missing keys, connectors, allowlist entries, or confirmations cause explicit errors or `not connected` status. The system does not simulate successful connections.
