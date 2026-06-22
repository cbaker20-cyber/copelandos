# Mobile Command Center

CopelandOS should feel usable from an iPhone first: quick capture, fast status, clear next action, and no invisible execution.

## Mobile Surface

### Home Screen Widget

Recommended widget actions:

- Open CopelandOS dashboard.
- Run "Capture Idea" Shortcut.
- Open today's Obsidian daily note through an Obsidian URI.
- Show a read-only morning report once the report workflow exists.

The widget should never show a provider, vault, local agent, or GitHub supervisor as live unless the Worker reports a verified connection.

### Siri Shortcut

Shortcut name: `Capture Idea`

Actions:

1. Dictate Text.
2. Get Contents of URL.
3. Method: `POST`.
4. URL: `https://<worker-host>/api/capture/idea`.
5. Headers: `Content-Type: application/json`.
6. JSON body:

```json
{
  "text": "<dictated text>",
  "source": "siri",
  "tags": ["mobile", "shortcut"],
  "urgency": "medium"
}
```

### Share Sheet

For a future native app or share extension:

- Accept text and URLs first.
- Attach source metadata such as `share-sheet`, selected app, and timestamp.
- Do not upload photos, PDFs, or email content until privacy and storage rules are reviewed.
- Return a concise confirmation: captured, classified, awaiting review.

Apple's App Shortcuts and App Intents are useful for Siri and Shortcuts actions. A general share target may require a share extension and supported content types.

## Mobile Dashboard Priorities

- Keep idea capture above the fold.
- Show "registry only" for documented integrations.
- Show "mock mode" for vault previews without GitHub vault credentials.
- Show "draft-only" for Gmail.
- Keep command input fixed at the bottom.
- Make every risky action become a plan or prompt, not execution.

## Status Cards

Recommended mobile status ordering:

1. Inbox count.
2. Today's top project.
3. Provider router status.
4. Vault mode.
5. Draft PR / review queue status.
6. Morning report status.

## Morning Use

1. Open dashboard from widget.
2. Read morning report.
3. Review overnight draft PRs and blockers.
4. Triage captured ideas.
5. Generate one Cursor/Codex prompt for the most valuable next task.
6. Save the decision to Obsidian.

## Safety Boundaries

- CORS is not authentication.
- Phone capture is not task execution.
- Gmail is draft-only.
- Local agent actions require allowlist and confirmation.
- PR status is read-only until a scoped connector exists.
- No private student data should be stored in the inbox or vault.

## Source Notes

- Apple App Shortcuts: https://developer.apple.com/documentation/appintents/app-shortcuts
- Apple App Intents interactions: https://developer.apple.com/documentation/appintents/acceleratingappinteractionswithappintents
- Obsidian URI docs: https://help.obsidian.md/Extending+Obsidian/Obsidian+URI
