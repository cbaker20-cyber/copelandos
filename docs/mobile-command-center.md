# Mobile Command Center

The mobile command center starts as a capture and status surface, not a remote-control surface. The phone can collect thoughts quickly, but CopelandOS must still classify, plan, and require review before any side effect.

## Shortcut Contract

Recommended Shortcut name: `Capture to CopelandOS`.

Inputs:

- `text`: required idea text, copied text, dictated text, or shared URL summary.
- `source`: one of `siri`, `shortcuts`, `share-sheet`, `widget`, or `mobile-web`.
- `urgency`: `low`, `medium`, or `high`.
- `tags`: optional user-visible labels.

Request:

```http
POST /api/capture/idea
Content-Type: application/json

{
  "text": "Draft a test plan for provider failover",
  "source": "siri",
  "urgency": "medium",
  "tags": ["mobile"]
}
```

Response handling:

- Show the classification category and risk level.
- If risk is high, tell the user it was captured for review and not executed.
- Never call `/api/command`, local-agent endpoints, Gmail endpoints, or deploy tooling directly from the Shortcut.

## Share Sheet Flow

Apple supports making a Shortcut available from the share sheet so other apps can pass selected content into it. CopelandOS should use that only for inbox capture:

```text
Share selected text/URL
  -> Capture to CopelandOS Shortcut
  -> POST /api/capture/idea
  -> confirmation notification
  -> user reviews in dashboard later
```

The Shortcut should strip obvious tokens before submission where possible, but server-side validation remains mandatory.

## Widget Flow

The Home Screen widget should expose fast actions:

- `Capture idea`: opens the capture Shortcut.
- `Morning report`: opens the dashboard report panel when implemented.
- `Project status`: opens read-only project dashboard.
- `Review queue`: opens the idea inbox.

The widget must not run local PC actions, send messages, close issues, deploy, or merge.

## Mobile Dashboard Polish

The existing dashboard is mobile-first through responsive CSS. Priority polish:

- Keep the command dock reachable with thumb controls.
- Make the integration control loop readable as horizontally wrapping chips.
- Prefer short status text over dense tables.
- Display `configured`, `scaffold-only`, and `not connected` separately.
- Keep high-risk affordances out of the primary mobile UI.

## Security Checklist

- CORS stays restricted to the exact configured `ALLOWED_ORIGIN`.
- CORS is not authentication.
- Mobile capture writes only to the inbox.
- Captured items are stored as tasks/ideas, not commands.
- Any eventual x-callback-url response returns only non-sensitive status text.

Sources: Apple Shortcuts URL schemes, widgets, and share sheet docs are covered in Apple’s Shortcuts User Guide: [URL runs](https://support.apple.com/guide/shortcuts/run-a-shortcut-from-a-url-apd624386f42/ios), [share sheet launch](https://support.apple.com/guide/shortcuts/launch-a-shortcut-from-another-app-apd163eb9f95/ios), and [widgets](https://support.apple.com/guide/shortcuts/run-shortcuts-from-the-home-screen-widget-apd029b36d05/ios).
