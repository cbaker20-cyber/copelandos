# OpenClaw Worker Integration

CopelandOS is the **command center**. OpenClaw (or OpenClaw-like tools) are **optional execution workers** with explicit permission boundaries. They are not the root brain, merge gate, or autonomous operator for your repositories.

## Roles

| Layer | Responsibility |
|---|---|
| CopelandOS | Coordinate status, planning, model routing, prompts, vault notes, and Gmail drafts |
| Cursor | Code worker for repository changes |
| ChatGPT / Copeland review | Quality and merge gate |
| OpenClaw worker | Optional scoped execution on a local machine, VPS, or container |

CopelandOS may **propose** tasks to OpenClaw. OpenClaw may **execute only** what is explicitly scoped, allowlisted, and confirmed when required.

## What OpenClaw may receive

- Explicit, scoped tasks with a clear goal and stop conditions
- Read-only status requests within an allowlisted skill set
- Bounded file or vault writes that passed CopelandOS permission checks
- Approved test commands that match an exact allowlist entry

## What OpenClaw must never do automatically

- Auto-delete files, mail, branches, or deployments
- Auto-send email or publish content
- Auto-merge pull requests
- Auto-deploy applications
- Auto-install packages or dependencies without human review
- Run arbitrary shell commands outside an exact allowlist
- Control the browser, mouse, keyboard, or screen

## Secret handling

- Never share secrets through prompts, task payloads, or logs
- Worker tokens belong in environment variables or secret stores only
- CopelandOS status endpoints report **presence**, never values
- Third-party skills are **untrusted** until reviewed

## Skill policy

- OpenClaw skills must be **allowlisted** in configuration reviewed by a human
- Third-party or community skills are untrusted by default
- New skills require an explicit security review before enablement
- CopelandOS does not install skills automatically

## Recommended deployment

1. Run OpenClaw on an **isolated** local machine, VPS, or container
2. Bind to **localhost** or a private network interface
3. Use a **low-privilege token** dedicated to CopelandOS task dispatch
4. Do **not** expose a public unauthenticated endpoint
5. Require **human confirmation** for sensitive actions (MEDIUM and HIGH risk)
6. Keep audit logs for every accepted task and result

## Configuration in CopelandOS

Set these secrets outside Git:

- `OPENCLAW_WORKER_URL` or `OPENCLAW_BASE_URL` — base URL for the worker
- `OPENCLAW_TOKEN` or `OPENCLAW_WORKER_TOKEN` — shared authentication token

Until both are present, `/api/integrations/status` reports:

```json
"openclaw_worker": { "status": "not_configured" }
```

No network probe is performed in the foundation route. Status is deterministic from configuration presence only.

## Human confirmation

Sensitive actions follow the CopelandOS permission engine:

- **SAFE** — status reads, planning, draft generation
- **MEDIUM** — drafts, issues, exact approved tests (confirmation required)
- **HIGH** — send, merge, delete, deploy, install, arbitrary shell (blocked or confirmation-only; never auto-executed)

OpenClaw must respect the same boundaries. CopelandOS does not bypass them.
