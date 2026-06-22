# Mobile Command Center

CopelandOS should be usable from an iPhone first: fast capture, honest status, and review queues that fit on a small screen. The phone is an input and review surface, not an execution authority.

## Mobile Surfaces

| Surface | Purpose | Current scope |
|---|---|---|
| Siri phrase | Hands-free idea capture | Shortcut posts text to `POST /api/capture/idea` |
| Home Screen widget | One-tap capture | Shortcut widget opens capture flow |
| Share sheet | Save links/text into CopelandOS | Proposed Shortcut payload with source URL and selected text |
| Mobile web dashboard | Inbox, providers, tools, project cards | Existing dashboard and API surfaces |
| Morning report | Review overnight work and blockers | Planned read-only digest |

Apple documents Shortcuts as multi-step workflows and supports running Shortcuts from widgets. CopelandOS should use that pattern for capture only, with all execution routed through human-reviewed queues.

## Shortcut Payloads

### Dictated Idea

```json
{
  "text": "Add a regression test for JazzBackend triplet grouping",
  "source": "siri",
  "tags": ["mobile", "jazzbackend"],
  "project": "jazz-backend",
  "urgency": "medium"
}
```

### Share Sheet Link

```json
{
  "text": "Research source for provider routing safety",
  "source": "share-sheet",
  "tags": ["research", "provider-routing"],
  "url": "https://example.com/reference",
  "urgency": "low"
}
```

Do not include API keys, OAuth codes, private emails, student records, or copyrighted music content in Shortcut payloads.

## Dashboard Polish Roadmap

The existing dashboard already has mobile-oriented styles, idea capture, provider chips, skill/tool panels, and project cards. Next UI work should focus on clarity instead of spectacle:

- Sticky mobile capture dock with a single large `Capture` action.
- Status cards that separate `configured`, `connected`, `scaffolded`, and `planned`.
- Provider route explainer showing selected provider, fallback chain, and local Ollama fallback.
- Tool safety drawer showing blocked actions before any prompt is generated.
- Morning report tab with overnight PRs, tests run, blockers, and next review actions.
- Large tap targets, keyboard focus states, and text that remains readable at iPhone width.
- No copied sci-fi UI assets, proprietary images, or fake live telemetry.

## Mobile Review Flow

```text
Capture idea
  -> confirm inbox receipt
  -> classifier tags project and risk
  -> dashboard shows "review required" if medium/high risk
  -> planner creates task brief
  -> provider router explains AI route
  -> tool registry preflights allowed actions
  -> Cursor/Codex prompt generated
  -> agent opens draft PR outside CopelandOS
  -> morning report links PR/check status for review
```

## Accessibility and Privacy

- Avoid tiny icon-only controls.
- Preserve keyboard focus styles and screen-reader labels.
- Prefer text status over color-only status.
- Keep student names, student contact information, grades, and private communications out of captures.
- Keep report email generation draft-only; do not send from CopelandOS.

## Acceptance Checks

- `GET /api/integrations?category=capture` lists mobile capture surfaces.
- `POST /api/integrations/check` blocks `execute_task` for `mobile-shortcuts`.
- Mobile docs explain that Shortcuts capture ideas only.
- Dashboard does not show external services as connected unless the backend can prove it.
