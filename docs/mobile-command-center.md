# Mobile Command Center

CopelandOS should be usable from an iPhone in 30 seconds: capture an idea, check overnight work, review blockers, and copy the next Cursor/Codex prompt. The phone is an inbox and review surface, not an execution device.

## Target Architecture

```text
Siri / Shortcuts widget / Share Sheet / mobile dashboard
  -> POST /api/capture/idea
  -> inbox item with source, tags, project, urgency
  -> deterministic classifier
  -> planner and risk warnings
  -> provider router or AI council prompt if useful
  -> tool/MCP allowlist check
  -> Obsidian note preview or private vault write
  -> Cursor/Codex prompt
  -> draft PR and checks
  -> mobile morning report
```

## Current Reliable Scope

- Ideas can be captured through `POST /api/capture/idea`.
- Valid sources are `siri`, `shortcuts`, `mobile-web`, `dashboard`, and `manual`.
- Ideas are classified immediately but not executed.
- Prompt routes can generate Cursor/Codex task text for a project.
- Provider/tool/vault status can be displayed honestly.

## iPhone Shortcuts Setup

Apple supports running shortcuts from other apps through the Share Sheet, constraining accepted input types, receiving onscreen items, and running shortcuts from widgets:

- https://support.apple.com/guide/shortcuts/launch-a-shortcut-from-another-app-apd163eb9f95/ios
- https://support.apple.com/guide/shortcuts/limit-the-input-for-a-shortcut-apd8195f96d6/ios
- https://support.apple.com/guide/shortcuts/receive-onscreen-items-apd350ce757a/ios
- https://support.apple.com/guide/shortcuts/run-shortcuts-from-the-home-screen-widget-apd029b36d05/ios

### Shortcut: Capture Idea

Actions:

1. `Dictate Text` or `Ask for Input`.
2. `Get Contents of URL`.
3. Method: `POST`.
4. URL: `https://<worker-host>/api/capture/idea`.
5. Header: `Content-Type: application/json`.
6. Body:

```json
{
  "text": "<dictated text>",
  "source": "siri",
  "tags": ["mobile"],
  "urgency": "medium"
}
```

Expected response:

```json
{
  "ok": true,
  "idea": {
    "id": "idea-...",
    "status": "new",
    "source": "siri"
  }
}
```

Safety:

- Show the returned idea ID.
- Do not call `/api/ai`, `/api/email/draft`, `/api/remote/request-action`, or any future execution route from this shortcut.
- One idea per run.

### Shortcut: Capture Shared URL

Enable "Show in Share Sheet" and limit accepted input to URLs and text. The shortcut body should include the shared URL as metadata, not as a command:

```json
{
  "text": "Review this source for the provider routing roadmap: <shared URL>",
  "source": "shortcuts",
  "tags": ["mobile", "source"],
  "urgency": "low"
}
```

### Shortcut: Queue Project Task

Use this only to create a queue item:

```json
{
  "text": "Create tests for provider fallback routing",
  "source": "shortcuts",
  "project": "copelandos",
  "tags": ["mobile", "cursor-task"],
  "urgency": "medium"
}
```

The planner may later produce a Cursor prompt, but the phone must not run the agent.

## Mobile Dashboard Cards

Recommended dashboard order:

1. **Capture**: one text/dictation input and submit button.
2. **Inbox**: newest ideas, risk badges, status chips.
3. **Today**: morning report, blockers, draft PR links when available.
4. **Projects**: five registered repos and next safe task.
5. **Providers**: configured/not-configured/free/local badges.
6. **Tools**: allowlist summary and blocked high-risk actions.
7. **Vault**: mock/private-vault status and last safe note preview.
8. **Review Queue**: draft PRs, checks, comments, and next review action.

## Widget Design

Keep widgets boring and reliable:

- Small widget: `Capture Idea`.
- Medium widget: `Capture Idea`, `Open Dashboard`, `Morning Status`, `Queue Task`.
- Large widget: same actions plus project shortcuts.

No widget should send mail, merge PRs, deploy, delete files, or run arbitrary shell.

## Notification Model

Allowed notifications:

- "Idea captured: `<id>`"
- "Draft PR opened: review needed"
- "Check failed: action required"
- "Morning report ready"

Disallowed notifications:

- Private student details.
- Full email bodies.
- API keys/tokens.
- Claims that a connector is live without probe evidence.

## Morning Mobile Flow

1. Open CopelandOS dashboard.
2. Read status cards: providers, vault, local agent, GitHub supervisor.
3. Review overnight ideas by risk:
   - `high`: human review only.
   - `medium`: confirm before drafts/tasks.
   - `safe`: convert to note or task prompt.
4. Open draft PR summaries.
5. Copy the next Cursor/Codex prompt if manual follow-up is needed.
6. Save a daily note to Obsidian only if the vault is configured; otherwise keep a mock preview.

## Test Checklist

- `POST /api/capture/idea` rejects empty and oversized text.
- Shortcuts body uses JSON and `Content-Type: application/json`.
- Source is one of the accepted source strings.
- Captured email-related ideas are medium risk and draft-only.
- Captured deploy/delete/send/merge requests are high risk and do not execute.
- Dashboard renders disconnected states for local agent, GitHub supervisor, and unconfigured providers.
