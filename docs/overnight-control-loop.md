# Overnight Control Loop

The overnight loop is an ambitious command-center pattern for moving from raw ideas to draft PRs, while preserving review gates and honest system state.

## Architecture

```text
phone/Siri/Shortcut/share sheet
  -> CopelandOS inbox
  -> classifier
  -> planner
  -> provider router / AI council if needed
  -> safe tool registry
  -> Obsidian memory
  -> Cursor/Codex task
  -> draft PR
  -> review status back into CopelandOS
```

## Loop Stages

| Stage | Input | Output | Current Status |
|---|---|---|---|
| Capture | Phone, Siri, dashboard, share sheet | Inbox idea | Implemented for API/dashboard |
| Classify | Idea text and metadata | Category, skill, risk | Implemented deterministic scaffold |
| Plan | Reviewed idea/task | Steps and warnings | Implemented scaffold |
| Route | Task profile | Configured provider/fallback explanation | Implemented status router |
| Tool check | Proposed action | Allow/deny/confirmation result | Implemented |
| Memory | Reviewed note | Vault preview or GitHub vault write | Mock or configured |
| Task queue | Reviewed idea/project | Cursor/Codex prompt | Implemented scaffold |
| Draft PR | Branch work | Draft PR link | Manual/automation outside Worker |
| Morning report | Inbox/projects/PRs/checks | Status summary | Planned |

## Morning Report Shape

```markdown
# Morning Report

## Overnight Summary
- What changed
- Draft PRs opened
- Checks run

## Project Status
- CopelandOS
- Score Scanner
- Band Council Agent
- JazzBackend
- Connectome

## Blockers
- Access, data provenance, missing secrets, failing tests

## Next Safe Actions
- Review PRs
- Triage inbox items
- Approve or reject draft tasks
```

## Hard Blocks Before Automation

- Authentication and authorization must protect write/provider routes.
- GitHub supervisor must be read-only and scoped.
- Morning report must not send email; it may create a draft note only.
- Provider calls must redact upstream error bodies.
- Tool registry must deny unknown tools and MCP servers by default.
- Local agent must not expose arbitrary shell, deletion, package installation, deploys, screenshots, or UI control.
- Student/private data must not be stored.

## Current API Surface

- `GET /api/integrations`
- `GET /api/integrations/control-loop`
- `GET /api/integrations/:id`
- `POST /api/integrations/check`
- `GET /api/status` includes an integration summary.

These routes expose policy and status only. They do not dispatch tasks, call providers, create PRs, send messages, or execute local actions.

## Next Implementation Tasks

1. Add authenticated session boundary before provider-backed or write routes.
2. Add read-only GitHub PR/check summary connector.
3. Add morning report generator that writes to a private vault note.
4. Add dashboard PR status panel fed by the GitHub connector.
5. Add provider health checks with strict timeouts and redacted errors.
6. Add integration audit events for every allow/deny decision.
