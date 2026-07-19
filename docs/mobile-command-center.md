# Mobile Command Center

The mobile command center is the front door for CopelandOS. It should make capture effortless from a phone while keeping every downstream action reviewable.

## Core flow

```text
iPhone dictation / Shortcut / widget / share sheet
  -> POST /api/capture/idea
  -> inbox item with source, urgency, tags, and project hint
  -> classifier labels category, skill, and risk
  -> planner creates a reviewable brief
  -> provider router or council prepares model work
  -> tool registry decides what is allowed
  -> vault/task/PR/status happens only inside safe boundaries
```

## Current reliable surface

- The dashboard works on small screens through responsive CSS.
- `POST /api/capture/idea` accepts `text`, `source`, `tags`, `project`, and `urgency`.
- `GET /api/capture/idea` exists for simple Shortcuts URL actions when capture authorization allows it.
- The idea inbox shows captured items and can generate Cursor/Codex prompts.
- Browser speech recognition can fill the dashboard command field when supported.
- No captured idea is executed automatically.

## iPhone Shortcut

Create a Shortcut named `Capture Idea`.

1. `Dictate Text`
2. `Get Contents of URL`
3. URL: `https://your-worker.example/api/capture/idea`
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

If `CAPTURE_TOKEN` is configured, the Shortcut must include `Authorization: Bearer <capture-token>` or a capture-only token query parameter. Do not reuse provider, GitHub, Gmail, or local-agent tokens.

## Widget and share-sheet roadmap

| Surface | Desired action | Implementation notes |
|---|---|---|
| Home Screen widget | Open capture form or show morning status | PWA shortcut now; native widget later |
| Lock Screen widget | Quick capture button | Native app required for polished App Intent behavior |
| Share sheet | Send selected text/URL into inbox | Shortcut can receive share-sheet input today |
| Action Button | Start capture Shortcut | Use App Shortcut/native app later |
| Siri phrase | "Capture idea in CopelandOS" | Shortcut today; App Shortcut later |

## Morning report

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

## Security requirements

- Keep `ALLOWED_ORIGIN` exact.
- Use request size limits and rate limits before broad exposure.
- Keep mobile capture scoped to enqueueing ideas.
- Do not include private student data in captured text.
- The Shortcut must not call endpoints that create drafts, write vault notes, run local actions, merge PRs, or deploy.
