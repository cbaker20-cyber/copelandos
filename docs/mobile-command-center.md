# Mobile Command Center

CopelandOS should start on the phone because most ideas arrive away from the keyboard. The safe mobile loop is capture-first and execution-later:

```text
iPhone widget / Siri / share sheet
  -> POST idea text to CopelandOS
  -> deterministic classification
  -> human-visible inbox
  -> planner and provider router
  -> safe tool registry
  -> Obsidian memory or Cursor/Codex prompt
```

## What Works Now

- `/api/capture/idea` accepts reviewed idea payloads.
- The dashboard has a mobile-responsive idea capture form and inbox.
- Captured ideas can generate Cursor/Codex prompts.
- No mobile action executes code, sends mail, controls a screen, or deploys.

## Proposed iPhone Shortcut

Shortcut name: `Capture in CopelandOS`

Inputs:

- `Shortcut Input`: text, URL, selected share sheet content, or clipboard text.
- `Source`: `siri`, `shortcuts`, `share-sheet`, or `widget`.
- `Urgency`: `low`, `medium`, or `high`.

Actions:

1. Normalize text.
2. If text is empty, ask for dictated text.
3. Build JSON with `text`, `source`, `urgency`, and `tags`.
4. POST to `/api/capture/idea`.
5. Show the returned classification and risk.
6. Offer buttons for "Open Dashboard" or "Done".

The Shortcut must not include API keys in shared screenshots or exported files. When auth is added, use a revocable token with minimum scope.

## URL Scheme And Callback

Apple supports running a Shortcut with:

```text
shortcuts://run-shortcut?name=[name]&input=[input]&text=[text]
```

For status handoff, x-callback URLs can include `x-success`, `x-cancel`, and `x-error`; successful Shortcut output can be appended as `result`.

Sources:

- <https://support.apple.com/guide/shortcuts/run-a-shortcut-from-a-url-apd624386f42/ios>
- <https://support.apple.com/guide/shortcuts/use-x-callback-url-apdcd7f20a6f/ios>

## Widget Concepts

- `Capture`: opens dictation or text input and posts to the inbox.
- `Morning Report`: opens CopelandOS status and recent task outcomes.
- `PR Queue`: opens draft PR review status once read-only GitHub supervision exists.
- `Brain Dump`: captures multiple newline-separated ideas as separate inbox items after confirmation.

All widgets should be shortcuts into review surfaces. They should not run local actions or provider calls directly.

## Share Sheet Workflow

Use the share sheet for:

- URLs to research later.
- GitHub issues or PRs to inspect.
- Text snippets for Obsidian memory.
- Emails to draft responses for, without sending.
- Music project ideas.

The shared item should be stored as an idea with a source tag. The classifier can later suggest `research-notes`, `repo-review`, `score-scanning`, `band-council`, or other skills.

## Mobile Safety Rules

- Mobile capture writes only to the inbox.
- No arbitrary commands.
- No Gmail send endpoint.
- No file deletion.
- No screen, mouse, or keyboard control.
- No private student data.
- No provider shown as connected without a configured credential and explicit health probe.
- CORS remains restricted to the exact `ALLOWED_ORIGIN`.

## API Contract Draft

`POST /api/capture/idea`

```json
{
  "text": "Draft a status report for the overnight sprint",
  "source": "shortcuts",
  "urgency": "medium",
  "tags": ["mobile", "morning-report"]
}
```

Expected response:

```json
{
  "ok": true,
  "idea": {
    "id": "idea_...",
    "status": "new"
  },
  "classification": {
    "category": "planning",
    "riskLevel": "safe"
  }
}
```

## Roadmap

1. Add auth to mobile capture after the security backlog allows it.
2. Provide an importable Shortcut JSON or setup guide.
3. Add x-callback return URLs for idea ID and triage status.
4. Add read-only morning report cards.
5. Add a push-safe review status surface only after GitHub supervisor routes are implemented and tested.
