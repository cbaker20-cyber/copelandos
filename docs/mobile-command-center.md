# Mobile Command Center

CopelandOS starts on the phone: Siri, widgets, the Share Sheet, and the mobile dashboard should all feed the same inbox instead of creating scattered notes.

## User Flows

### Siri capture

```text
"Hey Siri, Capture Idea"
  -> Dictate Text
  -> POST /api/capture/idea
  -> Show idea id and risk level
  -> Stop
```

Shortcut payload:

```json
{
  "text": "Draft a Score Scanner hardware blueprint",
  "source": "siri",
  "tags": ["mobile", "overnight"],
  "project": "score-scanner",
  "urgency": "medium"
}
```

Apple's Shortcuts app supports `Get Contents of URL` with `POST` and JSON request bodies, which is enough for the first capture workflow. Source: [Apple Shortcuts API request guide](https://support.apple.com/guide/shortcuts/request-your-first-api-apd58d46713f/ios).

### Widget capture

```text
Home Screen widget
  -> opens "Capture Idea" Shortcut
  -> prompts for dictated or typed text
  -> sends to the same inbox endpoint
```

The widget must show a confirmation response only. It must not execute a task or open a provider route automatically.

### Share Sheet capture

```text
Share article / GitHub issue / selected text
  -> Shortcut receives input
  -> POST /api/capture/idea with source: "shortcuts"
  -> tags include "shared-link" when a URL is present
```

The classifier should treat shared content as untrusted. Links are planning context, not authorization.

### Mobile dashboard

The existing dashboard should remain the fallback when Siri/Shortcuts are unreliable:

- Capture idea text.
- See classification and risk level.
- Review inbox cards.
- Generate a Cursor or Codex prompt.
- See provider/tool/vault states honestly.

## Minimal API Contract

`POST /api/capture/idea`

Required:

- `text`: non-empty idea text.

Optional:

- `source`: `siri`, `shortcuts`, `mobile-web`, `dashboard`, or `manual`.
- `tags`: string array.
- `project`: project id from `config/projects.json`.
- `urgency`: `low`, `medium`, or `high`.

Response:

- `idea.id`
- `idea.status`
- `classification.category`
- `classification.riskLevel`
- `classification.confirmationRequired`

## Mobile Safety

- Capture is allowed.
- Classification is advisory.
- High-risk ideas stop at planning.
- Communication drafts remain draft-only.
- Provider routing must not occur until the idea is reviewed or explicitly routed by the user.
- CORS remains restricted to the exact configured `ALLOWED_ORIGIN`.

## Implementation Backlog

1. Add a downloadable Shortcut setup guide with screenshots or exported Shortcut metadata.
2. Add optional Bearer token or signed capture token for public Worker URLs.
3. Add Share Sheet parsing for URL, selected text, and title fields.
4. Add mobile "Morning Report" dashboard section.
5. Add command-center badges from `/api/integrations`.
6. Add durable inbox storage with retention policy.
