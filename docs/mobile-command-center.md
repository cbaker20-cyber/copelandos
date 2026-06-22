# Mobile Command Center

CopelandOS should start on the phone because ideas and obligations appear away from the laptop. The mobile layer is an intake surface, not an execution engine.

## Target Flow

```text
Siri / Shortcut / widget / share sheet
  -> POST /api/capture/idea
  -> CopelandOS idea inbox
  -> classifier assigns category, skill, risk, and suggested action
  -> user reviews in dashboard
  -> planner creates a safe brief
  -> provider router or mock council helps when configured
  -> tool registry checks allowed action
  -> vault note or Cursor/Codex prompt is drafted
```

## Shortcut Recipes

### Capture Thought

1. Ask for text if no input was provided.
2. Build JSON:

```json
{
  "text": "Shortcut input",
  "source": "shortcuts",
  "urgency": "medium",
  "tags": ["mobile"]
}
```

3. `POST` JSON to `https://<worker-host>/api/capture/idea`.
4. Show the response category and risk level.

### Share Sheet Capture

1. Enable the Shortcut in the share sheet.
2. Limit accepted input types to text and URLs.
3. Convert the shared item to text plus a source URL tag.
4. Send to `/api/capture/idea` with `source: "shortcuts"`.

Apple's Shortcuts guide recommends limiting input types so irrelevant share-sheet actions are hidden. Source: [Understanding input types in Shortcuts](https://support.apple.com/guide/shortcuts/input-types-apd7644168e1/ios).

### Widget Capture

1. Add the Shortcuts widget to the Home Screen.
2. Pin "Capture Thought", "Open CopelandOS", and later "Morning Report".
3. Keep actions small enough to run from the widget; Apple notes that widget shortcuts may open the Shortcuts app when more input is needed. Source: [Run shortcuts from a widget](https://support.apple.com/guide/shortcuts/run-shortcuts-from-the-home-screen-widget-apd029b36d05/ios).

### URL Scheme Launcher

Apple supports URL-scheme execution with `shortcuts://run-shortcut?name=[name]&input=[input]&text=[text]`. CopelandOS can generate setup links for user-owned shortcuts later, but should not assume they are installed. Source: [Run a shortcut using a URL scheme](https://support.apple.com/guide/shortcuts/run-a-shortcut-from-a-url-apd624386f42/ios).

## Mobile Dashboard Requirements

- The existing dashboard should remain useful below 760px wide.
- Capture should be the first reachable mobile section after the command hero.
- The command dock must be thumb-friendly and avoid destructive actions.
- Status badges must distinguish `ready`, `configured`, `mock`, `not connected`, and `blocked`.
- The integration control loop should show what is scaffolded before users configure providers or vaults.

## Safety Rules

- CORS remains restricted to `ALLOWED_ORIGIN`; CORS is not authentication.
- Shortcuts should send only user-entered text, shared URLs, or clipboard snippets the user chose.
- Do not capture real email bodies, private student information, secrets, or OAuth tokens.
- Mobile actions can draft prompts, notes, and plans; they cannot send email, merge PRs, deploy, or run shell commands.
