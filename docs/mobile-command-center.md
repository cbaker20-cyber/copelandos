# Mobile Command Center

The mobile command center is the front door for CopelandOS. It should make capture effortless from an iPhone while keeping every downstream action reviewable.

## Core Flow

```text
iPhone dictation / Shortcut / widget / share sheet
  -> /api/capture/idea
  -> inbox item with source, urgency, tags, project hint
  -> classifier labels category, skill, and risk
  -> planner creates a reviewable brief
  -> provider router or council prepares model work
  -> tool registry decides what is allowed
  -> vault/task/PR/status happens only inside safe boundaries
```

## Current Reliable Surface

- `/console` is the active phone-first dashboard served by the Worker.
- `GET` and `POST /api/capture/idea` support Shortcuts-style intake.
- `CAPTURE_TOKEN` can authorize capture without exposing broader `API_AUTH_TOKEN` access.
- The idea inbox shows captured items and can generate Cursor/Codex prompts.
- Browser speech recognition can fill the dashboard command field when supported.
- No captured idea is executed automatically.

## iPhone Shortcut

Create a Shortcut named `Capture Idea`.

1. `Dictate Text`
2. `Get Contents of URL`
3. URL: `https://your-worker.example/api/capture/idea?token=YOUR_CAPTURE_TOKEN`
4. Method: `POST`
5. Header: `Content-Type: application/json`
6. JSON body:

```json
{
  "text": "Shortcut dictated text here",
  "source": "siri",
  "tags": ["mobile"],
  "urgency": "medium"
}
```

Optional fields:

| Field | Values | Notes |
|---|---|---|
| `project` | `copelandos`, `score-scanner`, `jazz-backend`, `band-council-agent`, `connectome-perturbation` | Helps triage |
| `urgency` | `low`, `medium`, `high` | Advisory only |
| `tags` | string array | Avoid private student data |

## Widget and Share Sheet Roadmap

| Surface | Desired Action | Implementation Notes |
|---|---|---|
| Home Screen widget | Open capture form or show morning status | PWA shortcut now; native widget later |
| Lock Screen widget | Quick capture button | Native app required for polished App Intent behavior |
| Share sheet | Send selected text/URL into inbox | Shortcut can receive share-sheet input today |
| Action Button | Start capture Shortcut | Shortcut today; App Shortcut later |
| Siri phrase | "Capture idea in CopelandOS" | Shortcut today; native app later |

## Morning Report

The mobile morning report should show:

- Overnight summary
- Draft PRs opened
- Tests and checks run
- Blocked repositories or missing credentials
- Safety notes
- Next review actions

Delivery order:

1. Dashboard card
2. Obsidian daily note preview/write
3. Optional Gmail draft, never sent automatically

## Security Requirements

- Keep `API_AUTH_TOKEN` on protected routes and use `CAPTURE_TOKEN` for capture-only Shortcuts.
- Keep `ALLOWED_ORIGIN` exact.
- Keep request size limits and provider rate limits in place.
- Do not include private student data in captured text.
- The Shortcut must not call endpoints that create drafts, write vault notes beyond capture persistence, run local actions, merge PRs, or deploy.
