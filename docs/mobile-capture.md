# CopelandOS Mobile Idea Capture

Capture ideas from your iPhone using Siri Shortcuts. Ideas are stored in the CopelandOS inbox, classified by deterministic rules, optionally mirrored to the vault, and never executed without your review.

## iOS Shortcut: "Capture Idea"

### Steps to create

1. Open the **Shortcuts** app on your iPhone
2. Tap **+** to create a new shortcut
3. Name it **Capture Idea**
4. Add the following actions:

### Action 1: Dictate Text

- Action: **Dictate Text**
- Language: English (United States)
- When done: Tap done (or use silence detection)
- Store result in: `Dictated Text`

### Action 2: Get Contents of URL

- Action: **Get Contents of URL**
- URL: `https://your-worker.copelandos.pages.dev/api/capture/idea`
- Method: **POST**
- Headers:
  - `Content-Type`: `application/json`
- Request body: **JSON**
  ```json
  {
    "text": "[Dictated Text]",
    "source": "siri",
    "tags": ["mobile"]
  }
  ```
  Replace `[Dictated Text]` with the variable from Action 1.

### Action 3: Show Result (optional)

- Add a **Show Alert** or **Show Result** action to display the captured idea ID for confirmation.

### How to trigger

- Say: **"Hey Siri, Capture Idea"**
- Or: Add the shortcut to your Home Screen as a widget

### Example Shortcut body

```json
{
  "text": "Fix the JazzBackend rhythm test — the triplet subdivision is off",
  "source": "siri",
  "tags": ["mobile", "jazzbackend"],
  "project": "jazz-backend",
  "urgency": "medium"
}
```

## Optional fields

| Field | Type | Values | Default |
|---|---|---|---|
| `text` | string | Your idea text (required) | — |
| `source` | string | `siri`, `shortcuts`, `mobile-web`, `dashboard`, `manual` | `manual` |
| `tags` | array | string tags | `[]` |
| `tag` | string | single tag shortcut | none |
| `project` | string | project id | null |
| `urgency` | string | `low`, `medium`, `high` | `medium` |

## Storage setup

- Bind Cloudflare KV as `IDEAS_KV` (or `IDEA_INBOX` / `IDEAS`) for durable JSON-backed inbox storage.
- Without KV, the Worker uses an honest in-memory mock inbox for local testing. It does not claim durable persistence.
- If `GITHUB_TOKEN` and `GITHUB_REPO` are configured for a private vault, each capture also writes an inbox idea note and appends the idea to the daily note. Without those env vars, the API returns a mock vault preview.

## Test from phone

1. Navigate to `https://your-worker.copelandos.pages.dev` in Safari
2. Open the dashboard on your phone
3. Use the mobile idea capture panel to submit a test idea
4. Check the idea inbox panel to confirm it was captured

## Fallback: Mobile web capture

If Siri Shortcuts is unreliable, use the mobile-first dashboard:
1. Open the CopelandOS dashboard URL in Safari
2. Navigate to the **Idea Inbox** panel
3. Type or dictate your idea in the capture field
4. Tap **Capture**

The form submits to `POST /api/capture/idea` with `source: "mobile-web"`.

## Security note

**The Shortcut captures ideas only. It does not execute them.**

- No code is run automatically from a captured idea
- No emails are sent
- No files are modified
- No PRs are merged
- The idea enters the inbox with status `new`
- A human must triage the idea before any action is taken

The captured idea is classified automatically by the AI brain pipeline, but classification is advisory only.

## Siri integration tips

- Keep dictations concise: one idea per capture
- Say the project name to help the classifier: "JazzBackend", "Score Scanner", "CopelandOS"
- Use urgency words: "urgent", "quick fix", "important"
- Captured ideas persist in the inbox when KV is configured; local/mock mode keeps them only for the current Worker isolate
