# Mobile Command Center

The phone is the fastest input surface for CopelandOS. It should capture ideas, links, project updates, and voice notes into a safe inbox, then wait for review before planning or task dispatch.

## Mobile Entry Points

1. **Siri phrase:** "Capture idea" dictates text into `POST /api/capture/idea`.
2. **Shortcuts widget:** A home-screen button posts typed or dictated text.
3. **Share sheet:** Safari or app text can be wrapped into an idea payload.
4. **Mobile web dashboard:** The existing responsive dashboard captures ideas directly.
5. **Future lock-screen widget:** Show open inbox count and a "capture" launcher only.

## Shortcut Payload

```json
{
  "text": "Draft a provider-router test for OpenRouter fallback",
  "source": "shortcuts",
  "tags": ["mobile", "copelandos"],
  "urgency": "medium"
}
```

The Shortcut should display the returned idea id or failure message. It should not try to open Cursor, run shell commands, send email, merge PRs, or write arbitrary files.

## Share Sheet Workflow

1. Receive text, URL, or Safari page from the share sheet.
2. Normalize it into `text` plus optional `tags`.
3. POST to `/api/capture/idea`.
4. Show a confirmation containing the idea category and risk level.
5. Let the dashboard or morning report handle triage later.

## Dashboard Requirements

- Thumb-friendly capture field at the top of the phone view.
- Visible "not executed automatically" copy near capture controls.
- Inbox count and highest-risk captured item.
- Provider status shown as `configured` only when env vars exist.
- Tool/MCP blocked actions visible in plain language.
- Morning report panel once GitHub status is implemented.

## Safety Notes

- CORS must remain restricted to the configured `ALLOWED_ORIGIN`.
- Captured content must be treated as untrusted user input.
- Captured ideas can produce drafts/prompts only after review gates.
- Private student data should be rejected or summarized manually outside CopelandOS.
- Shortcuts should use HTTPS Worker URLs and avoid embedding long-lived secrets in the Shortcut.

## References

- Apple Shortcuts user guide: <https://support.apple.com/guide/shortcuts/welcome/ios>
- Apple Shortcuts widgets overview: <https://support.apple.com/guide/shortcuts/run-shortcuts-from-a-widget-apd029b36d05/mac>
- Apple Shortcuts web actions reference: <https://support.apple.com/guide/shortcuts/use-the-contents-of-webpages-apd3bf369d2a/ios>
