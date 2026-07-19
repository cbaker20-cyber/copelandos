# Overnight Control Loop

The overnight control loop is a roadmap for moving captured intent through safe review stages while CopelandOS is unattended. It is not an autonomous execution promise. The current Worker exposes the map through `GET /api/integrations/control-loop`.

## Read-only route

`GET /api/integrations/control-loop` returns:

- `architecture`: a human-readable path through the loop.
- `loop`: ordered steps with each linked integration's public status.
- `morningReport`: dashboard-first report sections and draft-only delivery notes.

The route performs no provider call, Gmail call, GitHub call, deploy, shell command, local-agent action, or MCP installation.

## Steps

1. Capture: phone/Siri/Shortcut/share sheet to CopelandOS inbox.
2. Classify: inbox item to risk and project labels.
3. Plan: classified idea to reviewable plan.
4. Route: task profile to configured provider or local fallback.
5. Council: complex task to multi-role critique.
6. Authorize tools: planned action to allow, deny, or confirmation decision.
7. Remember: approved note to private vault preview or write.
8. Queue work: task brief to Cursor/Codex prompt.
9. Draft PR: tested branch to draft PR.
10. Report back: PR/check status to CopelandOS morning report.

## Morning report sections

- Overnight summary.
- Draft PRs opened.
- Tests and checks.
- Blocked repositories.
- Safety notes.
- Next review actions.

## Required safety posture

- Scaffold-only integrations fail closed.
- Unknown integrations fail closed.
- Environment variables can mark an integration configured, but not connected.
- Email delivery remains an unsent draft workflow.
- Merge, deploy, delete, shell, screen-control, and random MCP install behavior are out of scope.
